import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(async () => {
  const { default: react } = await import("@vitejs/plugin-react");

  return {
    plugins: [react()],
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "AbacusReact",
        formats: ["es", "cjs"],
        fileName: (format) => `index.${format}.js`,
      },
      sourcemap: true,
      rollupOptions: {
        external: [
          "react",
          "react-dom",
          "@react-spring/web",
          "@use-gesture/react",
          "@number-flow/react",
        ],
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            "@react-spring/web": "ReactSpring",
            "@use-gesture/react": "UseGesture",
            "@number-flow/react": "NumberFlow",
          },
        },
      },
    },
  };
});
