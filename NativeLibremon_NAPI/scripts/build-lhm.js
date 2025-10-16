const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const LHM_SRC = path.join(__dirname, '..', 'deps', 'LibreHardwareMonitor-src');
const LHM_DEST = path.join(__dirname, '..', 'deps', 'LibreHardwareMonitor');
const BUILD_CONFIG = 'Release';

console.log('Building LibreHardwareMonitor from source...');

// Check if .NET SDK is available
try {
	execSync('dotnet --version', { stdio: 'pipe' });
} catch (err) {
	console.error('ERROR: .NET SDK not found.');
	console.error('Please install .NET SDK 6.0 or later from:');
	console.error('https://dotnet.microsoft.com/download/dotnet/6.0');
	process.exit(1);
}

// Build LibreHardwareMonitorLib.dll
try {
	const projectPath = path.join(LHM_SRC, 'LibreHardwareMonitorLib', 'LibreHardwareMonitorLib.csproj');
  
	console.log(`Building ${projectPath}...`);
  
	// Build for specific runtime (fixes CsWin32 code generation issues)
	execSync(
		`dotnet build "${projectPath}" -c ${BUILD_CONFIG} -r win-x64`,
		{ stdio: 'inherit' }
	);
  
	// Determine build output directory
	// Build output goes to bin/Release/AnyCPU/net*/win-x64/
	const binDir = path.join(LHM_SRC, 'bin', BUILD_CONFIG, 'AnyCPU');
  
	let buildOutput;
  
	// Check runtime-specific paths first
	if (fs.existsSync(path.join(binDir, 'net9.0', 'win-x64'))) {
		buildOutput = path.join(binDir, 'net9.0', 'win-x64');
		console.log('Using net9.0/win-x64 build output');
	} else if (fs.existsSync(path.join(binDir, 'net8.0', 'win-x64'))) {
		buildOutput = path.join(binDir, 'net8.0', 'win-x64');
		console.log('Using net8.0/win-x64 build output');
	} else if (fs.existsSync(path.join(binDir, 'net472', 'win-x64'))) {
		buildOutput = path.join(binDir, 'net472', 'win-x64');
		console.log('Using net472/win-x64 build output');
	} else if (fs.existsSync(path.join(binDir, 'net472'))) {
		buildOutput = path.join(binDir, 'net472');
		console.log('Using net472 build output');
	} else if (fs.existsSync(path.join(binDir, 'net6.0'))) {
		buildOutput = path.join(binDir, 'net6.0');
		console.log('Using net6.0 build output');
	} else if (fs.existsSync(path.join(binDir, 'net8.0'))) {
		buildOutput = path.join(binDir, 'net8.0');
		console.log('Using net8.0 build output');
	} else {
		console.error('ERROR: Could not find build output directory');
		console.error(`Checked: ${binDir}`);
		console.error('Available directories:');
		if (fs.existsSync(binDir)) {
			fs.readdirSync(binDir, { withFileTypes: true })
				.filter(d => d.isDirectory())
				.forEach(d => console.error(`  - ${d.name}`));
		}
		process.exit(1);
	}
  
	// Create destination directory
	if (!fs.existsSync(LHM_DEST)) {
		fs.mkdirSync(LHM_DEST, { recursive: true });
	}
  
	// Copy required DLLs
	const requiredFiles = [
		'LibreHardwareMonitorLib.dll',
		'HidSharp.dll',
		'RAMSPDToolkit-NDD.dll',
		'System.Buffers.dll',
		'System.CodeDom.dll',
		'System.Memory.dll',
		'System.Numerics.Vectors.dll',
		'System.Runtime.CompilerServices.Unsafe.dll',
		'System.Security.AccessControl.dll',
		'System.Security.Principal.Windows.dll',
		'System.Threading.AccessControl.dll'
		// Note: PawnIO driver modules are embedded as resources inside LibreHardwareMonitorLib.dll
	];
  
	console.log(`\nCopying DLLs from ${buildOutput} to ${LHM_DEST}...`);
  
	let successCount = 0;
	let missingFiles = [];
  
	requiredFiles.forEach(file => {
		const src = path.join(buildOutput, file);
		const dest = path.join(LHM_DEST, file);
    
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, dest);
			console.log(`✓ Copied ${file}`);
			successCount++;
		} else {
			// For net9.0 builds, some dependencies might not be present 
			// They're loaded from the .NET runtime instead
			console.log(`⚠ Skipped ${file} (not in build output - may use runtime version)`);
			missingFiles.push(file);
		}
	});
  
	// Ensure at minimum LibreHardwareMonitorLib.dll was copied
	if (!fs.existsSync(path.join(LHM_DEST, 'LibreHardwareMonitorLib.dll'))) {
		console.error('\n✗ CRITICAL: LibreHardwareMonitorLib.dll was not found!');
		process.exit(1);
	}
  
	console.log('\n✓ LibreHardwareMonitor build complete');
	console.log(`Built DLLs are in: ${LHM_DEST}`);
  
} catch (err) {
	console.error('\n✗ Failed to build LibreHardwareMonitor');
	console.error(err.message);
	process.exit(1);
}
