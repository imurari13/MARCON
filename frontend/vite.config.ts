
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    build: {
      target: "es2020",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            gsap: [
              "gsap",
              "gsap/SplitText",
              "gsap/Flip",
              "gsap/Observer",
              "gsap/ScrambleTextPlugin",
              "gsap/DrawSVGPlugin"
            ]
          }
        }
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true
        }
      }
    }
  };
});
