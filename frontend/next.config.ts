import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { proxyClientMaxBodySize: "52mb" },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.PHOTO_API_URL ?? "http://localhost:5005"}/api/:path*` }];
  },
};

export default nextConfig;
