const createNextIntlPlugin = require('next-intl/plugin')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable source maps in production for easier debugging
  productionBrowserSourceMaps: true,

  // Generate unique build ID for cache busting
  generateBuildId: async () => {
    // Use git commit hash if available, otherwise timestamp
    const { execSync } = require('child_process')
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return `build-${Date.now()}`
    }
  },

  // Configure cache headers for static assets
  async headers() {
    return [
      {
        // Static assets with content hash - cache forever (immutable)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Build manifest and other _next files without hash
        source: '/_next/:path((?!static).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // HTML pages - don't cache (or very short cache)
        source: '/:path((?!_next|api).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ]
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      // Internal packages
      '@soroban/core',
      '@soroban/client',
      // Icon libraries (HUGE impact - these bundle everything otherwise)
      'lucide-react',
      // Animation libraries
      'framer-motion',
      // Radix UI components
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      // TanStack
      '@tanstack/react-query',
      '@tanstack/react-form',
      '@tanstack/react-virtual',
    ],
    serverComponentsExternalPackages: ['@myriaddreamin/typst.ts', 'sharp'],
  },
  transpilePackages: ['@soroban/core', '@soroban/client', '@svg-maps/world', '@svg-maps/usa'],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Exclude native Node.js modules from client bundle
    // canvas is a jscanify dependency only needed for Node.js, not browser
    if (!isServer) {
      config.externals = [...(config.externals || []), 'canvas']
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

module.exports = withBundleAnalyzer(withNextIntl(nextConfig))
