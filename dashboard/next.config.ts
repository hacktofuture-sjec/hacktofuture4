import type { NextConfig } from "next";
import path from "path";

const nextConfig: any = {
  /* config options here */
  experimental: {
    turbopack: {
      root: path.join(__dirname),
    }
  }
};

export default nextConfig;
