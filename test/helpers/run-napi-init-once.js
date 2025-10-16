/*
 Runs a single N-API init/poll/shutdown cycle with a provided config.
 The config is passed via environment variable CONFIG_JSON to avoid CLI parsing ambiguity.
 Writes any native stderr output through, and prints a simple result line to stdout.
*/

const path = require('path');

function getDistIndex() {
  // Prefer dist build that app uses in production
  return path.resolve(__dirname, '..', '..', 'dist', 'NativeLibremon_NAPI', 'index.js');
}

async function main() {
  const raw = process.env.CONFIG_JSON || '{}';
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    console.error('CONFIG_JSON is not valid JSON:', e.message);
    process.exit(2);
  }

  const modPath = getDistIndex();
  let api;
  try {
    api = require(modPath);
  } catch (e) {
    console.error('Failed to require N-API index at', modPath, e && e.message ? `- ${e.message}` : '');
    process.exit(3);
  }

  try {
    await api.init(config);
    // do one poll to exercise path
    try { await api.poll(); } catch (_) {}
    await api.shutdown();
    // Print a machine-readable line for the parent
    process.stdout.write('INIT_OK\n');
  } catch (e) {
    process.stdout.write('INIT_FAIL\n');
    // Also emit the error to stderr for visibility
    console.error('Init error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
}

main();
