/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Project covers and your photo can live on any HTTPS host (Cloudinary, GitHub, S3...).
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: { serverComponentsExternalPackages: ['mongoose', 'bcryptjs'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
