#!/usr/bin/env node
// Self-validation for the canonical agent docs.
// Run: npm run agents:check        (informational)
//      npm run agents:check --ci   (also fail on dirty git tree)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ci = process.argv.includes('--ci')

const KNOWN_ROOTS = new Set([
  'src',
  'public',
  'scripts',
  'supabase',
  'ios',
  'android',
  'node_modules',
  'dist',
  '.github',
])
const KNOWN_ROOT_FILES = new Set([
  'AGENTS.md',
  'DECISIONS.md',
  'IMPLEMENTATION.md',
  'README.md',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'vitest.config.ts',
  'capacitor.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'eslint.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'index.html',
])

function looksLikePath(s) {
  if (!s) return false
  if (s.startsWith('http')) return false
  if (s.startsWith('@')) return false
  if (s.startsWith('/')) return false
  if (s.includes('*')) return false
  if (/\s/.test(s)) return false
  const firstSeg = s.split('/')[0]
  if (KNOWN_ROOTS.has(firstSeg)) return true
  if (KNOWN_ROOT_FILES.has(s)) return true
  return false
}

function* walk(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) yield* walk(p)
    else yield p
  }
}

const errors = []
const warnings = []

function read(p) {
  try {
    return readFileSync(join(ROOT, p), 'utf8')
  } catch {
    errors.push(`missing file: ${p}`)
    return ''
  }
}

// 1. The three canonical docs must exist.
for (const f of ['AGENTS.md', 'DECISIONS.md', 'IMPLEMENTATION.md']) {
  if (!existsSync(join(ROOT, f))) errors.push(`canonical doc missing: ${f}`)
}

// 2. Every file path mentioned in IMPLEMENTATION.md must exist on disk.
const impl = read('IMPLEMENTATION.md')
const pathRe = /`([^`\n]+?)`/g
const mentioned = new Set()
let m
while ((m = pathRe.exec(impl)) !== null) {
  const candidate = m[1].trim()
  if (looksLikePath(candidate)) mentioned.add(candidate)
}
for (const p of mentioned) {
  if (!existsSync(join(ROOT, p))) {
    errors.push(`IMPLEMENTATION.md references missing path: ${p}`)
  }
}

// 3. Every file path mentioned in AGENTS.md in backticks must exist (or be a
//    glob-y conceptual path — we only validate leaves that have an extension).
const agents = read('AGENTS.md')
while ((m = pathRe.exec(agents)) !== null) {
  const candidate = m[1].trim()
  if (looksLikePath(candidate) && /\.[a-z0-9]+$/i.test(candidate)) {
    if (!existsSync(join(ROOT, candidate))) {
      warnings.push(`AGENTS.md references missing path: ${candidate}`)
    }
  }
}

// 4. DECISIONS.md must not contain draft markers.
const dec = read('DECISIONS.md')
const draftHits = dec
  .split('\n')
  .filter((l) => /\b(TODO|DRAFT|TBD|FIXME):/i.test(l))
for (const line of draftHits) {
  errors.push(`DECISIONS.md has unclosed draft marker: ${line.trim()}`)
}

// 5. Warn on stray console.log in src/.
for (const file of walk(join(ROOT, 'src'))) {
  if (!/\.(ts|tsx)$/.test(file)) continue
  if (/\.test\.(ts|tsx)$/.test(file)) continue
  const body = readFileSync(file, 'utf8')
  const lines = body.split('\n')
  lines.forEach((line, i) => {
    if (/^\s*console\.log\(/.test(line)) {
      warnings.push(`console.log in ${relative(ROOT, file)}:${i + 1}`)
    }
  })
}

// 6. CI mode — fail on dirty git tree.
if (ci) {
  try {
    const dirty = execSync('git status --porcelain', { cwd: ROOT })
      .toString()
      .trim()
    if (dirty) errors.push(`--ci: git tree is dirty:\n${dirty}`)
  } catch (e) {
    warnings.push(`git status failed: ${e.message}`)
  }
}

// Report.
if (warnings.length) {
  console.warn('\nagents:check — warnings:')
  for (const w of warnings) console.warn('  · ' + w)
}
if (errors.length) {
  console.error('\nagents:check — errors:')
  for (const e of errors) console.error('  ✗ ' + e)
  process.exit(1)
}
console.log(
  `agents:check — ok${warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''}`,
)
