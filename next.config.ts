import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['recharts', 'd3-scale', 'd3-array', 'd3-format', 'd3-interpolate', 'd3-path', 'd3-shape', 'd3-time', 'd3-time-format']
};

// Trigger restart
export default nextConfig;
