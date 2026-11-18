import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRequire = createRequire(join(project, 'apps/web/package.json'));
const tesseract = dirname(appRequire.resolve('tesseract.js/package.json'));
const coreRequire = createRequire(join(tesseract, 'package.json'));
const core = dirname(coreRequire.resolve('tesseract.js-core/package.json'));
const target = join(project, 'apps/web/public/ocr-assets');
const files = [];
async function copy(source, relative) {
  const destination = join(target, relative);
  const content = await readFile(source);
  await mkdir(dirname(destination), { recursive: true });
  try {
    const existing = await readFile(destination);
    if (!content.equals(existing)) await copyFile(source, destination);
  } catch {
    await copyFile(source, destination);
  }
  files.push({
    path: relative,
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  });
}
await mkdir(target, { recursive: true });
await copy(join(tesseract, 'dist/worker.min.js'), 'worker.min.js');
await copy(
  join(tesseract, 'dist/worker.min.js.LICENSE.txt'),
  'licenses/worker.LICENSE.txt',
);
for (const name of await readdir(core)) {
  if (/^tesseract-core.*-lstm\.wasm(?:\.js)?$/.test(name))
    await copy(join(core, name), 'core/' + name);
}
if (!files.some((file) => file.path === 'core/tesseract-core-lstm.wasm.js'))
  throw new Error('OCR core incomplete');
for (const [name, root] of [
  ['tesseract', tesseract],
  ['core', core],
]) {
  await copy(join(root, 'package.json'), 'licenses/' + name + '-package.json');
  for (const file of await readdir(root))
    if (/^(license|notice)(\..*)?$/i.test(file))
      await copy(join(root, file), 'licenses/' + name + '-' + file);
}
for (const language of ['eng', 'chi_tra']) {
  const root = dirname(
    appRequire.resolve('@tesseract.js-data/' + language + '/package.json'),
  );
  await copy(
    join(root, '4.0.0_best_int', language + '.traineddata.gz'),
    'lang/' + language + '.traineddata.gz',
  );
  await copy(
    join(root, 'package.json'),
    'licenses/' + language + '-package.json',
  );
  await copy(join(root, 'README.md'), 'licenses/' + language + '-README.md');
}
await writeFile(
  join(target, 'manifest.json'),
  JSON.stringify({ generator: 'prepare-ocr-assets-v1', files }, null, 2) + '\n',
);
console.log(
  'Prepared ' +
    files.length +
    ' same-origin OCR assets; ' +
    files.reduce((sum, file) => sum + file.bytes, 0) +
    ' bytes. No CDN required.',
);
