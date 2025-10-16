const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const napiDist = path.join(distRoot, 'NativeLibremon_NAPI');
const cliDist = path.join(distRoot, 'NativeLibremon_CLI');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// Move existing top-level dist files into CLI folder (preserve existing structure)
ensureDir(cliDist);
for (const entry of fs.readdirSync(distRoot, { withFileTypes: true })) {
  const name = entry.name;
  if (name === 'NativeLibremon_NAPI' || name === 'NativeLibremon_CLI') continue;
  const src = path.join(distRoot, name);
  const dst = path.join(cliDist, name);
  fs.renameSync(src, dst);
}

// Create NAPI minimal dist by copying build/Release from NativeLibremon_NAPI
ensureDir(napiDist);
const napiBuild = path.join(repoRoot, 'NativeLibremon_NAPI', 'build', 'Release');
if (fs.existsSync(napiBuild)) {
  function copyRecursive(s, d) {
    ensureDir(d);
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const sp = path.join(s, e.name);
      const dp = path.join(d, e.name);
      if (e.isDirectory()) copyRecursive(sp, dp);
      else fs.copyFileSync(sp, dp);
    }
  }
  copyRecursive(napiBuild, napiDist);
  console.log('Created', napiDist);
} else {
  console.warn('No NativeLibremon_NAPI build/Release found at', napiBuild);
}

console.log('Split dist into', cliDist, 'and', napiDist);
