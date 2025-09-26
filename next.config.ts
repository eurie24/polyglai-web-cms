import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['firebase', 'firebase-admin'],
    // Ensure server can import native/CommonJS modules
    serverComponentsExternalPackages: ['pdf-parse'] as any,
  },
  // Enable compression
  compress: true,
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  async rewrites() {
    return [
      { source: '/assets/:path*', destination: '/:path*' },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          // Add caching headers for better performance
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes cache for API routes
          },
        ],
      },
    ];
  },
};

export default nextConfig;
