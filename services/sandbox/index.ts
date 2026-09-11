import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { safePublicationPath } from "@yamnaya/core";
import { canonicalFiles, sha256 } from "../worker/quarto";

if (
  process.env.CAMP_SANDBOX_ISOLATED !== "1" &&
  process.env.CAMP_ALLOW_LOCAL_SANDBOX !== "1"
)
  throw new Error("Run the sandbox in its isolated container");
let busy = false;
const startedAt = Date.now();
function execute(
  command: string,
  args: string[],
  cwd: string,
  timeout: number,
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        NODE_ENV: "production",
        PATH: process.env.PATH,
        LANG: "C.UTF-8",
        TMPDIR: cwd,
        XDG_CACHE_HOME: path.join(cwd, "cache"),
        XDG_DATA_HOME: path.join(cwd, "data"),
        QUARTO_PYTHON: process.env.QUARTO_PYTHON ?? "python3",
        PYTHONNOUSERSITE: "1",
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const stop = () => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => {
      stop();
      reject(new Error("Sandbox execution timed out"));
    }, timeout);
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        output += chunk.toString();
        if (output.length > 1000000) {
          stop();
          reject(new Error("Execution output limit exceeded"));
        }
      });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      stop();
      if (code === 0) resolve(output);
      else reject(new Error(output.slice(-4000) || `Process exited ${code}`));
    });
  });
}
async function collect(
  dir: string,
  root = dir,
  files: Record<string, string> = {},
) {
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error("Symlink output is not allowed");
    if (info.isDirectory()) await collect(file, root, files);
    else {
      if (info.size > 8_000_000) throw new Error("Artifact exceeds file limit");
      files[path.relative(root, file)] = (await readFile(file)).toString(
        "base64",
      );
    }
  }
  return files;
}
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true, busy }));
    return;
  }
  if (req.method !== "POST" || !["/render", "/code"].includes(req.url ?? "")) {
    res.writeHead(404).end();
    return;
  }
  if (busy) {
    res.writeHead(409).end(JSON.stringify({ error: "Sandbox occupied" }));
    return;
  }
  busy = true;
  let dir = "";
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1_000_000) throw new Error("Request too large");
    }
    const input = JSON.parse(body);
    dir = await mkdtemp(path.join(tmpdir(), "camp-job-"));
    if (req.url === "/render") {
      if (
        !input.files ||
        sha256(canonicalFiles(input.files)) !== input.sourceDigest
      )
        throw new Error("Source digest mismatch");
      for (const [name, content] of Object.entries(input.files)) {
        if (!safePublicationPath(name) || typeof content !== "string")
          throw new Error("Invalid source path");
        const dest = path.join(dir, name);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, content);
      }
      await execute(
        "quarto",
        ["render", "--execute", "--no-cache"],
        dir,
        150000,
      );
      const outputDir = path.join(dir, "_site");
      await writeFile(
        path.join(outputDir, "yamnaya-release.json"),
        JSON.stringify({
          buildId: input.buildId,
          sourceDigest: input.sourceDigest,
          inputDigest: input.inputDigest,
          version: input.version,
        }),
      );
      const files = await collect(outputDir);
      if (JSON.stringify(files).length > 30_000_000)
        throw new Error("Site exceeds 30 MB artifact limit");
      res.end(JSON.stringify({ files, sourceDigest: input.sourceDigest }));
    } else {
      if (
        !["python", "javascript"].includes(input.language) ||
        typeof input.source !== "string" ||
        input.source.length > 30000
      )
        throw new Error("Python or JavaScript source required");
      const name = input.language === "python" ? "main.py" : "main.mjs";
      await writeFile(path.join(dir, name), input.source);
      const stdout = await execute(
        input.language === "python" ? "python3" : "node",
        [name],
        dir,
        15000,
      );
      res.end(
        JSON.stringify({
          stdout: stdout.slice(0, 30000),
          sourceDigest: sha256(input.source),
        }),
      );
    }
  } catch (e) {
    res.writeHead(422).end(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Sandbox failed",
      }),
    );
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
    if (process.env.CAMP_SANDBOX_ISOLATED === "1") {
      // Dispose of the entire PID namespace after every job, including detached
      // descendants. No following camp can inherit a previous process or file.
      // Ten seconds of uptime keeps Docker restart backoff from accumulating.
      if (!res.writableFinished && !res.destroyed) await new Promise<void>(resolve=>{res.once("finish",resolve);res.once("close",resolve);});
      setTimeout(()=>{server.close(()=>setTimeout(()=>process.exit(0),100));server.closeIdleConnections();setTimeout(()=>process.exit(0),5000).unref();},Math.max(100,10000-(Date.now()-startedAt)));
    } else busy = false;
  }
}).listen(Number(process.env.CAMP_SANDBOX_PORT ?? 4111), "0.0.0.0", () =>
  console.log("Isolated camp sandbox ready"),
);
