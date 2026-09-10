import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import {
  approvedSource,
  compromisedSource,
} from "../packages/core/src/mapping";
function run(source: string, expression: string) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  return JSON.parse(
    execFileSync(process.execPath, ["services/code-lab/harness.cjs"], {
      input: JSON.stringify({ compiled, expression }),
      timeout: 2000,
      env: { NODE_ENV: "test" },
      stdio: ["pipe", "pipe", "pipe"],
    }).toString(),
  );
}
describe("isolated mapping execution", () => {
  const expression = `(map) => map([{meterId:'OTHER',sdpId:'B',from:'2026-01-01',to:null},{meterId:'OLD',sdpId:'A',from:'2026-01-01',to:null}],{sdpId:'A',oldMeterId:'OLD',meterId:'NEW',effectiveAt:'2026-09-10'})`;
  it("executes the actual corrected source, preserving unrelated assets and closing the outgoing association", () => {
    const result = run(approvedSource, expression);
    expect(result[0]).toEqual({
      meterId: "OTHER",
      sdpId: "B",
      from: "2026-01-01",
      to: null,
    });
    expect(result[1].to).toBe("2026-09-10");
    expect(result[2].sdpId).toBe("A");
    expect(run(compromisedSource, expression)[2].sdpId).toBe("B");
  });
  it("limits evaluation time and does not expose process or require", () => {
    expect(() =>
      run("export function mapExchange(){while(true){}}", "(map)=>map()"),
    ).toThrow();
    expect(() =>
      run("export function mapExchange(){return process.env}", "(map)=>map()"),
    ).toThrow();
    expect(() =>
      run(
        'export function mapExchange(){return require("node:fs")}',
        "(map)=>map()",
      ),
    ).toThrow();
  });
});
