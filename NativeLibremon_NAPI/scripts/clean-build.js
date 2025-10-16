const fs = require('fs');
const path = require('path');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    for (const f of fs.readdirSync(p)) rmrf(path.join(p, f));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
const build = path.join(repoRoot, 'NativeLibremon_NAPI', 'build');
const publish = path.join(repoRoot, 'managed', 'LibreHardwareMonitorBridge', 'bin', 'Release', 'net9.0', 'win-x64', 'publish-selfcontained');

console.log('Removing', build);
rmrf(build);
console.log('Removing', publish);
rmrf(publish);
console.log('Clean complete');
