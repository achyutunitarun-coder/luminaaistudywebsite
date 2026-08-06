# Lumina Desktop App (Tauri)

Lumina ships as a native Windows desktop app built with [Tauri](https://tauri.app). The installer is
hosted on the live site at `https://luminaai.co.in/downloads/Lumina-Setup.exe` and linked from the
in-app sidebar ("Download Desktop").

## Why Windows shows "Unrecognized app"

Windows SmartScreen flags any executable that is **not signed by a trusted code-signing certificate**.
This is standard for all new, unsigned apps — it is **not** a sign that the installer is unsafe.

Because Lumina's installer is currently unsigned, first-time installers will see one of:

- Windows SmartScreen: *"Windows protected your PC"* / *"an unrecognized app"*
- Microsoft Edge / Chrome: *"Lumina-Setup.exe isn't commonly downloaded"* or *"may be dangerous"*

## How to install (safe workaround)

1. **Download** the installer from the site's **Download Desktop** button.
2. **Windows SmartScreen** prompt appears → click **More info** → **Run anyway**.
   - If it says *"App has been blocked by your system administrator"*, see the Unblock step below.
3. The installer (NSIS) runs → choose install location → **Install**.
4. Launch **Lumina** from the Start Menu or Desktop.

### If the file was downloaded and still blocked

Right-click the downloaded `Lumina-Setup.exe` → **Properties** → under the **General** tab tick
**Unblock**, then click **OK**, then run it again.

### For the installed app (a valid signed certificate is NOT shown)

If Windows shows the **"Windows protected your PC"** dialog on the app itself:

- Click **More info** → **Run anyway**.

## Recommended: code-sign the installer (removes the warning)

The clean, permanent fix is to **sign the installer with a code-signing certificate**.

### 1. Purchase a code-signing certificate (one of)

| Type | First-run trust | Typical cost |
|------|-----------------|--------------|
| **OV** (Organization Validation) | Shows "Verified publisher" — warning may briefly appear | ~$150–250/yr |
| **EV** (Extended Validation) | Trusted immediately, no SmartScreen warning | ~$300–500/yr (requires a USB token) |

Providers: DigiCert, Sectigo, GlobalSign. The certificate is typically provided as a `.pfx`/`.p12`
file plus a password (and sometimes a hardware token).

### 2. Sign the installer locally (Windows)

With a `.pfx` + password, using the Windows SDK `signtool`:

```powershell
# Add a timestamp server so the signature stays valid after the cert expires
signtool sign /f Lumina.pfx /p "YOUR_CERT_PASSWORD" /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  "src-tauri\target\release\bundle\nsis\Lumina-Setup.exe"
```

### 3. (Recommended) Sign automatically in CI

Automate signing on every release so you never sign a stale installer manually:

- Commit the `.pfx` as an encrypted GitHub secret (base64) — e.g. `CERT_BASE64` and `CERT_PASSWORD`.
- In the Tauri release workflow, before `tauri build`, decode the cert and run `signtool sign ...`
  on the produced installer.
- Optionally publish installers via GitHub Releases which builds a **reputation** over time.

## Build the app yourself

```bash
# Install toolchain once
winget install --id Rustlang.Rustup --exact        # Rust toolchain
winget install Microsoft.VisualStudio.2022.BuildTools # C++ linker required by Tauri on Windows

npm run build        # 1) build the frontend (produces dist/)
npm run tauri:build  # 2) build + package the native app
```

Outputs:

- `src-tauri/target/release/lumina.exe` — the raw app binary
- `src-tauri/target/release/bundle/nsis/Lumina_1.0.0_x64-setup.exe` — the installer

To point the site at a fresh installer, copy the built NSIS `.exe` to `public/downloads/Lumina-Setup.exe`
and redeploy.

## Notes

- Currently the shipped installer is **unsigned**; the runtime keeps asking "Run anyway".
  Signing (section above) is the proper way to clear it.
- The app bundles the frontend (`dist/`) and uses WebView2 (preinstalled on Windows 10/11), so it runs
  offline with no browser needed.