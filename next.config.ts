import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: "**",
          },
        ]
      : [],
  },
};

export default nextConfig;
