import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env", quiet: true });
loadEnv({ path: process.env.CAMP_ENV_FILE ?? "../../.env.camps", quiet: true });
const config: NextConfig = {
  transpilePackages: ["@yamnaya/core", "three"],
  // Vercel's adapter packages functions; standalone output belongs to Docker.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
};
export default config;
