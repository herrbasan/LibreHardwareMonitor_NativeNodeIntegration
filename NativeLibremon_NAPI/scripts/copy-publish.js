const fs = require('fs');
const path = require('path');

// repo root is two levels up from this scripts folder
const repoRoot = path.resolve(__dirname, '..', '..');
const src = path.join(repoRoot, 'managed', 'LibreHardwareMonitorBridge', 'bin', 'Release', 'net9.0', 'win-x64', 'publish-selfcontained');
const dst = path.join(repoRoot, 'NativeLibremon_NAPI', 'build', 'Release');

if (!fs.existsSync(src)) {
  console.error('Publish folder not found:', src);
  process.exit(2);
}

function copyRecursive(srcDir, dstDir) {
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyRecursive(srcPath, dstPath);
    else fs.copyFileSync(srcPath, dstPath);
  }
}

console.log('Copying publish files from', src, 'to', dst);
copyRecursive(src, dst);
// Try to copy nethost.dll from local dotnet packs (not always present in publish)
try {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const packsRoot = path.join(programFiles, 'dotnet', 'packs', 'Microsoft.NETCore.App.Host.win-x64');
  if (fs.existsSync(packsRoot)) {
    const versions = fs.readdirSync(packsRoot).filter(d => fs.statSync(path.join(packsRoot, d)).isDirectory()).sort();
    // prefer highest version
    for (let i = versions.length - 1; i >= 0; i--) {
      const candidate = path.join(packsRoot, versions[i], 'runtimes', 'win-x64', 'native', 'nethost.dll');
      if (fs.existsSync(candidate)) {
        const dstPath = path.join(dst, 'nethost.dll');
        fs.copyFileSync(candidate, dstPath);
        console.log('Copied nethost.dll from', candidate, 'to', dstPath);
        break;
      }
    }
  } else {
    console.warn('Dotnet packs folder not found, skipping nethost.dll copy:', packsRoot);
  }
} catch (err) {
  console.warn('Failed to copy nethost.dll automatically:', err && err.message);
}
console.log('Done');
