import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const secret = () => randomBytes(32).toString("hex");
await mkdir("runtime/camps", { recursive: true, mode: 0o700 });
try {
  await writeFile(
    ".env.camps",
    `# Camp runtime configuration. Values are private.\nCAMP_STORAGE=file\nCAMP_DATA_DIR=${process.cwd()}/runtime/camps\nCAMP_DATABASE_URL=postgres://camps:camps@127.0.0.1:5545/camps\nCAMP_OPERATOR_ID=operator\nCAMP_OPERATOR_PASSWORD=${secret()}\nCAMP_SESSION_SECRET=${secret()}\nCAMP_WORKER_TOKEN=${secret()}\nCAMP_RUNTIME_SECRET=${secret()}\nCAMP_MODEL_PROXY_URL=http://127.0.0.1:4112/v1\nCAMP_PREVIEW_SECRET=${secret()}\nCAMP_PUBLIC_URL=http://localhost:3110\nCAMP_API_URL=http://127.0.0.1:3110\nCAMP_PREVIEW_URL=http://127.0.0.1:4112\nCAMP_HERMES_URL=http://127.0.0.1:8765\nCAMP_BROWSER_URL=http://127.0.0.1:4113\nCAMP_SANDBOX_URL=http://127.0.0.1:4111\nCAMP_MODEL_BASE_URL=https://api.openai.com/v1\nCAMP_MODEL=gpt-6-astra\nCAMP_MODEL_API_MODE=chat_completions\nCAMP_MODEL_API_KEY=\nCAMP_GITHUB_TOKEN=\nCAMP_SLACK_BOT_TOKEN=\nCAMP_SLACK_APP_TOKEN=\nCAMP_SLACK_OPERATOR_IDS=\nCAMP_SEARCH_URL=http://127.0.0.1:8889\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created private .env.camps. Read CAMP_OPERATOR_PASSWORD there to sign in. Add provider and integration keys to enable live work.",
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  console.log(".env.camps already exists; preserved.");
}
