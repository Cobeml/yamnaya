import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse } from "dotenv";

await mkdir("runtime", { recursive: true });
if (!existsSync(".env")) {
  const template = await readFile(".env.example", "utf8");
  const keys = [
    "SESSION_SECRET",
    "DEMO_SECURITY_PASSWORD",
    "DEMO_PLATFORM_PASSWORD",
    "DEMO_OPERATIONS_PASSWORD",
    "DEFENDER_TOKEN",
    "ATTACKER_TOKEN",
    "WORKER_TOKEN",
    "OPENCLAW_GATEWAY_TOKEN",
  ];
  let content = template;
  for (const key of keys)
    content = content.replace(
      new RegExp(`^${key}=$`, "m"),
      `${key}=${randomBytes(24).toString("hex")}`,
    );
  await writeFile(".env", content, { mode: 0o600 });
  console.log(
    "Created .env with unique local passwords and service tokens. External credentials remain unset.",
  );
} else console.log("Preserved existing .env.");
const env = parse(await readFile(".env"));
const secrets = [
  "SESSION_SECRET",
  "DEMO_SECURITY_PASSWORD",
  "DEMO_PLATFORM_PASSWORD",
  "DEMO_OPERATIONS_PASSWORD",
  "DEFENDER_TOKEN",
  "ATTACKER_TOKEN",
  "WORKER_TOKEN",
];
const missing = secrets.filter((key) => !env[key]);
if (missing.length)
  throw new Error(`Missing local configuration: ${missing.join(", ")}`);
console.log(
  "Role passwords are in .env. Start local services with: docker compose --profile local up -d --build",
);
