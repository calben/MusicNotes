import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative assets work on both a GitHub Pages project path and local hosting.
  base: "./",
  plugins: [react(), tailwindcss()],
});
