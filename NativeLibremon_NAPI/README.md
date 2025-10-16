# Native LibreMon (N-API) — Build & Run

This folder contains the migrated N-API variant of LibreMon (native Node.js addon wrapping a managed LibreHardwareMonitor bridge).

Quick summary
- The addon is a Node N-API native module built with node-gyp and links to the .NET host (nethost/hostfxr) to load a managed bridge.
- For reproducible local builds we publish the managed bridge as a self-contained win-x64 app and copy the publish files into `build/Release` before rebuilding the addon.

Scripts (from project root `NativeLibremon_NAPI`)

- `npm run publish-selfcontained` — Run `dotnet publish` for the managed bridge (self-contained win-x64). Produces `managed/.../publish-selfcontained`.
- `npm run copy-publish` — Copy the self-contained publish files into `NativeLibremon_NAPI/build/Release`.
- `npm run rebuild` — publish-selfcontained -> node-gyp rebuild -> copy-publish.
- `npm run test` — Run the integration test `test/test-native-init.js` (requires build artifacts present).
- `npm run test-all` — Run `rebuild` then `test`.
- `npm run clean` — Remove `build/` and the self-contained publish folder.

Notes about `copy-publish`:

- `copy-publish` copies the self-contained publish output into `build/Release` so the native addon can find the managed DLLs and runtime.
- If `nethost.dll` is not present in the publish output, `copy-publish` will attempt to copy it from a local .NET packs folder (for example: `C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\<version>\runtimes\win-x64\native\nethost.dll`).

Example (PowerShell):

```powershell
cd NativeLibremon_NAPI
npm run test-all
```

Notes and troubleshooting
- If you see "The specified module could not be found" when requiring the `.node` module, it's usually a missing native runtime DLL (nethost.dll, hostpolicy.dll, coreclr.dll, etc.).
- The provided `test/test-native-init.js` is a smoke-test that exercises init → poll → shutdown. It's hardware-dependent: some sensors may be missing on different machines.
- Alternative: publish the managed bridge as framework-dependent and run on machines with .NET 9 Desktop Runtime installed. This reduces the artifact size but requires the runtime to be present.

Why self-contained by default
- Self-contained publishes the native runtime and makes the addon deterministic for CI and local testing (no requirement to install .NET on the runner).

If you'd like I can:
- Switch the scripts to publish framework-dependent and change documentation, or
- Add a CI job that runs `npm run test-all` on Windows to validate the flow automatically.
This folder contains the N-API variant of LibreMon (migrated from archive/napi-approach).

Contents include the native addon source (src/), JavaScript glue (lib/), build scripts and tests.

See the top-level README for build and usage notes.
