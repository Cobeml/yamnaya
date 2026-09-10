import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@yamnaya/core'], output: 'standalone', poweredByHeader: false };
export default config;
