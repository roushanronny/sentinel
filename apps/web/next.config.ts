import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['argon2', '@prisma/client', 'prisma'],
};

export default nextConfig;
