import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:5000/api/:path*",
      },
      {
        source: "/hubs/:path*",
        destination: "http://127.0.0.1:5000/hubs/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:5000/health",
      },
    ];
  },
};

export default nextConfig;
