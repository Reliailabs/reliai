import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "mdx"],
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ["@reliai/types"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
