import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import ts from "typescript";
import { createHash } from "node:crypto";
import { z } from "zod";

const association = z.object({
  meterId: z.string(),
  sdpId: z.string(),
  from: z.string(),
  to: z.string().nullable(),
});
const inputSchema = z.object({
  source: z.string().max(30000),
  associations: z.array(association).max(1000).optional(),
  request: z.record(z.string(), z.unknown()).optional(),
});
function expressionForTests() {
  return `(map) => {
    if (typeof map !== 'function') throw new Error('Export mapExchange is required');
    const results = [];
    for (let i = 0; i < 32; i++) {
      const target = 'S-' + i, other = 'S-other-' + i;
      const rows = [{meterId:'OTHER',sdpId:other,from:'2026-01-01T00:00:00.000Z',to:null},{meterId:'OLD',sdpId:target,from:'2026-01-01T00:00:00.000Z',to:null}];
      const request = {sdpId:target,oldMeterId:'OLD',meterId:'NEW-'+i,effectiveAt:'2026-09-10T14:00:00.000Z',verb:'exchange'};
      const before = JSON.stringify(rows), actual = map(rows, request);
      const expected = [rows[0],{...rows[1],to:request.effectiveAt},{meterId:request.meterId,sdpId:target,from:request.effectiveAt,to:null}];
      const normalize = (xs) => xs.map(x => JSON.stringify({meterId:x.meterId,sdpId:x.sdpId,from:x.from,to:x.to})).sort().join('|');
      if (normalize(actual) !== normalize(expected)) throw new Error('Mapping failed: outgoing end-date, target SDP, or unrelated association preservation (case '+i+')');
      if (JSON.stringify(rows) !== before) throw new Error('Mapping mutated its input');
      results.push('exchange-'+i);
    }
    return {passed:true, tests:results.length, cases:results};
  }`;
}
async function evaluate(compiled: string, expression: string) {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=128",
        path.resolve("services/code-lab/harness.cjs"),
      ],
      { env: { NODE_ENV: "test" }, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "",
      error = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Mapping evaluation exceeded two seconds"));
    }, 2000);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.length > 2000000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      error = (error + String(chunk)).slice(0, 10000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code) reject(new Error(error || "Mapping process failed"));
      else {
        try {
          resolve(JSON.parse(output));
        } catch {
          reject(new Error("Invalid mapping result"));
        }
      }
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(JSON.stringify({ compiled, expression }));
  });
}
createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/health") {
    response.end('{"ok":true}');
    return;
  }
  try {
    if (
      request.method !== "POST" ||
      !["/test", "/map"].includes(request.url ?? "")
    )
      throw new Error("Unsupported code-lab operation");
    let body = "";
    for await (const chunk of request) {
      body += String(chunk);
      if (body.length > 1100000) throw new Error("Request too large");
    }
    const input = inputSchema.parse(JSON.parse(body));
    const source = ts.createSourceFile(
      "mapping.ts",
      input.source,
      ts.ScriptTarget.ES2022,
      true,
    );
    if (
      source.statements.some(
        (s) =>
          ts.isImportDeclaration(s) ||
          ts.isImportEqualsDeclaration(s) ||
          ts.isExportDeclaration(s),
      )
    )
      throw new Error("Mapping artifacts must be self-contained");
    const result = ts.transpileModule(input.source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
      reportDiagnostics: true,
    });
    if (
      result.diagnostics?.some(
        (d) => d.category === ts.DiagnosticCategory.Error,
      )
    )
      throw new Error("Mapping source does not compile");
    const expression =
      request.url === "/test"
        ? expressionForTests()
        : `(map) => map(${JSON.stringify(input.associations ?? [])}, ${JSON.stringify(input.request ?? {})})`;
    const value = await evaluate(result.outputText, expression);
    if (request.url === "/map") association.array().max(1000).parse(value);
    response.end(
      JSON.stringify({
        result: value,
        sourceDigest: createHash("sha256").update(input.source).digest("hex"),
      }),
    );
  } catch (e) {
    response.statusCode = 422;
    response.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Evaluation failed",
      }),
    );
  }
}).listen(4100, "0.0.0.0", () =>
  console.log("Isolated code lab listening on 4100"),
);
