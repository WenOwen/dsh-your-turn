// Same tsdown config, but collect output in memory. The caller writes only the three approved artifacts in-place.
import { build } from 'tsdown'
import config from '../tsdown.config.ts'
const artifacts = []
for (const item of config) {
  await build({ ...item, config: false, write: false, clean: false, logLevel: 'silent', hooks: { 'build:done': ({ chunks }) => {
    for (const chunk of chunks) artifacts.push({ name: chunk.fileName, content: chunk.type === 'chunk' ? chunk.code : String(chunk.source) })
  } } })
}
console.log('DSH_ARTIFACTS:' + JSON.stringify(artifacts))
