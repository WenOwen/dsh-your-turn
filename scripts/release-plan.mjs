import assert from 'node:assert/strict'
import { readFileSync, appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function releasePlan(tag, version) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Unsupported package version')
  assert.equal(tag, `v${version}`, `Tag ${tag} must match package.json version v${version}`)
  return { tag, version, distTag: version.includes('-') ? 'next' : 'latest' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const plan = releasePlan(process.argv[2], pkg.version)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `tag=${plan.tag}\nversion=${plan.version}\ndist-tag=${plan.distTag}\n`)
  }
  console.log(JSON.stringify(plan))
}
