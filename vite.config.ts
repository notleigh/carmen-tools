import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  // Relative asset paths, so the build works from any URL path (e.g. a GitHub Pages subpath).
  base: "./",
  plugins: [preact()],
  build: { outDir: "../dist", emptyOutDir: true },
});
