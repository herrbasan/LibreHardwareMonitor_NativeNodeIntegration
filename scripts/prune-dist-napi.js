const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distNapi = path.join(repoRoot, 'dist', 'NativeLibremon_NAPI');

if (!fs.existsSync(distNapi)) {
  console.error('dist/NativeLibremon_NAPI not found at', distNapi);
  process.exit(2);
}

function rimrafSync(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    for (const e of fs.readdirSync(p)) rimrafSync(path.join(p, e));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

// Remove obj directory if present
const objDir = path.join(distNapi, 'obj');
if (fs.existsSync(objDir)) {
  console.log('Removing', objDir);
  rimrafSync(objDir);
}

// Remove large build intermediates at root: *.ipdb, *.iobj, *.lib, nothing.lib
const extPatterns = ['.ipdb', '.iobj', '.lib', '.exp'];
for (const f of fs.readdirSync(distNapi)) {
  const fp = path.join(distNapi, f);
  try {
    const st = fs.statSync(fp);
    if (st.isFile()) {
      const ext = path.extname(f).toLowerCase();
      if (extPatterns.includes(ext) || f === 'nothing.lib' || f === 'nothing.pdb') {
        console.log('Removing', fp);
        fs.unlinkSync(fp);
      }
    }
  } catch (err) {
    // ignore
  }
}

console.log('Prune complete. Remaining files:');
for (const entry of fs.readdirSync(distNapi)) console.log(' -', entry);
