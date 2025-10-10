/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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

    // Optimize WASM loading
    if (!isServer) {
      // Enable dynamic imports for better code splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Create separate chunk for WASM modules
            wasm: {
              test: /\.wasm$/,
              name: 'wasm',
              chunks: 'async',
              enforce: true,
            },
            // Separate typst.ts into its own chunk
            typst: {
              test: /[\\/]node_modules[\\/]@myriaddreamin[\\/]typst.*[\\/]/,
              name: 'typst',
              chunks: 'async',
              enforce: true,
            },
          },
        },
      }

      // Add preload hints for critical WASM files
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }

    // Fix for WASM modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })

    return config
  },
}

module.exports = nextConfig
