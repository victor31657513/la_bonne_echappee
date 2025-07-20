import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const versionJsonPath = join(root, 'version.json');
writeFileSync(versionJsonPath, JSON.stringify({ version: pkg.version }, null, 2) + '\n');
