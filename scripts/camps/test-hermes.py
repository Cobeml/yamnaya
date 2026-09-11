"""Contract smoke test against the real pinned Hermes source, with a local fake model."""
import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import uuid
import urllib.request

calls = []
requested_tool = "camp_observe"
pause_after_tool = False
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def do_GET(self):
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"id": "camp-test", "status": "running", "mission": "Contract smoke test"}).encode())
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if not data.get("tools"):
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"id":"probe", "object":"chat.completion", "choices":[{"index":0,"message":{"role":"assistant","content":"Ready"},"finish_reason":"stop"}]}).encode())
            return
        calls.append(data)
        names = [t["function"]["name"] for t in data.get("tools", [])]
        assert "camp_observe" in names, names
        assert all(name.startswith("camp_") or name == "memory" for name in names), names
        used = any(m.get("role") == "tool" for m in data.get("messages", []))
        if used and pause_after_tool:
            self.send_response(429); self.send_header("Content-Type", "application/json"); self.send_header("X-Camp-Retry-At", "2099-01-01T00:00:00.000Z"); self.end_headers()
            self.wfile.write(json.dumps({"error":{"message":"Quota fixture", "type":"camp_quota"}}).encode()); return
        message = {"role": "assistant", "content": "Contract test complete."} if used else {"role": "assistant", "content": None, "tool_calls": [{"id": "call_observe", "type": "function", "function": {"name": requested_tool, "arguments": "{}"}}]}
        response = {"id": "test", "object": "chat.completion", "model": "fixture-model", "created": 0, "choices": [{"index": 0, "message": message, "finish_reason": "stop" if used else "tool_calls"}], "usage": {"prompt_tokens": 40, "completion_tokens": 10, "total_tokens": 50}}
        if data.get("stream"):
            self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.end_headers()
            delta = dict(message)
            if "tool_calls" in delta:
                delta["tool_calls"][0]["index"] = 0
            chunk = {"id":"test", "object":"chat.completion.chunk", "model":"fixture-model", "created":0, "choices":[{"index":0,"delta":delta,"finish_reason":None}]}
            self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            chunk["choices"] = [{"index":0,"delta":{},"finish_reason":"stop" if used else "tool_calls"}]
            self.wfile.write(("data: " + json.dumps(chunk) + "\n\ndata: [DONE]\n\n").encode())
        else:
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(response).encode())

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = "http://127.0.0.1:" + str(server.server_port)
source = Path(os.environ.get("HERMES_SOURCE", "/tmp/yamnaya-hermes-source"))
runner = Path(os.environ.get("CAMP_HERMES_RUNNER", str(Path(__file__).resolve().parents[2] / "services/hermes/runner.py")))
with tempfile.TemporaryDirectory(prefix="hermes-contract-") as home:
    env = {**os.environ, "HERMES_HOME": home, "PYTHONPATH": str(source), "HERMES_MANAGED_DIR": str(runner.parent / "managed")}
    payload = {"campId": "camp-test", "agentId": "ada", "configurationId": "ada-v1", "token": "fixture-only", "apiUrl": base, "modelProxyUrl": base + "/v1", "model": "fixture-model", "apiMode": "chat_completions", "sessionId": "test-session", "invocationId": "test-invocation", "text": "Observe the camp", "systemPrompt": "Use camp_observe once, then report completion.", "maxIterations": 3, "timeoutSeconds": 30}
    result = subprocess.run([str(source / ".venv/bin/python"), str(runner)], input=json.dumps(payload), text=True, capture_output=True, env=env, cwd=source, timeout=60)
    events = []
    for line in result.stdout.splitlines():
        try:
            value = json.loads(line)
            if isinstance(value, dict) and "kind" in value:
                events.append(value)
        except ValueError:
            pass
    assert result.returncode == 0, (events, result.stdout[-8000:], result.stderr[-1000:], len(calls))
    assert any(e["kind"] == "tool.start" and e["tool"] == "camp_observe" for e in events), events
    assert events[-1]["kind"] == "completed", events
    assert (Path(home) / "history-ada-v1.json").exists()
    assert len(calls) == 2, len(calls)
    requested_tool = "delegate_task"
    payload["configurationId"] = "ada-v2"
    payload["invocationId"] = "test-forbidden-invocation"
    blocked = subprocess.run([str(source / ".venv/bin/python"), str(runner)], input=json.dumps(payload), text=True, capture_output=True, env=env, cwd=source, timeout=60)
    assert blocked.returncode == 0, blocked.stdout[-1000:]
    checkpoint = json.loads((Path(home) / "history-ada-v2.json").read_text())
    assert any(m.get("role") == "tool" and any(reason in str(m.get("content")) for reason in ["outside this camp", "does not exist"]) for m in checkpoint), checkpoint
    requested_tool = "camp_observe"
    pause_after_tool = True
    payload["configurationId"] = "ada-v3"
    payload["invocationId"] = "quota-first"
    paused = subprocess.run([str(source / ".venv/bin/python"), str(runner)], input=json.dumps(payload), text=True, capture_output=True, env=env, cwd=source, timeout=60)
    assert paused.returncode == 0 and '"kind": "deferred"' in paused.stdout, (paused.stdout[-3000:], paused.stderr[-1000:])
    saved = json.loads((Path(home) / "history-ada-v3.json").read_text())
    assert any(m.get("role") == "tool" for m in saved), saved
    pause_after_tool = False
    payload["invocationId"] = "quota-resumed"
    resumed = subprocess.run([str(source / ".venv/bin/python"), str(runner)], input=json.dumps(payload), text=True, capture_output=True, env=env, cwd=source, timeout=60)
    assert resumed.returncode == 0 and '"kind": "completed"' in resumed.stdout, resumed.stdout[-3000:]
    assert '"kind": "tool.start"' not in resumed.stdout, "Completed tool was repeated after quota resume"
    print("PASS: quota suspension retained tool results; resume completed without repeating the tool.")
    print("PASS: real Hermes observation, completion, persistent checkpoint and denial of a fabricated delegation call; fake model only.")
if os.environ.get("CAMP_HERMES_SUPERVISOR_URL"):
    requested_tool = "camp_observe"
    invocation = "contract-" + uuid.uuid4().hex[:12]
    payload.update({"invocationId":invocation,"campId":"camp-"+invocation,"agentId":"ada","configurationId":"ada-v1","sessionId":invocation})
    supervisor = os.environ["CAMP_HERMES_SUPERVISOR_URL"]
    headers = {"Authorization":"Bearer "+os.environ["CAMP_RUNTIME_SECRET"],"Content-Type":"application/json"}
    with urllib.request.urlopen(urllib.request.Request(supervisor+"/invocations", data=json.dumps(payload).encode(), headers=headers), timeout=10) as response:
        assert response.status == 202
    for _ in range(40):
        with urllib.request.urlopen(urllib.request.Request(supervisor+"/invocations/"+invocation,headers=headers),timeout=10) as response:
            journal=json.load(response)
        if journal["status"] != "running":
            break
        time.sleep(1)
    assert journal["status"] == "completed", journal
    assert any(e["kind"]=="tool.start" for e in journal["events"]), journal
    with urllib.request.urlopen(urllib.request.Request(supervisor+"/invocations",data=json.dumps(payload).encode(),headers=headers),timeout=10) as response:
        assert response.status == 200
        assert json.load(response)["status"] == "completed"
    print("PASS: supervisor invocation, durable completion journal and idempotent resubmission.")
server.shutdown()
