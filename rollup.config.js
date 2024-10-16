import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'node_modules/pdfjs-dist/build/pdf.js',
  output: {
    file: 'public/pdf.js',
    format: 'iife',
    name: 'pdfjsLib'
  },
  plugins: [
    resolve(),
    commonjs()
  ]
};