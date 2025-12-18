import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ['./src/**/*.{js,jsx,ts,tsx}', './pages/**/*.{js,jsx,ts,tsx}'],

  // Files to exclude
  exclude: [],

  // The output directory for your css system
  outdir: 'styled-system',

  // The JSX framework to use
  jsxFramework: 'react',

  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {
            50: { value: '#f0f9ff' },
            100: { value: '#e0f2fe' },
            200: { value: '#bae6fd' },
            300: { value: '#7dd3fc' },
            400: { value: '#38bdf8' },
            500: { value: '#0ea5e9' },
            600: { value: '#0284c7' },
            700: { value: '#0369a1' },
            800: { value: '#075985' },
            900: { value: '#0c4a6e' },
          },
          soroban: {
            wood: { value: '#8B4513' },
            bead: { value: '#2C1810' },
            inactive: { value: '#D3D3D3' },
            bar: { value: '#654321' },
          },
        },
        fonts: {
          body: {
            value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          heading: {
            value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          mono: {
            value: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
          },
        },
        shadows: {
          card: {
            value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          modal: { value: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
        },
        animations: {
          // Shake animation for errors (web_generator.py line 3419)
          shake: { value: 'shake 0.5s ease-in-out' },
          // Pulse animation for success feedback (line 2004)
          successPulse: { value: 'successPulse 0.5s ease' },
          pulse: { value: 'pulse 2s infinite' },
          // Error shake with larger amplitude (line 2009)
          errorShake: { value: 'errorShake 0.5s ease' },
          // Bounce animations (line 6271, 5065)
          bounce: { value: 'bounce 1s infinite alternate' },
          bounceIn: { value: 'bounceIn 1s ease-out' },
          // Glow animation (line 6260)
          glow: { value: 'glow 1s ease-in-out infinite alternate' },
        },
      },
      // Semantic color tokens for light/dark theme support
      semanticTokens: {
        colors: {
          // Background colors
          'bg.canvas': {
            value: {
              base: '#ffffff',
              _dark: '#0f172a',
            },
          },
          'bg.surface': {
            value: {
              base: '#f8fafc',
              _dark: '#1e293b',
            },
          },
          'bg.subtle': {
            value: {
              base: '#f1f5f9',
              _dark: '#334155',
            },
          },
          'bg.muted': {
            value: {
              base: '#e2e8f0',
              _dark: '#475569',
            },
          },

          // Text colors
          'text.primary': {
            value: {
              base: '#0f172a',
              _dark: '#f1f5f9',
            },
          },
          'text.secondary': {
            value: {
              base: '#475569',
              _dark: '#cbd5e1',
            },
          },
          'text.muted': {
            value: {
              base: '#64748b',
              _dark: '#94a3b8',
            },
          },
          'text.inverse': {
            value: {
              base: '#ffffff',
              _dark: '#0f172a',
            },
          },

          // Border colors
          'border.default': {
            value: {
              base: '#e2e8f0',
              _dark: '#334155',
            },
          },
          'border.muted': {
            value: {
              base: '#f1f5f9',
              _dark: '#1e293b',
            },
          },
          'border.emphasis': {
            value: {
              base: '#cbd5e1',
              _dark: '#475569',
            },
          },

          // Accent colors (purple theme)
          'accent.default': {
            value: {
              base: '#7c3aed',
              _dark: '#a78bfa',
            },
          },
          'accent.emphasis': {
            value: {
              base: '#6d28d9',
              _dark: '#c4b5fd',
            },
          },
          'accent.muted': {
            value: {
              base: '#f5f3ff',
              _dark: 'rgba(139, 92, 246, 0.15)',
            },
          },
          'accent.subtle': {
            value: {
              base: '#ede9fe',
              _dark: 'rgba(139, 92, 246, 0.1)',
            },
          },

          // Interactive states
          'interactive.hover': {
            value: {
              base: '#f8fafc',
              _dark: '#334155',
            },
          },
          'interactive.active': {
            value: {
              base: '#f1f5f9',
              _dark: '#475569',
            },
          },
        },
      },
      keyframes: {
        // Shake - horizontal oscillation for errors (line 3419)
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        // Success pulse - gentle scale for correct answers (line 2004)
        successPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        // Pulse - continuous breathing effect (line 6255)
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        // Error shake - stronger horizontal oscillation (line 2009)
        errorShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-10px)' },
          '75%': { transform: 'translateX(10px)' },
        },
        // Bounce - vertical oscillation (line 6271)
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        // Bounce in - entry animation with scale and rotate (line 6265)
        bounceIn: {
          '0%': { transform: 'scale(0.3) rotate(-10deg)', opacity: '0' },
          '50%': { transform: 'scale(1.1) rotate(5deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // Glow - expanding box shadow (line 6260)
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.5)' },
          '100%': {
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 30px rgba(255, 255, 255, 0.6)',
          },
        },
        // Wiggle - playful rotation oscillation
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        // Shimmer - opacity wave for loading states
        shimmer: {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '0.4' },
        },
        // Fade in with scale - entrance animation
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Slide in from right - entrance animation
        slideInRight: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        // Morph width - bars dramatically expand and contract (simulating numbers changing)
        morphWidth: {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.7' },
          '25%': { transform: 'scaleX(0.5)', opacity: '0.4' },
          '50%': { transform: 'scaleX(1.3)', opacity: '0.9' },
          '75%': { transform: 'scaleX(0.7)', opacity: '0.5' },
        },
        // Color shift - operators cycle through hues
        colorShift: {
          '0%, 100%': { filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(20deg)' },
        },
        // Accordion slide down - expand content smoothly
        accordionSlideDown: {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        // Accordion slide up - collapse content smoothly
        accordionSlideUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },

  // Enable dark mode support via data-theme attribute
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &, .dark &',
      light: '[data-theme="light"] &, .light &',
    },
  },
})
