/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/zed/:path*',
        destination: '/api/zed/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
