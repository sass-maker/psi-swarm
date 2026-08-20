#!/usr/bin/env node
// validate-docs.mjs — lightweight docs validator for psi-swarm.
//
// Markdown under docs/ is the source of truth. This script keeps it trustworthy
// without depending on Blume (so CI can run it on a bare checkout). It checks:
//
//   1. Every docs/**/*.md file has YAML frontmatter with `title` and `description`.
//   2. Every relative Markdown link resolves to a file that exists (within docs/
//      or to repo-root files like ../PROJECT_STATUS.md, ../STATUS.md).
//   3. No docs/ subdirectory is empty (no placeholder folders).
//
// External http(s) links are NOT checked here — Blume's `blume validate --external`
// covers those when needed. Run this via `pnpm docs:check`.
//
// Exit code is non-zero if any problem is found, so it works as a CI gate.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(repoRoot, 'docs');

const requiredFrontmatter = ['title', 'description'];
const errors = [];
const warnings = [];
let checkedFiles = 0;
let checkedLinks = 0;

function listMarkdownFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

// Find empty directories under docs/ (placeholder folders violate the rules).
function findEmptyDirs(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    const children = readdirSync(full, { withFileTypes: true });
    const subdirs = children.filter((c) => c.isDirectory());
    const files = children.filter((c) => c.isFile());
    if (files.length === 0 && subdirs.length === 0) {
      acc.push(full);
    } else {
      findEmptyDirs(full, acc);
    }
  }
  return acc;
}

// Minimal YAML frontmatter parser — only reads the top `--- ... ---` block and
// extracts `key: value` lines. Sufficient for our required-fields check; we do
// not need a full YAML parser.
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

// Match Markdown links: [text](target)  — skip autolinks and code spans.
// We strip fenced code blocks first so links inside code samples are ignored.
function stripCodeFences(text) {
  return text.replace(/```[\s\S]*?```/g, '');
}

const linkRe = /(?<!\\)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function validateFile(file) {
  checkedFiles++;
  const rel = relative(repoRoot, file);
  const raw = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(raw);
  if (!fm) {
    errors.push(
      `${rel}: missing YAML frontmatter (expected ---\\ntitle: ...\\ndescription: ...\\n---)`
    );
  } else {
    for (const key of requiredFrontmatter) {
      if (!fm[key]) {
        errors.push(`${rel}: frontmatter is missing required \`${key}\``);
      }
    }
  }

  const body = stripCodeFences(raw);
  let m;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(body)) !== null) {
    const target = m[2];
    // Skip external links, mailto, and anchors-only links.
    if (/^(https?:|mailto:|tel:|ftp:)/i.test(target)) continue;
    if (target.startsWith('#')) continue;
    checkedLinks++;

    // Split off any trailing anchor (#section).
    const hashIdx = target.indexOf('#');
    const pathPart = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
    const anchor = hashIdx >= 0 ? target.slice(hashIdx + 1) : null;

    if (!pathPart) {
      // Pure anchor link — cannot validate without heading inventory; skip.
      continue;
    }

    // Resolve the link relative to the file it appears in.
    const resolved = resolve(dirname(file), pathPart);

    if (!existsSync(resolved)) {
      errors.push(
        `${rel}: broken link \`${target}\` — resolved path does not exist: ${relative(repoRoot, resolved) || '.'}`
      );
      continue;
    }

    // If there's an anchor, do a best-effort heading check against the target file.
    if (anchor && /\.(md)$/i.test(resolved)) {
      const targetText = readFileSync(resolved, 'utf8');
      // Match GitHub-style anchors: lowercased, spaces→hyphens, punctuation stripped.
      const headingRe = /^#{1,6}\s+(.+?)\s*$/gm;
      let found = false;
      let hm;
      headingRe.lastIndex = 0;
      while ((hm = headingRe.exec(targetText)) !== null) {
        // Match GitHub's anchor slug: lowercase, strip non-word/space/hyphen
        // chars, trim, then each whitespace char → one hyphen (GitHub does
        // NOT collapse runs, so "Todo / Planned" → "todo--planned").
        const slug = hm[1]
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s/g, '-');
        if (slug === anchor.toLowerCase()) {
          found = true;
          break;
        }
      }
      if (!found) {
        warnings.push(
          `${rel}: link \`${target}\` — anchor #${anchor} not found in ${relative(repoRoot, resolved)}`
        );
      }
    }
  }
}

// --- run ---
const mdFiles = listMarkdownFiles(docsRoot);
if (mdFiles.length === 0) {
  errors.push('no Markdown files found under docs/');
}

for (const file of mdFiles) validateFile(file);

for (const empty of findEmptyDirs(docsRoot)) {
  errors.push(`${relative(repoRoot, empty)}/: empty directory (no placeholder folders allowed)`);
}

console.log(`docs: checked ${checkedFiles} file(s), ${checkedLinks} internal link(s).`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (errors.length) {
  console.error(`\nFailed (${errors.length} error(s)):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log('docs: OK — frontmatter valid, internal links resolve, no empty folders.');
