const dev = true
require('esbuild').build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: !dev,
  sourcemap: dev,
  outdir: 'build',
  format: 'esm',
  loader: {
    '.wasm': 'file'
  }
}).catch(() => process.exit(1))
