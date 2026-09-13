# Vercel deployment

The camp app is hosted at **https://yamnaya.vercel.app**. The separate preview origin is **https://yamnaya-camps-preview.vercel.app**. The production database stores camp state and digest-checked rendered artifacts. Hermes, the worker, browser and Quarto sandbox run in Docker on the executor host; Vercel does not run persistent agents or executable documents.

## Configuration

Use a private, ignored `.env.camps.production` file with the camp operator/session/worker credentials and the production `CAMP_DATABASE_URL`. Set `CAMP_STORAGE=postgres`, `CAMP_ARTIFACT_STORAGE=postgres`, `CAMP_API_URL` and `CAMP_PUBLIC_URL` to the application origin, and `CAMP_PREVIEW_URL` to the preview origin. Share `CAMP_PREVIEW_SECRET` between the worker and Vercel. Provider and Discord/GitHub credentials belong only on the worker.

```bash
CAMP_ENV_FILE=.env.camps.production pnpm db:migrate
pnpm exec tsx scripts/camps/deploy-env.ts
vercel domains add yamnaya-camps-preview.vercel.app # one-time project domain setup
vercel deploy --prod --yes
docker compose --env-file .env.camps -f docker-compose.yml -f docker-compose.hosted.yml up -d --build worker hermes
```

The environment helper reads values privately and uploads only the server's allowlisted camp settings. It does not display secrets. The hosted Compose override directs the executor to Vercel while keeping model traffic and executable documents inside the Docker runtime. Register the preview hostname as a production project domain, not just a deployment alias, so Vercel assigns it on each production deploy and does not place its separate login in front of signed reports.

Signed previews are accepted only on the configured preview hostname and use a sandbox Content Security Policy. Rendered content cannot share the main application's origin. Artifact bytes are checked against their digest before streaming. PostgreSQL artifact storage is suitable for the bounded report workflow; large media collections should use an object-storage backend with the same provenance checks.

The local file and PostgreSQL modes remain available for development. When the executor uses the hosted override, create and operate camps through the hosted app. Production and local camp state are separate.

## Verification

```bash
CAMP_ENV_FILE=.env.camps.production pnpm test:e2e
```

This creates its own simulation camp, executes Quarto in the real sandbox and checks the hosted preview, image import, and revision approval behavior. It makes no paid model request and does not publish a GitHub site or send Discord messages. Live agents require a configured model provider. The executor host must remain available for queued jobs to run.
