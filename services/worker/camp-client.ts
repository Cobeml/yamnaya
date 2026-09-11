import type { Camp, CampJob } from "@yamnaya/core";
export interface CampWork {
  camp: Camp;
  job: CampJob;
  token: string;
}
export const workerId = `camp-worker-${process.pid}`;
export async function campApi(route: string, data?: unknown, key?: string) {
  const response = await fetch(
    `${process.env.CAMP_API_URL}/api/camps/${route}`,
    {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${process.env.CAMP_WORKER_TOKEN}`,
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(25000),
    },
  );
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error ?? `Camp API ${response.status}`);
  return value.result ?? value;
}
export const checkWork = (work: CampWork) =>
  campApi(`${work.camp.id}/worker/check`, {
    jobId: work.job.id,
    owner: workerId,
  });
