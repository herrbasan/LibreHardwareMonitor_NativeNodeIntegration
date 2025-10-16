verify-groups.ps1

This folder contains small integration helpers for the CLI daemon.

verify-groups.ps1
- Purpose: Verify that disabled sensor groups (via `init.flags`) are not polled by the CLI daemon.
- Usage:

```powershell
# Run verification for cpu only
powershell -NoProfile -ExecutionPolicy Bypass -File test\verify-groups.ps1 -flags cpu -exePath dist\LibreMonCLI.exe
```

- Exit code: 0 = success (disabled groups not present), 1 = verification failure, 2/3 = parsing or runtime errors.

Notes
- The script runs the daemon in `--daemon` mode and pipes newline-delimited JSON commands (init, poll, shutdown).
- It parses the `poll` response and checks hardware ids to avoid false positives from shared vendor names.

You can adapt the script to test other flag combinations, e.g.: `-flags cpu,gpu`.