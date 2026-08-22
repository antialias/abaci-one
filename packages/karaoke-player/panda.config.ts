import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: false,
  jsxFramework: "react",
  include: ["./src/**/*.{ts,tsx}"],
  exclude: ["./src/**/*.test.{ts,tsx}"],
  outdir: "styled-system",
  prefix: "tk",
});
