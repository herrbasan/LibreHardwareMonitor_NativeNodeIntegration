/**
 * LibreHardwareMonitor Native - Node.js interface
 * Self-contained N-API addon with .NET runtime bundled
 * 
 * This module can be copied anywhere and will work as long as:
 * - You're on Windows x64
 * - All DLL files are in the same directory
 * - You have administrator privileges
 */

const path = require('path');
const fs = require('fs');

let nativeAddon = null;

// Load the native addon from the same directory as this file
function loadAddon() {
	if (!nativeAddon) {
		try {
			const addonPath = path.join(__dirname, 'librehardwaremonitor_native.node');
			
			if (!fs.existsSync(addonPath)) {
				throw new Error(
					'Native addon not found at: ' + addonPath + '\n' +
					'Make sure all files from the distribution folder are present.'
				);
			}
			
			nativeAddon = require(addonPath);
		} catch (err) {
			const msg = 'Failed to load native addon.\n' +
				'Error: ' + err.message;
			console.error(msg);
			throw new Error(msg);
		}
	}
	return nativeAddon;
}

async function init(config = {}) {
	const addon = loadAddon();
	const fullConfig = {
		cpu: config.cpu !== undefined ? config.cpu : false,
		gpu: config.gpu !== undefined ? config.gpu : false,
		motherboard: config.motherboard !== undefined ? config.motherboard : false,
		memory: config.memory !== undefined ? config.memory : false,
		storage: config.storage !== undefined ? config.storage : false,
		network: config.network !== undefined ? config.network : false,
		psu: config.psu !== undefined ? config.psu : false,
		controller: config.controller !== undefined ? config.controller : false,
		battery: config.battery !== undefined ? config.battery : false,
		dimmDetection: config.dimmDetection !== undefined ? config.dimmDetection : false,
		physicalNetworkOnly: config.physicalNetworkOnly !== undefined ? config.physicalNetworkOnly : false
	};

	try {
		return addon.init(fullConfig);
	} catch(err) {
		if (err.message && err.message.includes('.NET runtime')) {
			throw new Error(
				'Failed to initialize .NET runtime. ' +
				'Please install .NET 9.0 Desktop Runtime from: ' +
				'https://dotnet.microsoft.com/download/dotnet/9.0'
			);
		}
		throw err;
	}
}

function filterVirtualNetworkAdapters(data) {
	if (!data || !data.Children) return;
    
	for (const child of data.Children) {
		if (child.Children && Array.isArray(child.Children)) {
			child.Children = child.Children.filter(item => {
				if (!item.HardwareId || !item.HardwareId.includes('/nic/')) {
					return true;
				}
				const name = item.Text || '';
				const virtualPatterns = [
					'-QoS Packet Scheduler',
					'-WFP ',
					'-VirtualBox NDIS',
					'-Hyper-V Virtual Switch',
					'-Native WiFi Filter',
					'-Virtual WiFi Filter',
					'vEthernet',
					'vSwitch',
					'(Kerneldebugger)'
				];
				const isVirtual = virtualPatterns.some(pattern => name.includes(pattern));
				return !isVirtual;
			});
			filterVirtualNetworkAdapters(child);
		}
	}
}

function filterIndividualDIMMs(data) {
	if (!data || !data.Children) return;
    
	for (const child of data.Children) {
		if (child.Children && Array.isArray(child.Children)) {
			child.Children = child.Children.filter(item => {
				if (!item.HardwareId || !item.HardwareId.includes('/memory/dimm/')) {
					return true;
				}
				return false;
			});
			filterIndividualDIMMs(child);
		}
	}
}

async function poll(options = {}) {
	const addon = loadAddon();
	const data = addon.poll();
	if (options.filterVirtualNics) {
		filterVirtualNetworkAdapters(data);
	}
	if (options.filterDIMMs) {
		filterIndividualDIMMs(data);
	}
	return data;
}

async function shutdown() {
	const addon = loadAddon();
	return addon.shutdown();
}

module.exports = {
	init,
	poll,
	shutdown
};
