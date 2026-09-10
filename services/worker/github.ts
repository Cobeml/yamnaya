import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Run, Plan, EffectProof } from '../../packages/core/src/contracts';

async function github(route: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${route}`, { ...init, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${String(data.message ?? 'request failed')}`); return data;
}
export async function preparePatch(run: Run, plan: Plan, source: string): Promise<EffectProof> {
  const codeLab = process.env.CODE_LAB_URL ?? 'http://code-lab:4100';
  const test = await fetch(`${codeLab}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }), signal: AbortSignal.timeout(15000) });
  const result = await test.json() as { error?: string; result?: { passed: boolean; tests: number }; sourceDigest: string };
  if (!test.ok || !result.result?.passed) throw new Error(result.error ?? 'Mapping regression tests failed');
  const folder = path.join(process.env.YAMNAYA_ARTIFACT_DIR ?? 'runtime/artifacts', run.id, `${plan.id}-v${plan.version}`);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'mapping.ts'), source);
  await writeFile(path.join(folder, 'test-receipt.json'), JSON.stringify(result, null, 2));
  const proof: EffectProof = { sourceDigest: createHash('sha256').update(source).digest('hex'), testsPassed: true, message: `${result.result.tests} isolated mapping regression cases passed` };
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
    if (run.mode === 'live') throw new Error('Live code recovery requires GITHUB_TOKEN and GITHUB_REPOSITORY. Tested local patch was retained.');
    return proof;
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY)) throw new Error('Invalid GitHub repository');
  const base = `demo/incidents/${run.id.toLowerCase()}`, branch = `${base}-${plan.id.toLowerCase()}-v${plan.version}`;
  const repository = await github(''); const defaultBranch = String(repository.default_branch);
  const head = await github(`git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const sha = (head.object as { sha: string }).sha;
  // These refs are scoped to the incident, never the application's deployment branch.
  for (const name of [base, branch]) {
    try { await github(`git/ref/heads/${encodeURIComponent(name)}`); }
    catch (e) { if (!String(e).includes('404')) throw e; await github('git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${name}`, sha }) }); }
  }
  const file = 'demo/mapping.ts';
  async function put(ref: string, content: string, message: string) {
    let previous: string | undefined;
    try { const existing = await github(`contents/${file}?ref=${encodeURIComponent(ref)}`); previous = String(existing.sha); if (Buffer.from(String(existing.content), 'base64').toString() === content) return (existing.sha as string); }
    catch (e) { if (!String(e).includes('404')) throw e; }
    const out = await github(`contents/${file}`, { method: 'PUT', body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), branch: ref, ...(previous ? { sha: previous } : {}) }) });
    return (out.commit as { sha: string }).sha;
  }
  await put(base, run.artifacts.find(a => !a.trusted)!.source, `Seed synthetic incident ${run.id}`);
  proof.commit = await put(branch, source, `Restore effective-dated meter associations for ${run.id}`);
  const existingResponse = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls?head=${encodeURIComponent(process.env.GITHUB_REPOSITORY.split('/')[0] + ':' + branch)}&base=${encodeURIComponent(base)}&state=all`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
  if (!existingResponse.ok) throw new Error('Could not reconcile existing incident pull requests');
  const existing = await existingResponse.json() as { html_url: string }[];
  if (existing.length) proof.externalRef = existing[0].html_url;
  else {
    const pr = await github('pulls', { method: 'POST', body: JSON.stringify({ title: `Repair meter-exchange mappings (${run.id})`, head: branch, base, body: `The synthetic contractor revision leaves outgoing meters active and can assign replacement meters to another service point. This change restores the source service point and ends the outgoing relationship at the exchange effective date.\n\nValidation: ${result.result.tests} isolated regression cases passed, covering unrelated relationships, target service points, end dates, and input immutability.\n\nArtifact SHA-256: ${proof.sourceDigest}\nPlan: ${plan.id} v${plan.version}. This PR targets an isolated incident branch.` }) });
    proof.externalRef = String(pr.html_url);
  }
  return proof;
}
