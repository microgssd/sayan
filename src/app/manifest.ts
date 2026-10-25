import type { MetadataRoute } from 'next';

// Lets Android and desktop Chrome install the site with your icon and colours.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sayan Dhar, full-stack developer',
    short_name: 'Sayan Dhar',
    description: 'Full-stack developer for SaaS, marketplaces, Web3 and ML products. Client billing portal.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0B14',
    theme_color: '#0B0B14',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
