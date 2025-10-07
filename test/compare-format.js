/**
 * Compare native output format with web endpoint reference format
 */

const fs = require('fs');
const path = require('path');

console.log('LibreHardwareMonitor Format Comparison\n');
console.log('=' .repeat(60));

// Load both files
const nativePath = path.join(__dirname, 'sensor-dump.json');
const referencePath = path.join(__dirname, '..', 'example', 'librehardwaremonitor_webservice_output.json');

if (!fs.existsSync(nativePath)) {
  console.error('Error: sensor-dump.json not found. Run dump-all-sensors.js first.');
  process.exit(1);
}

if (!fs.existsSync(referencePath)) {
  console.error('Error: reference file not found.');
  process.exit(1);
}

const nativeData = JSON.parse(fs.readFileSync(nativePath, 'utf8'));
const referenceData = JSON.parse(fs.readFileSync(referencePath, 'utf8'));

console.log('\n1. ROOT LEVEL COMPARISON:');
console.log('-'.repeat(60));

function compareObject(obj, name) {
  const keys = Object.keys(obj).sort();
  console.log(`\n${name}:`);
  console.log(`  Properties: ${keys.join(', ')}`);
  keys.forEach(key => {
    const value = obj[key];
    const type = Array.isArray(value) ? 'array' : typeof value;
    console.log(`    - ${key}: ${type}${type === 'array' ? ` (${value.length} items)` : ` = "${value}"`}`);
  });
}

compareObject(nativeData, 'Native Output Root');
compareObject(referenceData, 'Web Reference Root');

console.log('\n2. KEY DIFFERENCES:');
console.log('-'.repeat(60));

const nativeKeys = new Set(Object.keys(nativeData));
const refKeys = new Set(Object.keys(referenceData));

const missingInNative = [...refKeys].filter(k => !nativeKeys.has(k));
const extraInNative = [...nativeKeys].filter(k => !refKeys.has(k));

if (missingInNative.length > 0) {
  console.log('\n❌ Missing from native output:');
  missingInNative.forEach(k => console.log(`   - ${k}`));
}

if (extraInNative.length > 0) {
  console.log('\n⚠️  Extra in native output (not in reference):');
  extraInNative.forEach(k => console.log(`   - ${k}`));
}

console.log('\n3. HARDWARE NODE COMPARISON:');
console.log('-'.repeat(60));

if (nativeData.Children && nativeData.Children.length > 0 && 
    referenceData.Children && referenceData.Children.length > 0) {
  
  const nativeHw = nativeData.Children[0];
  const refHw = referenceData.Children[0];
  
  console.log('\nFirst hardware node:');
  compareObject(nativeHw, 'Native Hardware Node');
  compareObject(refHw, 'Reference Hardware Node');
  
  const hwNativeKeys = new Set(Object.keys(nativeHw));
  const hwRefKeys = new Set(Object.keys(refHw));
  
  const hwMissing = [...hwRefKeys].filter(k => !hwNativeKeys.has(k));
  const hwExtra = [...hwNativeKeys].filter(k => !hwRefKeys.has(k));
  
  if (hwMissing.length > 0) {
    console.log('\n❌ Missing from native hardware nodes:');
    hwMissing.forEach(k => console.log(`   - ${k}`));
  }
  
  if (hwExtra.length > 0) {
    console.log('\n⚠️  Extra in native hardware nodes:');
    hwExtra.forEach(k => console.log(`   - ${k}`));
  }
}

console.log('\n4. SENSOR NODE COMPARISON:');
console.log('-'.repeat(60));

// Find first sensor with actual values
function findSensorWithValue(node) {
  if (node.Value && node.Value !== "" && node.SensorId) {
    return node;
  }
  if (node.Children && Array.isArray(node.Children)) {
    for (const child of node.Children) {
      const found = findSensorWithValue(child);
      if (found) return found;
    }
  }
  return null;
}

const nativeSensor = findSensorWithValue(nativeData);
const refSensor = findSensorWithValue(referenceData);

if (nativeSensor && refSensor) {
  console.log('\nFirst sensor with value:');
  compareObject(nativeSensor, 'Native Sensor');
  compareObject(refSensor, 'Reference Sensor');
  
  const sensorNativeKeys = new Set(Object.keys(nativeSensor));
  const sensorRefKeys = new Set(Object.keys(refSensor));
  
  const sensorMissing = [...sensorRefKeys].filter(k => !sensorNativeKeys.has(k));
  const sensorExtra = [...sensorNativeKeys].filter(k => !sensorRefKeys.has(k));
  
  if (sensorMissing.length > 0) {
    console.log('\n❌ Missing from native sensor nodes:');
    sensorMissing.forEach(k => console.log(`   - ${k}`));
  }
  
  if (sensorExtra.length > 0) {
    console.log('\n⚠️  Extra in native sensor nodes:');
    sensorExtra.forEach(k => console.log(`   - ${k}`));
  }
}

console.log('\n5. SUMMARY:');
console.log('-'.repeat(60));

const issues = [];

// Root level Min/Value/Max should be strings not empty
if (referenceData.Min !== nativeData.Min) {
  issues.push(`Root Min: expected "${referenceData.Min}", got "${nativeData.Min}"`);
}
if (referenceData.Value !== nativeData.Value) {
  issues.push(`Root Value: expected "${referenceData.Value}", got "${nativeData.Value}"`);
}
if (referenceData.Max !== nativeData.Max) {
  issues.push(`Root Max: expected "${referenceData.Max}", got "${nativeData.Max}"`);
}

// Check for missing HardwareId and SensorId
if (refSensor && !nativeSensor.SensorId) {
  issues.push('Sensors are missing SensorId property');
}
if (refHw && !nativeHw.HardwareId) {
  issues.push('Hardware nodes are missing HardwareId property');
}
if (refSensor && !nativeSensor.Type) {
  issues.push('Sensors are missing Type property');
}

if (issues.length > 0) {
  console.log('\n❌ Format Issues Found:');
  issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
  console.log('\n⚠️  The native output format needs adjustments to match the web endpoint.');
} else {
  console.log('\n✓ Format appears to match!');
}

console.log('\n' + '='.repeat(60));
