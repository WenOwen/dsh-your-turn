/**
 * Dual bundle: a Node ESM Host half and a browser CJS Client half wrapped as a
 * Harness ModuleLoader module.
 *
 * Two invariants this file is responsible for:
 *
 * 1. The ModuleLoader id is exactly the package name, and every module the
 *    browser factory may `require` is either a Harness Web baseline word or
 *    inlined. The set is asserted after the build by `tests/bundle.test.ts`.
 * 2. The whole factory body runs inside a `try`. The Web shell does not isolate
 *    loader-entry factories — one throwing factory aggregates into "Failed to
 *    load plugins" and takes the page down — so a bundle that cannot resolve its
 *    platform words degrades to an inert module with one console warning.
 *
 * @see {@link https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md}
 */

import { defineConfig } from 'tsdown'

const id = 'dsh-your-turn'

/**
 * Modules the Web shell's ModuleLoader already holds, from the shell's platform
 * seed table (`@deepseek-ai/dsh-web-frontend`). They stay external so the bundle
 * shares the shell's React instance and the shell's UI primitives rather than
 * shipping a second copy.
 */
const baselineExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    clean: false,
    dts: true,
    sourcemap: false,
    // The package is `"type": "module"`, so the Host entry must be `lib/index.js`
    // (what `main` and the Cordis patch resolve) with a sibling `index.d.ts` —
    // not tsdown's `.mjs`/`.d.mts` default for an ambiguous package type.
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    clean: false,
    sourcemap: false,
    deps: {
      neverBundle: baselineExternals,
      alwaysBundle: (specifier: string) => (baselineExternals.includes(specifier) ? undefined : true),
      onlyBundle: false,
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => { try {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer:
        '} catch (error) { ' +
        `console.error(${JSON.stringify('[dsh-your-turn] the client bundle failed to initialise; the plugin is inert')}, error); ` +
        `return { name: ${JSON.stringify(id)}, inject: [], apply() {} }; ` +
        '} return module.exports; } });',
    },
  },
])
