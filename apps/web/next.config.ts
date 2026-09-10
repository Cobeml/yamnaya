import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env", quiet: true });
const config: NextConfig = {
  transpilePackages: ["@yamnaya/core"],
  // Vercel's adapter packages functions; standalone output belongs to Docker.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
};
export default config;
