/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/settings/dismissed',
        destination: '/feed?showDismissed=true',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
