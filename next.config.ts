import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard dynamic rendering (no Cache Components) for an
  // authenticated, always-fresh ledger application.

  allowedDevOrigins: [
    "g1mtn1hx-3000.asse.devtunnels.ms",
  ],

  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "g1mtn1hx-3000.asse.devtunnels.ms",
        // Note: Do NOT include https:// or the port here, just the hostname.
      ],
    },
  },
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
