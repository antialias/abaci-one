/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@soroban/core', '@soroban/client'],
  },
  transpilePackages: ['@soroban/core', '@soroban/client'],
}

module.exports = nextConfig