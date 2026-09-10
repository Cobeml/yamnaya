import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env", quiet: true });
const config: NextConfig = {
  transpilePackages: ["@yamnaya/core"],
  output: "standalone",
  poweredByHeader: false,
};
export default config;
