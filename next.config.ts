import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  async rewrites() {
    return [{ source: '/frame', destination: '/frame/index.html' }];
  },
};

export default nextConfig;
