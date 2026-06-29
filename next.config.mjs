/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('jose', 'jwks-rsa', 'firebase-admin');
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['jose', 'jwks-rsa', 'firebase-admin']
  }
};

export default nextConfig;
