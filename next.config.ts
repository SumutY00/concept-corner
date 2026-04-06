import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dssfmqljpfbqzbusmmcw.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Vercel'de output: 'standalone' GEREKMİYOR — Vercel kendi optimize eder
};

export default nextConfig;
