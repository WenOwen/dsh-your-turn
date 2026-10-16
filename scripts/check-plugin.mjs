#!/usr/bin/env node
// Repository-local, cross-platform checks for the actual distributable.
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const read = (path) => readFileSync(path, 'utf8')
const covered = (path) => pkg.files.some((entry) => path === entry || path.startsWith(`${entry}/`))
assert.equal(pkg.name, '@wu5/dsh-your-turn')
assert.ok(pkg.dsh.bundle && !pkg.dsh.profile, 'Expected an installable DSH bundle')
assert.equal(pkg.dsh.client.platform, 'web')
for (const path of [pkg.main, pkg.exports['.'].types, pkg.exports['./client'], pkg.dsh.bundle.patch]) {
  assert.ok(statSync(path).isFile(), `Missing artifact: ${path}`)
  assert.ok(covered(path.replace(/^\.\//, '')), `Artifact not included in files: ${path}`)
}
const patch = read(pkg.dsh.bundle.patch)
assert.ok(patch.includes(`name: '${pkg.name}'`), 'Patch package name mismatch')
const client = read(pkg.exports['./client'])
assert.ok(client.includes('window.__ModuleLoader__.load('), 'Missing ModuleLoader wrapper')
assert.ok(client.includes(`id: ${JSON.stringify(pkg.name)}`), 'ModuleLoader ID mismatch')
const baseline = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-store',
])
const declared = new Set(pkg.dsh.client.external ?? [])
for (const [, specifier] of client.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
  assert.ok(baseline.has(specifier) || declared.has(specifier), `Undeclared client external: ${specifier}`)
}
const host = await import(pathToFileURL(resolve(pkg.main)).href)
assert.equal(host.name, pkg.name)
assert.ok(host.Config, 'Host must export its configuration schema')
assert.equal(typeof host.apply, 'function')
console.log(`Plugin contract OK: ${pkg.name}@${pkg.version}`)
