import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({ extension: /\.mdx?$/ });

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ["@reliai/types"],
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"]
};

export default withMDX(nextConfig);
