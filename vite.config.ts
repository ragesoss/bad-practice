import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname!, "index.html"),
        metronome: resolve(import.meta.dirname!, "metronome/index.html"),
        drone: resolve(import.meta.dirname!, "drone/index.html"),
      },
    },
  },
});
