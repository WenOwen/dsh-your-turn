import { describe, expect, it } from 'vitest'
// @ts-expect-error Release helper is a plain Node.js module without declarations.
import { releasePlan } from '../scripts/release-plan.mjs'

describe('release plan', () => {
  it('publishes stable releases to latest', () => {
    expect(releasePlan('v0.1.1', '0.1.1')).toEqual({ tag: 'v0.1.1', version: '0.1.1', distTag: 'latest' })
  })
  it('keeps prereleases off latest', () => {
    expect(releasePlan('v0.2.0-rc.1', '0.2.0-rc.1').distTag).toBe('next')
  })
  it('rejects a tag that does not match the package version', () => {
    expect(() => releasePlan('v0.1.2', '0.1.1')).toThrow('must match')
  })
  it('requires a version tag', () => {
    expect(() => releasePlan('master', '0.1.1')).toThrow('must match')
  })
  it('rejects invalid package versions', () => {
    expect(() => releasePlan('vlatest', 'latest')).toThrow('Unsupported')
  })
})
