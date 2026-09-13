"""Private runtime supervisor. Each agent gets a process and a private Hermes home."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time

ROOT = Path(os.environ.get("CAMP_HERMES_DATA", "/data"))
SOURCE = Path(os.environ.get("HERMES_SOURCE", "/opt/hermes"))
KEY = os.environ.get("CAMP_RUNTIME_SECRET", "")
if len(KEY) < 32:
    raise RuntimeError("CAMP_RUNTIME_SECRET is required")
ROOT.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()
JOBS = {}
ACTIVE = set()


def valid_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,150}", value):
        raise ValueError("Invalid identity")
    return value


def persist(job):
    safe = {k: v for k, v in job.items() if k != "process"}
    dest = ROOT / ("invocation-" + job["id"] + ".json")
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(json.dumps(safe)); tmp.chmod(0o600); tmp.replace(dest)


def launch(payload, job):
    identity = payload["campId"] + "/" + payload["agentId"]
    home = ROOT / "profiles" / payload["campId"] / payload["agentId"]
    home.mkdir(parents=True, exist_ok=True)
    # The child never inherits provider, Discord, GitHub or supervisor credentials.
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LANG": "C.UTF-8",
           "HERMES_HOME": str(home), "HERMES_MANAGED_DIR": "/opt/yamnaya/managed",
           "PYTHONPATH": str(SOURCE), "PYTHONUNBUFFERED": "1",
           "HERMES_ENABLE_PROJECT_PLUGINS": "false"}
    process = None
    try:
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("runner.py"))],
            cwd=str(SOURCE), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        with LOCK:
            job["process"] = process
        process.stdin.write(json.dumps(payload)); process.stdin.close()
        timer = threading.Timer(payload.get("timeoutSeconds", 300) + 10, process.kill)
        timer.start()
        try:
            for line in process.stdout:
                try:
                    event = json.loads(line)
                except (ValueError, TypeError):
                    continue
                if not isinstance(event, dict) or event.get("kind") not in ["tool.start", "tool.end", "completed", "failed", "deferred"]:
                    continue
                with LOCK:
                    event["sequence"] = len(job["events"]) + 1
                    job["events"].append(event)
                    if event["kind"] == "completed":
                        job["summary"] = event.get("summary", "")
                    if event["kind"] == "deferred":
                        job["retryAt"] = event["retryAt"]; job["reason"] = event["reason"]
                    persist(job)
            code = process.wait()
            with LOCK:
                if job["status"] != "cancelled":
                    job["status"] = ("deferred" if "retryAt" in job else "completed") if code == 0 and ("summary" in job or "retryAt" in job) else "failed"
                persist(job)
        finally:
            timer.cancel()
    except Exception:
        with LOCK:
            job["status"] = "failed"; persist(job)
    finally:
        if process is not None and process.poll() is None:
            process.kill(); process.wait()
        with LOCK:
            ACTIVE.discard(identity)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def authorized(self):
        return hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + KEY)

    def do_GET(self):
        if self.path == "/health":
            return self.respond(200, {"ok": True, "runtime": "hermes", "sourcePresent": (SOURCE / "run_agent.py").exists()})
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        key = self.path.removeprefix("/invocations/").split("?")[0]
        with LOCK:
            job = JOBS.get(key)
            if job:
                return self.respond(200, {k: v for k, v in job.items() if k != "process"})
        return self.respond(404, {"error": "Invocation not found"})

    def do_POST(self):
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > 200000:
                raise ValueError("Request too large")
            payload = json.loads(self.rfile.read(size) or b"{}")
            if self.path.endswith("/cancel"):
                key = self.path.split("/")[2]
                with LOCK:
                    job = JOBS.get(key)
                    if not job:
                        return self.respond(404, {"error": "Invocation not found"})
                    process = job.get("process")
                    job["status"] = "cancelled"; persist(job)
                    if process and process.poll() is None:
                        process.terminate()
                        threading.Timer(5, lambda: process.kill() if process.poll() is None else None).start()
                return self.respond(200, {"status": "cancelled"})
            if self.path != "/invocations":
                return self.respond(404, {"error": "Unknown operation"})
            for name in ["invocationId", "campId", "agentId", "configurationId", "sessionId"]:
                valid_id(payload[name])
            # Caller is the trusted worker. Agent text cannot select arbitrary runtime limits or executables.
            payload["maxIterations"] = min(12, max(1, int(payload.get("maxIterations", 12))))
            payload["timeoutSeconds"] = min(300, max(10, int(payload.get("timeoutSeconds", 300))))
            identity = payload["campId"] + "/" + payload["agentId"]
            key = payload["invocationId"]
            with LOCK:
                if key in JOBS:
                    return self.respond(200, {"id": key, "status": JOBS[key]["status"]})
                prior = ROOT / ("invocation-" + key + ".json")
                if prior.exists():
                    job = json.loads(prior.read_text())
                    if job["status"] == "running":
                        job["status"] = "indeterminate"
                    JOBS[key] = job
                    return self.respond(200, {"id": key, "status": job["status"]})
                if identity in ACTIVE or len(ACTIVE) >= 2:
                    return self.respond(409, {"error": "Runtime occupied"})
                job = {"id": key, "status": "running", "events": [], "startedAt": time.time(), "configurationId": payload["configurationId"], "inputDigest": hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()}
                JOBS[key] = job; ACTIVE.add(identity); persist(job)
            threading.Thread(target=launch, args=(payload, job), daemon=True).start()
            self.respond(202, {"id": key, "status": "running"})
        except (ValueError, KeyError):
            self.respond(400, {"error": "Invalid invocation request"})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("CAMP_HERMES_PORT", "8765"))), Handler).serve_forever()
