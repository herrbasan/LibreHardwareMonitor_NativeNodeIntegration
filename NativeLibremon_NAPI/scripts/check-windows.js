#!/usr/bin/env node
/**
 * Pre-install check for Windows platform
 * LibreHardwareMonitor only works on Windows
 */

if (process.platform !== 'win32') {
  console.error('\x1b[31m%s\x1b[0m', '\n✖ native-libremon-napi requires Windows');
  console.error('  This package uses LibreHardwareMonitor which only supports Windows.\n');
  process.exit(1);
}

if (process.arch !== 'x64') {
  console.error('\x1b[31m%s\x1b[0m', '\n✖ native-libremon-napi requires x64 architecture');
  console.error('  Only 64-bit Windows is supported.\n');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '✓ Platform check passed (Windows x64)');
