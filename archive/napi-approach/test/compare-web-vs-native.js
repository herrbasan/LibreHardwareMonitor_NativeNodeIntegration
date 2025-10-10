/**
 * Comparison Test: Web Endpoint vs Native Polling
 * 
 * This test compares the output from LibreHardwareMonitor's web endpoint
 * against the native Node.js addon to ensure they produce identical results
 * when processed through the same flatten logic.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Import the reference flatten logic (from main project)
const { flatten } = require('../reference/libre_hardware_flatten');

// Import the native polling module
const nativeMonitor = require('../lib/index');

// Configuration
const WEB_ENDPOINT = 'http://localhost:8085/data.json';
const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Fetch data from LibreHardwareMonitor web endpoint
 */
function fetchWebData() {
    return new Promise((resolve, reject) => {
        http.get(WEB_ENDPOINT, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(new Error('Failed to parse web endpoint JSON: ' + err.message));
                }
            });
        }).on('error', (err) => {
            reject(new Error('Failed to fetch from web endpoint: ' + err.message));
        });
    });
}

/**
 * Main test function
 */
async function runComparison() {
    console.log('='.repeat(70));
    console.log('LibreHardwareMonitor: Web Endpoint vs Native Module Comparison');
    console.log('='.repeat(70));
    console.log();
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    try {
        // Step 1: Fetch data from web endpoint
        console.log('Step 1: Fetching data from web endpoint...');
        console.log(`        ${WEB_ENDPOINT}`);
        const webData = await fetchWebData();
        console.log(`        ✓ Received ${JSON.stringify(webData).length} bytes`);
        console.log();
        
        // Step 2: Save web endpoint output
        console.log('Step 2: Saving web endpoint output...');
        const webPath = path.join(OUTPUT_DIR, '1-web-endpoint.json');
        fs.writeFileSync(webPath, JSON.stringify(webData, null, 2));
        console.log(`        ✓ Saved: ${webPath}`);
        console.log();
        
        // Step 3: Initialize native module
        console.log('Step 3: Initializing native hardware monitor...');
        await nativeMonitor.init({
            cpu: true,
            gpu: true,
            motherboard: true,
            memory: true,
            storage: true
        });
        console.log('        ✓ Native module initialized');
        console.log();
        
        // Step 4: Poll native data (unfiltered - for reference)
        console.log('Step 4: Polling native data (unfiltered)...');
        const nativeDataUnfiltered = await nativeMonitor.poll();
        console.log(`        ✓ Received ${JSON.stringify(nativeDataUnfiltered).length} bytes`);
        
        // Save for reference only
        const nativeUnfilteredPath = path.join(OUTPUT_DIR, 'native-unfiltered.json');
        fs.writeFileSync(nativeUnfilteredPath, JSON.stringify(nativeDataUnfiltered, null, 2));
        console.log(`        ✓ Saved (reference): ${nativeUnfilteredPath}`);
        console.log();
        
        // Step 5: Poll native data with filtering (THIS SHOULD MATCH WEB ENDPOINT)
        console.log('Step 5: Polling native data with filtering (target output)...');
        const nativeData = await nativeMonitor.poll({
            filterVirtualNics: true,
            filterDIMMs: true
        });
        console.log(`        ✓ Received ${JSON.stringify(nativeData).length} bytes (filtered)`);
        
        // Save the main comparison target
        const nativePath = path.join(OUTPUT_DIR, '2-native-filtered.json');
        fs.writeFileSync(nativePath, JSON.stringify(nativeData, null, 2));
        console.log(`        ✓ Saved: ${nativePath}`);
        console.log();
        console.log('        📊 MAIN COMPARISON: 1-web-endpoint.json vs 2-native-filtered.json');
        console.log();
        
        // Step 6: Flatten both outputs using reference logic for comparison
        console.log('Step 6: Flattening data for comparison analysis...');
        const webFlattened = flatten(webData);
        const nativeFlattened = flatten(nativeData);
        const nativeUnfilteredFlattened = flatten(nativeDataUnfiltered);
        console.log(`        ✓ Flattened web endpoint: ${Object.keys(webFlattened || {}).length} hardware types`);
        console.log(`        ✓ Flattened native (filtered): ${Object.keys(nativeFlattened || {}).length} hardware types`);
        console.log(`        ✓ Flattened native (unfiltered): ${Object.keys(nativeUnfilteredFlattened || {}).length} hardware types`);
        console.log();
        
        // Step 7: Compare flattened results (unfiltered)
        console.log('Step 7: Comparing unfiltered results...');
        compareResults(webFlattened, nativeFlattened);
        console.log();
        
        // Step 7: Compare main outputs (web vs native filtered)
        console.log('Step 7: Comparing WEB ENDPOINT vs NATIVE FILTERED...');
        console.log('======================================================================');
        console.log('📊 MAIN COMPARISON: Web Endpoint vs Native Module (Filtered)');
        console.log('======================================================================');
        console.log();
        compareResults(webFlattened, nativeFlattened);
        console.log();
        
        // Step 8: Deep analysis of main comparison
        console.log('Step 8: Deep analysis (web vs native filtered)...');
        compareRawData(webData, nativeData, '1-web-endpoint.json', '2-native-filtered.json');
        console.log();
        
        // Step 9: Detailed structure comparison (hardware by hardware, sensor group by sensor group)
        console.log('Step 9: Detailed structure comparison...');
        compareStructures(webData, nativeData);
        console.log();
        
        // Step 10: Show unfiltered comparison for reference
        console.log('Step 10: Reference comparison (web vs native unfiltered)...');
        console.log('        (This shows why filtering is needed)');
        console.log();
        compareResults(webFlattened, nativeUnfilteredFlattened);
        console.log();
        
        // Cleanup
        await nativeMonitor.shutdown();
        
        console.log('======================================================================');
        console.log('✓ Test completed successfully');
        console.log('======================================================================');
        console.log();
        console.log('📁 Output files:');
        console.log('   1-web-endpoint.json       - LibreHardwareMonitor web server output');
        console.log('   2-native-filtered.json    - Native module output (SHOULD MATCH #1)');
        console.log('   native-unfiltered.json    - Native without filters (reference only)');
        console.log();
        
    } catch (err) {
        console.error('✗ Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

/**
 * Extract all sensor paths from raw data for comparison
 */
function extractSensorPaths(data, prefix = '', sensors = new Set()) {
    if (!data) return sensors;
    
    // Add this item if it has a SensorId
    if (data.SensorId) {
        sensors.add(data.SensorId);
    }
    
    // Recursively process children
    if (data.Children && Array.isArray(data.Children)) {
        for (const child of data.Children) {
            extractSensorPaths(child, prefix, sensors);
        }
    }
    
    return sensors;
}

/**
 * Extract all hardware items from raw data
 */
function extractHardwareItems(data, items = []) {
    if (!data) return items;
    
    // Add this item if it has a HardwareId
    if (data.HardwareId) {
        items.push({
            id: data.HardwareId,
            text: data.Text,
            type: data.ImageURL ? data.ImageURL.split('/')[1].split('.')[0] : 'unknown',
            childCount: data.Children ? data.Children.length : 0
        });
    }
    
    // Recursively process children
    if (data.Children && Array.isArray(data.Children)) {
        for (const child of data.Children) {
            extractHardwareItems(child, items);
        }
    }
    
    return items;
}

/**
 * Compare flattened results and report differences
 */
function compareResults(webData, nativeData) {
    if (!webData || !nativeData) {
        console.log('        ✗ One or both datasets failed to flatten');
        return;
    }
    
    const webTypes = Object.keys(webData).sort();
    const nativeTypes = Object.keys(nativeData).sort();
    
    // Compare hardware types
    console.log('        Hardware Types:');
    console.log(`          Web:    [${webTypes.join(', ')}]`);
    console.log(`          Native: [${nativeTypes.join(', ')}]`);
    
    if (JSON.stringify(webTypes) === JSON.stringify(nativeTypes)) {
        console.log('          ✓ Hardware types match');
    } else {
        console.log('          ✗ Hardware types differ!');
    }
    
    // Compare sensor counts for each type
    console.log();
    console.log('        Sensor Counts:');
    for (const type of webTypes) {
        const webCount = webData[type]?.length || 0;
        const nativeCount = nativeData[type]?.length || 0;
        const match = webCount === nativeCount ? '✓' : '✗';
        console.log(`          ${match} ${type}: web=${webCount}, native=${nativeCount}`);
    }
    
    // Size comparison
    const webSize = JSON.stringify(webData).length;
    const nativeSize = JSON.stringify(nativeData).length;
    const sizeDiff = Math.abs(webSize - nativeSize);
    const sizePercent = ((sizeDiff / webSize) * 100).toFixed(2);
    
    console.log();
    console.log('        Size Comparison:');
    console.log(`          Web:    ${webSize} bytes`);
    console.log(`          Native: ${nativeSize} bytes`);
    console.log(`          Diff:   ${sizeDiff} bytes (${sizePercent}%)`);
}

/**
 * Deep comparison of raw data structures
 */
function compareRawData(webRaw, nativeRaw, webFilename = 'web', nativeFilename = 'native') {
    console.log('='.repeat(70));
    console.log(`Deep Analysis: ${webFilename} vs ${nativeFilename}`);
    console.log('='.repeat(70));
    console.log();
    
    // Extract hardware items
    console.log('Hardware Items:');
    const webHardware = extractHardwareItems(webRaw);
    const nativeHardware = extractHardwareItems(nativeRaw);
    
    console.log(`  Web endpoint found ${webHardware.length} hardware items:`);
    webHardware.forEach(hw => {
        console.log(`    - ${hw.text} (${hw.type}) [${hw.id}] - ${hw.childCount} children`);
    });
    
    console.log();
    console.log(`  Native module found ${nativeHardware.length} hardware items:`);
    nativeHardware.forEach(hw => {
        console.log(`    - ${hw.text} (${hw.type}) [${hw.id}] - ${hw.childCount} children`);
    });
    
    // Extract all sensor paths
    console.log();
    console.log('Sensor Analysis:');
    const webSensors = extractSensorPaths(webRaw);
    const nativeSensors = extractSensorPaths(nativeRaw);
    
    console.log(`  Web endpoint: ${webSensors.size} sensors`);
    console.log(`  Native module: ${nativeSensors.size} sensors`);
    
    // Find missing sensors
    const missingInNative = new Set([...webSensors].filter(s => !nativeSensors.has(s)));
    const extraInNative = new Set([...nativeSensors].filter(s => !webSensors.has(s)));
    
    if (missingInNative.size > 0) {
        console.log();
        console.log(`  ✗ Missing in Native (${missingInNative.size} sensors):`);
        const sorted = [...missingInNative].sort();
        sorted.slice(0, 20).forEach(sensor => {
            console.log(`    - ${sensor}`);
        });
        if (sorted.length > 20) {
            console.log(`    ... and ${sorted.length - 20} more`);
        }
        
        // Save full list to file
        const missingPath = path.join(OUTPUT_DIR, 'missing-sensors.txt');
        fs.writeFileSync(missingPath, sorted.join('\n'));
        console.log(`    Full list saved to: ${missingPath}`);
    }
    
    if (extraInNative.size > 0) {
        console.log();
        console.log(`  ⚠ Extra in Native (${extraInNative.size} sensors):`);
        const sorted = [...extraInNative].sort();
        sorted.slice(0, 20).forEach(sensor => {
            console.log(`    - ${sensor}`);
        });
        if (sorted.length > 20) {
            console.log(`    ... and ${sorted.length - 20} more`);
        }
    }
    
    if (missingInNative.size === 0 && extraInNative.size === 0) {
        console.log('  ✓ All sensors match perfectly!');
    }
    
    console.log();
}

/**
 * Compare structure of each hardware item and sensor group
 */
function compareStructures(webRaw, nativeRaw) {
    console.log('='.repeat(70));
    console.log('Detailed Structure Comparison (Each Hardware & Sensor Group)');
    console.log('='.repeat(70));
    console.log();
    
    const webRoot = webRaw.Children[0];
    const nativeRoot = nativeRaw.Children[0];
    
    if (!webRoot || !nativeRoot) {
        console.log('  ✗ Missing root node in one of the outputs');
        return;
    }
    
    console.log(`Root: ${webRoot.Text} vs ${nativeRoot.Text}`);
    console.log();
    
    // Get hardware items from both
    const webHardware = webRoot.Children || [];
    const nativeHardware = nativeRoot.Children || [];
    
    // Group by hardware ID for comparison
    const webByType = new Map();
    const nativeByType = new Map();
    
    webHardware.forEach(hw => {
        const type = getHardwareType(hw);
        if (!webByType.has(type)) webByType.set(type, []);
        webByType.get(type).push(hw);
    });
    
    nativeHardware.forEach(hw => {
        const type = getHardwareType(hw);
        if (!nativeByType.has(type)) nativeByType.set(type, []);
        nativeByType.get(type).push(hw);
    });
    
    // Get all hardware types
    const allTypes = new Set([...webByType.keys(), ...nativeByType.keys()]);
    
    let totalMatches = 0;
    let totalMismatches = 0;
    
    for (const type of allTypes) {
        const webItems = webByType.get(type) || [];
        const nativeItems = nativeByType.get(type) || [];
        
        console.log(`${type.toUpperCase()}:`);
        console.log(`  Web: ${webItems.length} item(s), Native: ${nativeItems.length} item(s)`);
        
        // Compare each item
        const maxItems = Math.max(webItems.length, nativeItems.length);
        for (let i = 0; i < maxItems; i++) {
            const webItem = webItems[i];
            const nativeItem = nativeItems[i];
            
            if (webItem && nativeItem) {
                console.log(`\n  Item ${i + 1}: ${webItem.Text}`);
                const match = compareHardwareItem(webItem, nativeItem);
                if (match) {
                    totalMatches++;
                } else {
                    totalMismatches++;
                }
            } else if (webItem) {
                console.log(`\n  ✗ Missing in Native: ${webItem.Text}`);
                totalMismatches++;
            } else {
                console.log(`\n  ⚠ Extra in Native: ${nativeItem.Text}`);
                totalMismatches++;
            }
        }
        
        console.log();
    }
    
    console.log('='.repeat(70));
    console.log(`Summary: ${totalMatches} matches, ${totalMismatches} mismatches`);
    console.log('='.repeat(70));
    console.log();
}

/**
 * Compare a single hardware item's structure
 */
function compareHardwareItem(webItem, nativeItem) {
    let allMatch = true;
    
    const webChildren = webItem.Children || [];
    const nativeChildren = nativeItem.Children || [];
    
    // Detect if children are sub-hardware (have HardwareId) or sensor groups (no HardwareId)
    const webHasSubHardware = webChildren.length > 0 && webChildren[0].HardwareId;
    const nativeHasSubHardware = nativeChildren.length > 0 && nativeChildren[0].HardwareId;
    
    if (webHasSubHardware || nativeHasSubHardware) {
        // Has sub-hardware (e.g., motherboard with SuperIO chip)
        if (webChildren.length !== nativeChildren.length) {
            console.log(`    ✗ Sub-hardware count: web=${webChildren.length}, native=${nativeChildren.length}`);
            allMatch = false;
        }
        
        // Compare each sub-hardware item
        for (let i = 0; i < Math.max(webChildren.length, nativeChildren.length); i++) {
            const webSub = webChildren[i];
            const nativeSub = nativeChildren[i];
            
            if (!webSub || !nativeSub) continue;
            
            console.log(`    Sub-hardware: ${webSub.Text}`);
            
            // Now compare sensor type groups under the sub-hardware
            const match = compareSensorGroups(webSub.Children || [], nativeSub.Children || []);
            if (!match) allMatch = false;
        }
    } else {
        // No sub-hardware, children are directly sensor type groups
        const match = compareSensorGroups(webChildren, nativeChildren);
        if (!match) allMatch = false;
    }
    
    return allMatch;
}

/**
 * Compare sensor type groups (Voltages, Temperatures, Load, etc.)
 */
function compareSensorGroups(webGroups, nativeGroups) {
    let allMatch = true;
    
    // Map groups by their Text (group name)
    const webGroupMap = new Map(webGroups.map(g => [g.Text, g]));
    const nativeGroupMap = new Map(nativeGroups.map(g => [g.Text, g]));
    
    const allGroupNames = new Set([...webGroupMap.keys(), ...nativeGroupMap.keys()]);
    
    for (const groupName of allGroupNames) {
        const webGroup = webGroupMap.get(groupName);
        const nativeGroup = nativeGroupMap.get(groupName);
        
        if (webGroup && nativeGroup) {
            const webSensorCount = webGroup.Children?.length || 0;
            const nativeSensorCount = nativeGroup.Children?.length || 0;
            
            if (webSensorCount === nativeSensorCount) {
                console.log(`      ✓ ${groupName}: ${webSensorCount} sensors`);
            } else {
                console.log(`      ✗ ${groupName}: web=${webSensorCount}, native=${nativeSensorCount}`);
                allMatch = false;
                
                // Show which sensors differ
                const webSensorIds = new Set(webGroup.Children.map(s => s.SensorId));
                const nativeSensorIds = new Set(nativeGroup.Children.map(s => s.SensorId));
                
                const missing = [...webSensorIds].filter(id => !nativeSensorIds.has(id));
                const extra = [...nativeSensorIds].filter(id => !webSensorIds.has(id));
                
                if (missing.length > 0) {
                    console.log(`        Missing in native: ${missing.join(', ')}`);
                }
                if (extra.length > 0) {
                    console.log(`        Extra in native: ${extra.slice(0, 3).join(', ')}${extra.length > 3 ? ` + ${extra.length - 3} more` : ''}`);
                }
            }
        } else if (webGroup) {
            console.log(`      ✗ ${groupName}: Missing in native (${webGroup.Children?.length || 0} sensors)`);
            allMatch = false;
        } else {
            console.log(`      ⚠ ${groupName}: Extra in native (${nativeGroup.Children?.length || 0} sensors)`);
            allMatch = false;
        }
    }
    
    return allMatch;
}

/**
 * Get hardware type from ImageURL
 */
function getHardwareType(hw) {
    const img = hw.ImageURL || '';
    if (img.includes('mainboard')) return 'motherboard';
    if (img.includes('cpu')) return 'cpu';
    if (img.includes('nvidia') || img.includes('ati') || img.includes('intel')) return 'gpu';
    if (img.includes('hdd')) return 'storage';
    if (img.includes('nic')) return 'network';
    if (img.includes('ram')) return 'memory';
    return 'other';
}

// Run the test
if (require.main === module) {
    runComparison().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { runComparison };
