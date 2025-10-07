/**
 * Reference implementation of LibreHardwareMonitor data flattening
 * Source: https://github.com/herrbasan/Electron_LibreMon
 * 
 * This transforms the hierarchical tree structure from LibreHardwareMonitor
 * into a flattened, application-friendly format.
 * 
 * Input: { id: 0, Text: "Sensor", Children: [...] }
 * Output: { mainboard: [...], cpu: [...], gpu: [...], ram: [...], ... }
 */

'use strict';

/**
 * Slugify utility - converts text to lowercase slug format
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
    let out = {};
    
    // Navigate to computer node's children
    data = data.Children[0].Children;
    
    for (let i = 0; i < data.length; i++) {
        let type = getType(data[i].ImageURL);
        
        // Special handling for mainboard - unwrap one level
        if (type == 'mainboard') {
            if (data[i].Children.length > 0) {
                data[i].Children = data[i].Children[0].Children;
            }
        }
        
        if (!out[type]) { 
            out[type] = [];
        }
        
        let group = getGroup(data[i].Children, type, out[type].length);
        group.name = data[i].Text;
        group.id = data[i].id;
        out[type].push(group);
    }
    
    return out;
}

/**
 * Process a hardware group (e.g., CPU, GPU)
 * @param {Array} obj - Children array from hardware node
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Index of this hardware in the type array
 * @returns {Object} - Processed group data
 */
function getGroup(obj, hw_type, idx) {
    let out = {};
    
    for (let i = 0; i < obj.length; i++) {
        let type = slugify(obj[i].Text);
        let sensors = getSensors(obj[i].Children, hw_type, idx);
        sensors.name = obj[i].Text;
        sensors.id = obj[i].SensorId;
        
        if (!out[type]) { 
            out[type] = sensors;
        }
    }
    
    return out;
}

/**
 * Process sensor categories (Voltages, Temperatures, etc.)
 * @param {Array} obj - Children array from sensor category
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Hardware index
 * @returns {Object} - Processed sensors
 */
function getSensors(obj, hw_type, idx) {
    let out = {};
    
    for (let i = 0; i < obj.length; i++) {
        let type = slugify(obj[i].Text);
        let values = getValues(obj[i], hw_type, idx);
        
        if (!out[type]) { 
            out[type] = values;
        }
    }
    
    return out;
}

/**
 * Process individual sensor values
 * @param {Object} obj - Sensor object
 * @param {string} hw_type - Hardware type identifier
 * @param {number} idx - Hardware index
 * @returns {Object} - Processed sensor with parsed values
 */
function getValues(obj, hw_type, idx) {
    // Clean up unnecessary fields
    if (obj.Children.length == 0) { 
        delete obj.Children; 
    }
    if (obj.ImageURL) { 
        delete obj.ImageURL; 
    }
    if (obj.Text) { 
        obj.name = obj.Text;
        delete obj.Text;
    }
    
    obj.data = {};
    
    if (obj.Type) { 
        delete obj.Type; 
    }
    if (obj.id) { 
        delete obj.id; 
    }
    
    // Parse value strings (e.g., "45,5 °C" -> {value: 45.5, type: "°C"})
    if (obj.Value) { 
        obj.data = parseValue(obj.Value);
        delete obj.Value; 
    }
    if (obj.Max) { 
        obj.data.max = parseValue(obj.Max).value;
        delete obj.Max; 
    }
    if (obj.Min) { 
        obj.data.min = parseValue(obj.Min).value; 
        delete obj.Min; 
    }
    
    return obj;
}

/**
 * Extract hardware type from ImageURL
 * @param {string} s - ImageURL path (e.g., "images_icon/nvidia.png")
 * @returns {string} - Hardware type slug
 */
function getType(s) {
    let type = s.split('/')[1].split('.')[0];
    
    // Normalize GPU types
    if (type == 'nvidia' || type == 'ati' || type == 'intel') {
        type = 'gpu';
    }
    
    return slugify(type);
}

/**
 * Parse sensor value strings into structured data
 * @param {string} item - Value string (e.g., "45,5 °C")
 * @returns {Object} - {value: number, type: string}
 */
function parseValue(item) {
    let split = item.split(' ');
    let type = split[1];
    let num = split[0].replace(/,/g, '.');
    num = parseFloat(num);
    
    return { value: num, type: type };
}

module.exports = {
    flatten,
    slugify
};
