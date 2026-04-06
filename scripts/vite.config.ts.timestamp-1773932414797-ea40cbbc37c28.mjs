// vite.config.ts
import { defineConfig } from "file:///C:/Users/kadam/OneDrive/Desktop/Unified-Experience/unified-experience/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/kadam/OneDrive/Desktop/Unified-Experience/unified-experience/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/kadam/OneDrive/Desktop/Unified-Experience/unified-experience/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\kadam\\OneDrive\\Desktop\\Unified-Experience\\unified-experience";
var vite_config_default = defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    server: {
      host: true,
      port: 8080,
      hmr: {
        overlay: false
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      // Strip console.* and debugger statements in production
      minify: isProd ? "esbuild" : false,
      target: "es2020",
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-three-core": ["three", "@react-three/fiber"],
            "vendor-drei": ["@react-three/drei"],
            "vendor-rapier": ["@react-three/rapier"],
            "vendor-meshline": ["meshline"],
            "vendor-gsap": ["gsap"],
            "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-tooltip", "@radix-ui/react-dropdown-menu"],
            "vendor-form": ["react-hook-form", "@hookform/resolvers", "zod"],
            "vendor-query": ["@tanstack/react-query"]
          }
        }
      },
      sourcemap: !isProd,
      // Use esbuild to strip console/debugger in production
      ...isProd && {
        esbuild: void 0
        // keep default esbuild
      }
    },
    esbuild: {
      // Strip console.log/debug/info/warn and debugger in production builds
      ...isProd && {
        drop: ["debugger"],
        pure: ["console.log", "console.debug", "console.info", "console.warn", "console.error"]
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxrYWRhbVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXFVuaWZpZWQtRXhwZXJpZW5jZVxcXFx1bmlmaWVkLWV4cGVyaWVuY2VcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGthZGFtXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcVW5pZmllZC1FeHBlcmllbmNlXFxcXHVuaWZpZWQtZXhwZXJpZW5jZVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMva2FkYW0vT25lRHJpdmUvRGVza3RvcC9VbmlmaWVkLUV4cGVyaWVuY2UvdW5pZmllZC1leHBlcmllbmNlL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgaXNQcm9kID0gbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IHRydWUsXHJcbiAgICAgIHBvcnQ6IDgwODAsXHJcbiAgICAgIGhtcjoge1xyXG4gICAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTozMDAxJyxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgLy8gU3RyaXAgY29uc29sZS4qIGFuZCBkZWJ1Z2dlciBzdGF0ZW1lbnRzIGluIHByb2R1Y3Rpb25cclxuICAgICAgbWluaWZ5OiBpc1Byb2QgPyAnZXNidWlsZCcgOiBmYWxzZSxcclxuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItdGhyZWUtY29yZSc6IFsndGhyZWUnLCAnQHJlYWN0LXRocmVlL2ZpYmVyJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItZHJlaSc6IFsnQHJlYWN0LXRocmVlL2RyZWknXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci1yYXBpZXInOiBbJ0ByZWFjdC10aHJlZS9yYXBpZXInXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci1tZXNobGluZSc6IFsnbWVzaGxpbmUnXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci1nc2FwJzogWydnc2FwJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItdWknOiBbJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLCAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLCAnQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXAnLCAnQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnUnXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci1mb3JtJzogWydyZWFjdC1ob29rLWZvcm0nLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICd6b2QnXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci1xdWVyeSc6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHNvdXJjZW1hcDogIWlzUHJvZCxcclxuICAgICAgLy8gVXNlIGVzYnVpbGQgdG8gc3RyaXAgY29uc29sZS9kZWJ1Z2dlciBpbiBwcm9kdWN0aW9uXHJcbiAgICAgIC4uLihpc1Byb2QgJiYge1xyXG4gICAgICAgIGVzYnVpbGQ6IHVuZGVmaW5lZCwgLy8ga2VlcCBkZWZhdWx0IGVzYnVpbGRcclxuICAgICAgfSksXHJcbiAgICB9LFxyXG4gICAgZXNidWlsZDoge1xyXG4gICAgICAvLyBTdHJpcCBjb25zb2xlLmxvZy9kZWJ1Zy9pbmZvL3dhcm4gYW5kIGRlYnVnZ2VyIGluIHByb2R1Y3Rpb24gYnVpbGRzXHJcbiAgICAgIC4uLihpc1Byb2QgJiYge1xyXG4gICAgICAgIGRyb3A6IFsnZGVidWdnZXInXSxcclxuICAgICAgICBwdXJlOiBbJ2NvbnNvbGUubG9nJywgJ2NvbnNvbGUuZGVidWcnLCAnY29uc29sZS5pbmZvJywgJ2NvbnNvbGUud2FybicsICdjb25zb2xlLmVycm9yJ10sXHJcbiAgICAgIH0pLFxyXG4gICAgfSxcclxuICB9O1xyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErWSxTQUFTLG9CQUFvQjtBQUM1YSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBSGhDLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sU0FBUyxTQUFTO0FBRXhCLFNBQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxRQUNILFNBQVM7QUFBQSxNQUNYO0FBQUEsTUFDQSxPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsUUFDVjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLFNBQVMsaUJBQWlCLGdCQUFnQixDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQUEsSUFDOUUsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3RDO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUEsTUFFTCxRQUFRLFNBQVMsWUFBWTtBQUFBLE1BQzdCLFFBQVE7QUFBQSxNQUNSLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxZQUNaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxZQUN6RCxxQkFBcUIsQ0FBQyxTQUFTLG9CQUFvQjtBQUFBLFlBQ25ELGVBQWUsQ0FBQyxtQkFBbUI7QUFBQSxZQUNuQyxpQkFBaUIsQ0FBQyxxQkFBcUI7QUFBQSxZQUN2QyxtQkFBbUIsQ0FBQyxVQUFVO0FBQUEsWUFDOUIsZUFBZSxDQUFDLE1BQU07QUFBQSxZQUN0QixhQUFhLENBQUMsMEJBQTBCLDJCQUEyQiwyQkFBMkIsK0JBQStCO0FBQUEsWUFDN0gsZUFBZSxDQUFDLG1CQUFtQix1QkFBdUIsS0FBSztBQUFBLFlBQy9ELGdCQUFnQixDQUFDLHVCQUF1QjtBQUFBLFVBQzFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFdBQVcsQ0FBQztBQUFBO0FBQUEsTUFFWixHQUFJLFVBQVU7QUFBQSxRQUNaLFNBQVM7QUFBQTtBQUFBLE1BQ1g7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTO0FBQUE7QUFBQSxNQUVQLEdBQUksVUFBVTtBQUFBLFFBQ1osTUFBTSxDQUFDLFVBQVU7QUFBQSxRQUNqQixNQUFNLENBQUMsZUFBZSxpQkFBaUIsZ0JBQWdCLGdCQUFnQixlQUFlO0FBQUEsTUFDeEY7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
