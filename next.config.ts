import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: '/lil-face',  // GitHub Pages: shunnedy.github.io/lil-face

  webpack(config, { isServer }) {
    // Prevent TF.js packages from being bundled server-side during static export pre-rendering
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existing,
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-core',
        '@tensorflow/tfjs-backend-webgl',
        '@tensorflow/tfjs-backend-cpu',
        '@tensorflow/tfjs-converter',
        '@tensorflow-models/face-landmarks-detection',
        '@mediapipe/face_mesh',
      ];
    }
    return config;
  },
};

export default nextConfig;
