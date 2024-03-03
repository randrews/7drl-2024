require('esbuild').build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: true,
  outdir: 'build',
  format: 'esm',
  loader: {
    '.wasm': 'file'
  }
}).catch(() => process.exit(1))
