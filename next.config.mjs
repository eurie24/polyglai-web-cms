/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Handle Firebase Auth deep links
      {
        source: '/__/auth/action',
        destination: '/auth/action',
      },
    ];
  },
};

export default nextConfig; 