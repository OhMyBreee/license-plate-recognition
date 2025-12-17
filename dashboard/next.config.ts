import type { NextConfig } from "next";

console.log("NEXT CONFIG __dirname:", __dirname);

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
