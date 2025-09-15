/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@soroban/core', '@soroban/client'],
    serverComponentsExternalPackages: ['@myriaddreamin/typst.ts'],
  },
  transpilePackages: ['@soroban/core', '@soroban/client'],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Fix for WASM modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })

    // Handle typst.ts WASM files specifically
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }

    return config
  },
}

module.exports = nextConfig