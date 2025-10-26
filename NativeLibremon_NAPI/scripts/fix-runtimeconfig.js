const fs = require('fs');
const path = require('path');

// Fix the runtimeconfig.json to be truly self-contained
const repoRoot = path.resolve(__dirname, '..', '..');
const configPath = path.join(
  repoRoot,
  'managed',
  'LibreHardwareMonitorBridge',
  'bin',
  'Release',
  'net9.0',
  'win-x64',
  'publish-selfcontained',
  'LibreHardwareMonitorBridge.runtimeconfig.json'
);

if (!fs.existsSync(configPath)) {
  console.error('Runtime config not found:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Change includedFrameworks from array with Microsoft.NETCore.App to empty array
// This tells hostfxr to use the bundled runtime DLLs instead of searching for system installation
if (config.runtimeOptions && Array.isArray(config.runtimeOptions.includedFrameworks)) {
  const before = JSON.stringify(config.runtimeOptions.includedFrameworks);
  config.runtimeOptions.includedFrameworks = [];
  console.log('Fixed runtimeconfig.json:');
  console.log('  Before:', before);
  console.log('  After: []');
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('✓ Runtime config updated to be truly self-contained');
} else {
  console.log('⚠ Runtime config already correct or unexpected structure');
}
