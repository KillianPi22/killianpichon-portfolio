'use strict';
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'assets/avatar-viewer.source.js')],
  outfile: path.join(root, 'assets/avatar-viewer.js'),
  bundle: true, minify: true, format: 'esm', target: ['es2020'], legalComments: 'eof'
});
fs.copyFileSync(path.join(root, 'node_modules/three/LICENSE'), path.join(root, 'assets/profile/three-LICENSE.txt'));
console.log('Avatar viewer bundled locally.');
