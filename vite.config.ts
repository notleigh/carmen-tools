import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  // Relative asset paths, so the build works from any URL path (e.g. a GitHub Pages subpath).
  base: "./",
  plugins: [preact()],
  // File change events don't reach WSL from the Windows drive (/mnt/c), so poll.
  server: { watch: { usePolling: true } },
  build: { outDir: "../dist", emptyOutDir: true },
});
