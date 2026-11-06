import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'app.js', 'sample-data.json', 'assets/jeju-landscape.svg'];

// Never copy raw CSV/PDF data or a whole workspace into the public output.
async function listFiles(directory, prefix = '') {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${relative}`);
      if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative + '/'));
      else result.push(relative);
    }
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const unexpected = (await listFiles(output)).filter(file => !files.includes(file));
if (unexpected.length) throw new Error(`Unexpected files in dist; review them before publishing: ${unexpected.join(', ')}`);
JSON.parse(await readFile(path.join(root, 'sample-data.json'), 'utf8'));
for (const file of files) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(output, file));
}
console.log(`Built ${files.length} public files in dist. No external dependencies required.`);
