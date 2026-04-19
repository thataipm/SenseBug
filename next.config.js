/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'xlsx'],
  },
}

module.exports = nextConfig
