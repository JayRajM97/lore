/** @type {import('next').NextConfig} */
const nextConfig = {
  // mobile/ is an Expo app; keep it out of the Next build graph.
  webpack: (config) => config,
};

export default nextConfig;
