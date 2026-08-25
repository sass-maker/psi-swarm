import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const rootPackage = await readJson(path.join(repositoryRoot, 'package.json'));
const cliPackage = await readJson(path.join(repositoryRoot, 'cli/package.json'));
const tag =
  process.argv.slice(2).find((argument) => argument !== '--') ?? process.env.GITHUB_REF_NAME;

if (typeof cliPackage.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(cliPackage.version)) {
  throw new Error('cli/package.json must contain an exact semantic version');
}
if (rootPackage.version !== cliPackage.version) {
  throw new Error(
    `root package version ${String(rootPackage.version)} does not match CLI ${cliPackage.version}`
  );
}
if (tag && tag !== `v${cliPackage.version}`) {
  throw new Error(`release tag ${tag} does not match CLI v${cliPackage.version}`);
}

process.stdout.write(
  `${JSON.stringify({ version: cliPackage.version, tag: `v${cliPackage.version}` })}\n`
);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}
