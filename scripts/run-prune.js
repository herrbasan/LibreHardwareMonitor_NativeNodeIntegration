const { spawnSync } = require('child_process');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'scripts', 'prune-dist-napi.js');
const res = spawnSync(process.execPath, [script], { stdio: 'inherit' });
process.exit(res.status);
