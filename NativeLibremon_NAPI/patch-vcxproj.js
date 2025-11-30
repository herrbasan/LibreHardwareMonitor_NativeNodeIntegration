// Patch generated vcxproj files to use MSVC instead of ClangCL
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');

function patchVcxproj(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Replace ClangCL with v143 (VS2022 MSVC)
  content = content.replace(/<PlatformToolset>ClangCL<\/PlatformToolset>/g, '<PlatformToolset>v143</PlatformToolset>');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched: ${path.relative(__dirname, filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.vcxproj')) {
      patchVcxproj(fullPath);
    }
  }
}

console.log('Patching vcxproj files to use MSVC (v142)...');
walkDir(buildDir);
console.log('Patching complete.');
