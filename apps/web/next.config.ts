import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ["@reliai/types"]
};

export default nextConfig;
