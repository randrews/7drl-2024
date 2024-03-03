require('esbuild').build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: false,
  outdir: 'build',
  format: 'esm',
  loader: {
    '.wasm': 'file'
  }
}).catch(() => process.exit(1))
