/**
 * LibreHardwareMonitor data flattening utilities
 * 
 * Transforms the hierarchical tree structure from LibreHardwareMonitor
 * into a flattened, application-friendly format.
 * 
 * Input: { id: 0, Text: "Sensor", Children: [...] }
 * Output: { mainboard: [...], cpu: [...], gpu: [...], ram: [...], ... }
 */

'use strict';

/**
 * Slugify utility - converts text to lowercase slug format
 * @param {string} text - Text to slugify
 * @returns {string} - Slugified text
 */
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '_')           // Replace spaces with _
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '_')         // Replace multiple - with single _
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Main flattening function
 * @param {Object} data - Raw LibreHardwareMonitor JSON data
 * @returns {Object} - Flattened structure organized by hardware type
 */
function flatten(data) {
    const out = {};
    
    // Root node has Children array with hardware items
    const hardwareItems = data.Children || [];
    
    for (let i = 0; i < hardwareItems.length; i++) {
        const hardware = hardwareItems[i];
        let type = getType(hardware.ImageURL);
        
        // Special handling for mainboard - unwrap SuperIO level
        if (type === 'mainboard') {
            if (hardware.Children.length > 0 && hardware.Children[0].Children) {
                hardware.Children = hardware.Children[0].Children;
            }
        }
        
        if (!out[type]) { 
            out[type] = [];
        }
        
        const group = getGroup(hardware.Children, type, out[type].length);
        group.name = hardware.Text;
        group.id = hardware.id;
        
        // Add hardware identifier if available
        if (hardware.HardwareId) {
            group.hardwareId = hardware.HardwareId;
        }
        
        out[type].push(group);
    }
    
    return out;
}

/**
 * Process a hardware group (e.g., CPU, GPU)
 * @param {Array} children - Children array from hardware node
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Index of this hardware in the type array
 * @returns {Object} - Processed group data
 */
function getGroup(children, hw_type, idx) {
    const out = {};
    
    for (let i = 0; i < children.length; i++) {
        const sensorCategory = children[i];
        const type = slugify(sensorCategory.Text);
        const sensors = getSensors(sensorCategory.Children, hw_type, idx);
        sensors.name = sensorCategory.Text;
        sensors.id = sensorCategory.id;
        
        if (!out[type]) { 
            out[type] = sensors;
        }
    }
    
    return out;
}

/**
 * Process sensor categories (Voltages, Temperatures, etc.)
 * @param {Array} children - Children array from sensor category
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Hardware index
 * @returns {Object} - Processed sensors
 */
function getSensors(children, hw_type, idx) {
    const out = {};
    
    for (let i = 0; i < children.length; i++) {
        const sensor = children[i];
        const type = slugify(sensor.Text);
        const values = getValues(sensor, hw_type, idx);
        
        if (!out[type]) { 
            out[type] = values;
        }
    }
    
    return out;
}

/**
 * Process individual sensor values
 * @param {Object} sensor - Sensor object
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Hardware index
 * @returns {Object} - Processed sensor with parsed values
 */
function getValues(sensor, hw_type, idx) {
    const obj = { ...sensor };
    
    // Clean up unnecessary fields
    if (obj.Children && obj.Children.length === 0) { 
        delete obj.Children; 
    }
    if (obj.ImageURL !== undefined) { 
        delete obj.ImageURL; 
    }
    if (obj.Text) { 
        obj.name = obj.Text;
        delete obj.Text;
    }
    
    obj.data = {};
    
    // Keep SensorId but rename for consistency
    if (obj.SensorId) {
        obj.sensorId = obj.SensorId;
        delete obj.SensorId;
    }
    
    // Keep Type but rename for consistency
    if (obj.Type) {
        obj.type = obj.Type;
        delete obj.Type;
    }
    
    if (obj.id !== undefined) { 
        delete obj.id; 
    }
    
    // Parse value strings (e.g., "45,5 °C" -> {value: 45.5, unit: "°C"})
    if (obj.Value && obj.Value !== '') { 
        obj.data = parseValue(obj.Value);
        delete obj.Value; 
    }
    if (obj.Max && obj.Max !== '') { 
        obj.data.max = parseValue(obj.Max).value;
        delete obj.Max; 
    }
    if (obj.Min && obj.Min !== '') { 
        obj.data.min = parseValue(obj.Min).value; 
        delete obj.Min; 
    }
    
    // Clean up empty Value/Min/Max strings
    if (obj.Value === '') delete obj.Value;
    if (obj.Min === '') delete obj.Min;
    if (obj.Max === '') delete obj.Max;
    
    return obj;
}

/**
 * Extract hardware type from ImageURL
 * @param {string} imageUrl - ImageURL path (e.g., "images_icon/nvidia.png")
 * @returns {string} - Hardware type slug
 */
function getType(imageUrl) {
    if (!imageUrl) {
        return 'unknown';
    }
    
    const parts = imageUrl.split('/');
    if (parts.length < 2) {
        return 'unknown';
    }
    
    let type = parts[1].split('.')[0];
    
    // Normalize GPU types
    if (type === 'nvidia' || type === 'ati' || type === 'intel') {
        type = 'gpu';
    }
    
    // Normalize other types
    if (type === 'hdd') {
        type = 'storage';
    }
    if (type === 'nic') {
        type = 'network';
    }
    if (type === 'mainboard') {
        type = 'mainboard';
    }
    
    return slugify(type);
}

/**
 * Parse sensor value strings into structured data
 * @param {string} item - Value string (e.g., "45,5 °C" or "45.5 °C")
 * @returns {Object} - {value: number, unit: string}
 */
function parseValue(item) {
    if (!item || typeof item !== 'string') {
        return { value: null, unit: '' };
    }
    
    const split = item.trim().split(' ');
    const unit = split.slice(1).join(' '); // Handle multi-word units
    let numStr = split[0].replace(/,/g, '.'); // Replace comma with period for parsing
    const num = parseFloat(numStr);
    
    return { 
        value: isNaN(num) ? null : num, 
        unit: unit || '' 
    };
}

module.exports = {
    flatten,
    slugify,
    parseValue
};
