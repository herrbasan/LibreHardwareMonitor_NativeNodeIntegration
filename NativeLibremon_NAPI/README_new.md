# Native LibreMon (N-API) - Self-Contained Distribution Builder

Build a **copy-ready** folder with everything needed to use LibreHardwareMonitor in Node.js/Electron.

## 🎯 Goal

Build once, copy anywhere. The `dist/native-libremon-napi/` folder is completely self-contained with native addon, .NET runtime (~200 DLLs), and JavaScript wrapper. No build tools or npm install required.

## 🚀 Quick Start

```powershell
# Build the distribution
npm install
npm run build

# Output: ../dist/native-libremon-napi/ (ready to copy!)
```

## 📦 Using the Distribution

```javascript
// Copy dist/native-libremon-napi/ to your project and require it
const monitor = require('./native-libremon-napi');

await monitor.init({ cpu: true, gpu: true, memory: true });
const data = await monitor.poll();
await monitor.shutdown();
```

That's it! See full documentation in the generated `dist/native-libremon-napi/README.md`

## 🛠️ For Developers

- `npm run build` - Build everything and create distribution
- `npm run build:managed` - Build .NET bridge with self-contained runtime  
- `npm run build:native` - Compile N-API addon (auto-patches MSVC)
- `npm run build:dist` - Assemble files into dist folder
- `npm test` - Run integration test
