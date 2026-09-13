# Hosting options and the browser-test failure

The September 13 GitHub failure is a frontend refresh race, independent of Vercel. Its browser trace contains only `localhost:3110` requests. Discord disconnect returned 200 and later reads returned the new camp revision without a Discord binding. The old three-second interval began another refresh before the slow browser finished processing the previous read chain, invalidating every result. A separate failed run similarly failed to display a successfully created publication. Polls now wait until the previous poll completes; the client also avoids an unnecessary trailing-slash redirect on camp-list requests. A deliberately delayed response reproduces the original failure.

The Vercel account reported Hobby/active, no soft block, 20 recent ready deployments and HTTP 200 for the live homepage/session endpoint. This confirms availability, not remaining quota. The billing usage API returned 404 `costs_not_found`, so no usage percentage was verified. Check [the account usage dashboard](https://vercel.com/cobemls-projects/~/usage) for the actual counters. Vercel explains [Hobby limits](https://vercel.com/docs/plans/hobby) and [usage monitoring](https://vercel.com/docs/pricing/manage-and-optimize-usage). Recent Git pushes were paired with manual deployments; use one deployment path per commit going forward.

## Lowest disruption: keep the current services

Keep the local executor and current Vercel console while fixing the refresh bug. The deployment checks do not justify a hosting migration. Browser polling contributes requests while the console is open; close unused tabs. Fewer duplicate deployments conserve build allowance. No hosting upgrade or new deployment service is required for this fix.

## Operate through Discord temporarily

The worker, Hermes, PostgreSQL, browser and Quarto sandbox already run on this machine. In the production Compose configuration, the worker and Hermes call the local `web:3110` API. Research and Discord commands do not need an open dashboard or Vercel rendering the UI. Keep the local **web/API container** running: it owns authentication, job transitions and persistence even during operation without the visual frontend. Keep the machine online.

Turning off Vercel entirely would also remove the current public console and signed preview URLs. Before doing so, provide an operator-accessible preview origin and preserve exact-build approval; Discord messages alone are not a substitute for reviewing rendered publications. This option does not remove the separate Gemini/OpenAI budget guard.

## Move the console to Google Cloud

The existing Node/Next.js container could be adapted for Cloud Run with its configured listening port, secrets, public console origin and a separate preview hostname. It could continue using the existing authenticated local origin through the tunnel. This moves the frontend/API relay, while keeping agent execution and storage local.

[Cloud Run supports container deployment](https://docs.cloud.google.com/run/docs/deploying). Its [pricing](https://cloud.google.com/run/pricing) includes a free allowance but also metered compute, requests and networking. Google Cloud requires a [billing account](https://docs.cloud.google.com/free/docs/free-cloud-features); costs depend on region, uptime and traffic. No Google Cloud account, credits or cost estimate has been verified for this project.

## Move the entire stack to Google Cloud

A Compute Engine VM running the Compose services is closer to the current deployment than a direct move of the long-running agent stack to Cloud Run. It requires sizing RAM/CPU for Hermes, browsers and Quarto; migrating PostgreSQL, artifacts and Hermes profiles; updating secrets, tunnel/DNS and backups; and validating source retrieval, Discord, previews and publication receipts. Treat this as a separate migration with an explicit monthly hosting budget, not an assumed free-tier substitution. No Google Cloud resources were created or changed during this diagnosis.
