import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Strip console.* and debugger statements in production
      minify: isProd ? 'esbuild' : false,
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
            'vendor-rapier': ['@react-three/rapier'],
            'vendor-meshline': ['meshline'],
            'vendor-gsap': ['gsap'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu'],
            'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'vendor-query': ['@tanstack/react-query'],
          },
        },
      },
      sourcemap: !isProd,
      // Use esbuild to strip console/debugger in production
      ...(isProd && {
        esbuild: undefined, // keep default esbuild
      }),
    },
    esbuild: {
      // Strip console.log/debug/info and debugger in production builds
      ...(isProd && {
        drop: ['debugger'],
        pure: ['console.log', 'console.debug', 'console.info'],
      }),
    },
  };
});
