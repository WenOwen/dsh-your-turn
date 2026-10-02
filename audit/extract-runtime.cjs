const fs = require('fs');
const path = require('path');
const base = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const out = path.resolve(__dirname, 'runtime');
fs.mkdirSync(out, { recursive: true });
const targets = {
  'primitives.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js',
  'layout.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js',
  'renderer.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js',
  'desktop-host.js': 'dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js',
  'desktop-main.js': 'lib/main.js',
  'app-package.json': 'package.json',
  'ui-session.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-session/lib/client.js',
  'ui-chat.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js',
  'ui-settings-account.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js',
  'modal.css': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/Modal.module.css',
  'ui-user-questions.js': 'dsh/node_modules/@deepseek-ai/dsh-client-ui-user-questions/lib/client.js'
};
for (const [name, target] of Object.entries(targets)) {
  const data = fs.readFileSync(base + '/' + target);
  fs.writeFileSync(path.join(out, name), data);
  console.log(name, data.length);
}
