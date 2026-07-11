[English](./README.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [中文](./README.zh-CN.md) · [فارسی](./README.fa.md) · [العربية](./README.ar.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/logo-dark.png">
    <img alt="Noctis" src="./site/media/logo-light.png" width="120">
  </picture>
</p>

<p align="center"><strong>VLESS Browser Extension for Chrome</strong></p>
<p align="center"><em>Route browser traffic through your own proxies — without a system VPN.</em></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn"><img src="https://img.shields.io/chrome-web-store/v/nmhobajopepdpihahepaddpdifdcenpn?label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store"></a>
  <a href="./site/LICENSE.md"><img src="https://img.shields.io/badge/license-EULA-blue" alt="License: EULA"></a>
  <a href="./host"><img src="https://img.shields.io/badge/helper-MIT-green" alt="Helper: MIT"></a>
  <a href="https://noctis.c0nn3ct.info"><img src="https://img.shields.io/badge/site-noctis.c0nn3ct.info-7c3aed" alt="Live site"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/demo-dark.gif">
    <img alt="Noctis demo" src="./site/media/demo-light.gif" width="720">
  </picture>
</p>

> [!IMPORTANT]
> Noctis is a browser proxy — not a system VPN. Only Chrome traffic is routed; the rest of your OS stays on your real connection. The extension is free under a proprietary EULA; the native helper is open source (MIT).

Noctis is a free browser extension that routes Chrome through VLESS, VMess, Trojan, Shadowsocks, Hysteria2, Reality and other proxy servers via a local helper that drives a pluggable proxy engine — sing-box, xray-core, or mihomo. No system VPN, no separate client window — proxying stays inside the browser.

## ✨ Features

- **Pluggable proxy engine** — Noctis ships sing-box and can also drive xray-core or mihomo, auto-picking the engine each server needs — so xhttp, REALITY-vision flows, Snell and more all just work.
- **Servers from share links, QR, or subscription URLs** — Paste `vless://`, `vmess://`, `trojan://`, `ss://`, `hysteria2://`, `tuic://`, `wireguard://` — or scan a QR code. Subscription URLs auto-refresh on a schedule.
- **Per-rule routing** — Match by domain, GeoSite, or GeoIP. Each rule routes to proxy, direct, or block.
- **Three routing modes** — Global sends everything through the proxy. Rules only routes matches. Direct bypasses entirely.
- **Health checks + automatic failover** — Background latency probes; one-tap manual ping per server. Failing servers drop out of the active route.
- **Pinned-server shortlist** — Keep three favorites at the top of the popup. Switch active server without opening the full panel.
- **Live log stream** — the proxy engine's stdout and stderr stream into the extension. Diagnose connection issues without leaving the browser.
- **WebRTC leak guard** — Optional toggle blocks UDP outside the proxy so WebRTC can't reveal your real IP.
- **Bundled ad and tracker block rules** — `geosite:ads` families route to block by default. Toggle off if you prefer to handle it elsewhere.

## 🔌 Supported proxy protocols

`VLESS` · `VLESS Reality` · `VMess` · `Trojan` · `Shadowsocks` · `Hysteria/2` · `TUIC` · `WireGuard` · `AnyTLS` · `ShadowTLS`

Noctis supports VLESS (including VLESS Reality), VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS and ShadowTLS. Configs from V2Ray, Xray and 3X-UI panels work as-is — paste a share link or subscription URL and the extension translates it into the right engine's config automatically. xray unlocks xhttp/splithttp and XTLS flow variants; mihomo adds Snell, SSR and more.

## 🧩 How it works

Browsers can't run a proxy engine on their own. Three pieces split the work across the sandbox boundary — and the arrow that crosses it is the only place messages flow.

```
  Browser                                    Your machine
  ┌──────────────────┐  native messaging   ┌──────────────────┐
  │ Noctis extension │ ◀─────────────────▶ │  noctis-host     │
  │ popup · panel    │   events · logs     │ (native helper)  │
  │ options          │                     └────────┬─────────┘
  └────────┬─────────┘                              │ spawn · config
           │                                        ▼
           │                                ┌──────────────────┐
           │  Chrome proxy → SOCKS/HTTP     │  proxy engine    │
           └───────────────────────────────▶│                  │
                                            └────────┬─────────┘
                                                     │ encrypted
                                                     ▼
                                            ┌──────────────────┐
                                            │  Proxy servers   │
                                            └──────────────────┘
```

Noctis ships sing-box by default and can also drive xray-core and mihomo. A small native helper supervises the engine on your machine, and Noctis picks the right one for each server automatically — so protocols a single engine can't handle just work. xray unlocks xhttp/splithttp and the XTLS flow variants (REALITY-vision); mihomo adds Snell, SSR and Mieru. The browser extension only ever sends routing decisions — never raw traffic.

## 📥 Install

The Noctis extension needs a small native helper running on your machine. The helper supervises the proxy engine — sing-box, xray, or mihomo — that actually does the proxying.

### Before you start

- A Chromium-based browser, version 120 or newer (Chrome, Chromium, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser).
- About 100 MB of free disk for the helper and the proxy engines.
- No admin / root rights — everything installs into your user account.

### Install the extension

Install Noctis from the [Chrome Web Store](https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn). Open the extension after install — it will detect that the helper is missing and show a setup dialog with a one-liner pre-filled for your machine.

### Run the helper installer

Copy the command from the extension's Helper Setup dialog and paste it into your terminal. Your extension ID is already filled in — you don't need to look it up. For reference, the command looks like this:

Helper source: [`host/`](./host)

**macOS**
```bash
curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- nmhobajopepdpihahepaddpdifdcenpn
```

**Linux**
```bash
curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- nmhobajopepdpihahepaddpdifdcenpn
```

**Windows (PowerShell)**
```powershell
$env:NOCTIS_EXT_ID='nmhobajopepdpihahepaddpdifdcenpn'; iwr -useb https://noctis.c0nn3ct.info/windows.ps1 | iex
```

The installer downloads noctis-host and the proxy engines (sing-box, xray, mihomo) into your user data directory and writes a native-messaging manifest for every supported browser.

Running it from more than one browser or profile is fine: each browser's extension has its own id, and the installer **accumulates** ids in the manifest rather than replacing them. So if you use Noctis in several browsers or profiles at once, just run the Helper Setup command shown in each — every one stays connected, and each can run its own server simultaneously.

The first time the extension talks to the helper, your browser may show a one-time native-messaging prompt — approve it.

### First run

Open the extension's popup, paste a `vless://`, `ss://`, or `trojan://` share link (or a subscription URL), and toggle the active server. The status badge turns green once the engine accepts traffic.

### Updating

Rerun the one-liner for your OS — the script is idempotent and will replace the existing binaries.

### Uninstalling

1. Remove the extension from `chrome://extensions`.
2. Delete the Noctis data directory:
   - macOS / Linux: `~/.local/share/noctis`
   - Windows: `%LOCALAPPDATA%\Noctis`

## ❓ FAQ

**What is VLESS and why use it in a browser?**
VLESS is a lightweight proxy protocol from the V2Ray/Xray family. It carries no encryption of its own — TLS does that — so it's fast and easy to disguise as ordinary HTTPS. Using VLESS through a browser extension means only browser traffic is proxied; the rest of your operating system stays on your real connection.

**How is a browser proxy extension different from a VPN?**
A VPN tunnels every app on your system through one connection and usually needs admin rights. A browser proxy extension like Noctis only routes the browser, requires no root or admin, and lets you keep Zoom, Steam, Telegram desktop and torrents on your real network at the same time.

**Does Noctis support VLESS Reality?**
Yes. Noctis passes Reality parameters (Server Name, Fingerprint, SNI, Dest, public key, short ID) through to the helper unchanged and runs the server on an engine that supports it — xray drives the full XTLS-vision flow. Paste a `vless://...flow=xtls-rprx-vision&security=reality` share link and the extension imports every field.

**Which proxy protocols does Noctis support?**
VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS and ShadowTLS — plus xhttp/splithttp, Snell, SSR and more through xray and mihomo. V2Ray and Xray share links work as-is.

**Is a Chrome proxy extension safe to use?**
Safer than most. Noctis sends nothing to its developer — no analytics, no telemetry, no remote config. Server configs stay in browser storage. The native helper runs without admin rights. The full permission list and rationale is in the [privacy policy](./site/PRIVACY.md).

**Does Noctis work on Windows, macOS and Linux?**
Yes — Chromium-based browsers on Windows, macOS and Linux (Chrome, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser). The native helper has one-line install scripts for each platform.

**Can I use a subscription URL to auto-update servers?**
Yes. Paste a subscription URL once and Noctis refreshes it on a schedule. Server lists update automatically; pinned and active selections survive refreshes.

**Will Noctis help bypass website blocks?**
Noctis itself is just a proxy client — it routes your browser through whatever server you provide. If your server is in a region where the site you want to reach is accessible, Noctis routes you there. It does not provide servers; you supply them.

**Does Noctis block WebRTC leaks?**
Yes. An optional toggle blocks UDP outside the proxy so WebRTC can't reveal your real IP while the proxy is active.

**How much does Noctis cost?**
Free. The extension is free in the Chrome Web Store and the native helper is open-source under MIT. You only pay for the proxy servers you choose to use.

## 🙏 Acknowledgments

- **[sing-box](https://github.com/SagerNet/sing-box)** (GPL-3.0), **[xray-core](https://github.com/XTLS/Xray-core)** (MPL-2.0) and **[mihomo](https://github.com/MetaCubeX/mihomo)** (GPL-3.0) — the proxy engines that do all upstream routing and encryption. Noctis is a control surface; the engine does the actual work, and Noctis auto-picks the right one per server.
- **[V2Ray](https://github.com/v2fly/v2ray-core)** and **[Xray](https://github.com/XTLS/Xray-core)** — the upstream protocol designs (VLESS, VMess, Reality) that Noctis speaks.

## ⚖️ Legal

- License — proprietary EULA: see [LICENSE](./site/LICENSE.md) or <https://noctis.c0nn3ct.info/license/>.
- Privacy — see [PRIVACY](./site/PRIVACY.md) or <https://noctis.c0nn3ct.info/privacy/>.
- Native helper — MIT-licensed: see [`host/`](./host).
- Proxy engines — sing-box (GPL-3.0), xray-core (MPL-2.0) and mihomo (GPL-3.0), each redistributed under its upstream license.
