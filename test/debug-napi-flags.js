// Spawns the helper with various configurations to observe native flag parsing.
const { spawnSync } = require('child_process');
const path = require('path');

const helper = path.resolve(__dirname, 'helpers', 'run-napi-init-once.js');

const cases = [
  { name: 'booleans_off', cfg: { cpu: true, gpu: true, storage: false } },
  { name: 'booleans_on', cfg: { cpu: true, gpu: true, storage: true } },
  { name: 'strings_false', cfg: { cpu: true, gpu: true, storage: 'false' } },
  { name: 'strings_true', cfg: { cpu: true, gpu: true, storage: 'true' } },
  { name: 'numbers_zero', cfg: { cpu: true, gpu: true, storage: 0 } },
  { name: 'numbers_one', cfg: { cpu: true, gpu: true, storage: 1 } },
  { name: 'empty_string', cfg: { cpu: true, gpu: true, storage: '' } },
  { name: 'missing_flag', cfg: { cpu: true, gpu: true } },
];

for (const c of cases) {
  const env = { ...process.env, CONFIG_JSON: JSON.stringify(c.cfg) };
  const res = spawnSync(process.execPath, [helper], {
    env,
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });

  // Print a section header
  console.log('--- case:', c.name, '---');
  if (res.error) {
    console.log('spawn error:', res.error.message);
    continue;
  }
  // Native addon prints [NAPI] init flags to stderr; surface it here
  if (res.stderr && res.stderr.trim().length) {
    console.log('[stderr]\n' + res.stderr.trim());
  } else {
    console.log('[stderr] <empty>');
  }
  console.log('[stdout]', (res.stdout || '').trim());
}
