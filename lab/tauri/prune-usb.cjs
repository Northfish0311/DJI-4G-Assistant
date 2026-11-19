const fs = require('node:fs');
const path = require('node:path');

function pruneUsbPrebuilds(payload) {
  const root = fs.realpathSync(payload);
  const prebuilds = fs.realpathSync(path.join(root, 'node_modules/usb/prebuilds'));
  const relative = path.relative(root, prebuilds);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('USB payload escapes staging directory');
  const entries = fs.readdirSync(prebuilds, {withFileTypes: true});
  if (!entries.some(e => e.name === 'win32-x64' && e.isDirectory())) throw Error('Missing win32-x64 USB prebuild');
  // Validate every deletion before changing the generated payload; never follow links.
  const removed = entries.filter(e => e.name !== 'win32-x64').map(e => {
    if (!e.isDirectory() || e.isSymbolicLink() || !/^(android|darwin|linux|win32)-[a-z0-9+-]+$/.test(e.name)) {
      throw Error('Unexpected USB prebuild entry');
    }
    const target = path.join(prebuilds, e.name);
    if (path.dirname(fs.realpathSync(target)) !== prebuilds) throw Error('USB prebuild escapes staging directory');
    return target;
  });
  for (const target of removed) fs.rmSync(target, {recursive: true});
  return removed.map(target => path.basename(target));
}

module.exports = {pruneUsbPrebuilds};
