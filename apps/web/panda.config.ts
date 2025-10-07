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
          card: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' },
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
      },
    },
  },
})
