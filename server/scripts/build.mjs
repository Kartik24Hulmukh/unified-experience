import { build } from 'esbuild';
await build({
  entryPoints: ['src/server.ts'], bundle: true, platform: 'node', target: 'node20',
  format: 'cjs', outfile: 'dist/server.cjs', alias: { '@': './src' },
  // Native binaries and dynamic Fastify plugins must stay external. The shared
  // package ships TS and must be bundled, unlike registry dependencies.
  plugins: [{ name: 'external-packages', setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, args => {
      if (args.path.startsWith('@/') || args.path === '@berozgar/shared') return;
      return { path: args.path, external: true };
    });
  } }],
});
