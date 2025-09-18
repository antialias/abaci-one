import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AbacusReact',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@react-spring/web',
        '@use-gesture/react',
        '@number-flow/react'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@react-spring/web': 'ReactSpring',
          '@use-gesture/react': 'UseGesture',
          '@number-flow/react': 'NumberFlow'
        }
      }
    }
  }
});