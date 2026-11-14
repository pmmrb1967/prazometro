// Copia para apps/web/public/ocr/ os ficheiros do Tesseract.js (worker, núcleo WebAssembly e
// dados da língua portuguesa) e os descodificadores de imagem do pdf.js. Assim o OCR é
// servido pelo próprio Prazómetro, sem CDN externa.
// Corre antes do build e do dev da PWA. A pasta de destino está fora do Git.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/web/public/ocr');
const pkg = (name) => dirname(require.resolve(`${name}/package.json`, { paths: [root] }));

const files = [
  [join(pkg('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  ...['', 'simd-', 'relaxedsimd-'].map((v) => [
    join(pkg('tesseract.js-core'), `tesseract-core-${v}lstm.wasm.js`),
    `core/tesseract-core-${v}lstm.wasm.js`,
  ]),
  [
    join(pkg('@tesseract.js-data/por'), '4.0.0_best_int/por.traineddata.gz'),
    'lang/por.traineddata.gz',
  ],
  // Descodificadores do pdf.js para PDFs digitalizados: JBIG2 (muito usado por scanners e
  // conservatórias), JPEG 2000 e cor. Sem eles, as páginas saem em branco e o OCR não lê nada.
  ...[
    'jbig2.wasm',
    'jbig2_nowasm_fallback.js',
    'openjpeg.wasm',
    'openjpeg_nowasm_fallback.js',
    'qcms_bg.wasm',
  ].map((f) => [join(pkg('pdfjs-dist'), 'wasm', f), `pdfjs/${f}`]),
];

for (const [from, to] of files) {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(from, join(out, to));
}
console.log(`OCR: ${files.length} ficheiros copiados para apps/web/public/ocr`);
