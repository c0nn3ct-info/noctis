[English](./README.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [中文](./README.zh-CN.md) · [فارسی](./README.fa.md) · [العربية](./README.ar.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/logo-dark.png">
    <img alt="Noctis" src="./site/media/logo-light.png" width="120">
  </picture>
</p>

<p align="center"><strong>Chrome 的 VLESS 浏览器扩展</strong></p>
<p align="center"><em>让浏览器流量走你自己的代理——无需系统级 VPN。</em></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn"><img src="https://img.shields.io/chrome-web-store/v/nmhobajopepdpihahepaddpdifdcenpn?label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store"></a>
  <a href="./site/LICENSE.md"><img src="https://img.shields.io/badge/license-EULA-blue" alt="许可：EULA"></a>
  <a href="https://github.com/c0nn3ct-info/noctis"><img src="https://img.shields.io/badge/helper-MIT-green" alt="Helper: MIT"></a>
  <a href="https://noctis.c0nn3ct.info"><img src="https://img.shields.io/badge/site-noctis.c0nn3ct.info-7c3aed" alt="站点"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/demo-dark.gif">
    <img alt="Noctis demo" src="./site/media/demo-light.gif" width="720">
  </picture>
</p>

> [!IMPORTANT]
> Noctis 是浏览器代理，而非系统级 VPN。只有 Chrome 的流量会被路由；操作系统的其余部分仍走你的真实连接。扩展在专有 EULA 下免费提供；原生助手开源（MIT）。

Noctis 是一款免费的浏览器扩展，它通过一个本地助手驱动可插拔的代理引擎——sing-box、xray-core 或 mihomo——把 Chrome 的流量路由到 VLESS、VMess、Trojan、Shadowsocks、Hysteria2、Reality 等代理服务器。无需系统级 VPN，也没有单独的客户端窗口——代理始终在浏览器内部进行。

## ✨ 功能

- **可插拔的代理引擎** — Noctis 自带 sing-box，也能驱动 xray-core 或 mihomo，并为每台服务器自动挑选所需的引擎——因此 xhttp、REALITY-vision 流、Snell 等都能直接使用。
- **从分享链接、二维码或订阅 URL 添加服务器** — 粘贴 `vless://`、`vmess://`、`trojan://`、`ss://`、`hysteria2://`、`tuic://`、`wireguard://`——或扫描二维码。订阅 URL 会按计划自动刷新。
- **按规则路由** — 按域名、GeoSite 或 GeoIP 匹配。每条规则可路由到代理、直连或拦截。
- **三种路由模式** — 全局模式让所有流量都走代理。规则模式只路由匹配项。直连模式完全绕过代理。
- **健康检查 + 自动故障转移** — 后台探测延迟；每台服务器可一键手动 ping。失效的服务器会自动从活动路由中剔除。
- **置顶服务器快捷列表** — 把三台收藏的服务器固定在弹窗顶部。无需打开完整面板即可切换活动服务器。
- **实时日志流** — 代理引擎的 stdout 和 stderr 直接流入扩展。无需离开浏览器即可诊断连接问题。
- **WebRTC 泄漏防护** — 可选开关，阻止代理之外的 UDP，让 WebRTC 无法暴露你的真实 IP。
- **内置广告和追踪器拦截规则** — `geosite:ads` 系列默认路由到拦截。如果你更愿意在别处处理，可以关闭它。

## 🔌 支持的代理协议

`VLESS` · `VLESS Reality` · `VMess` · `Trojan` · `Shadowsocks` · `Hysteria/2` · `TUIC` · `WireGuard` · `AnyTLS` · `ShadowTLS`

Noctis 支持 VLESS（包括 VLESS Reality）、VMess、Trojan、Shadowsocks、Hysteria2、TUIC、WireGuard、AnyTLS 和 ShadowTLS。来自 V2Ray、Xray 和 3X-UI 面板的配置可直接使用——粘贴分享链接或订阅 URL，扩展会自动把它转换成相应引擎的配置。xray 解锁 xhttp/splithttp 和 XTLS 流变体；mihomo 增加 Snell、SSR 等。

## 🧩 工作原理

浏览器自己无法运行代理引擎。三个部分把工作分摊到沙箱边界两侧——而跨越边界的那个箭头是消息流动的唯一通道。

```
  Browser                                    你的机器
  ┌──────────────────┐  native messaging   ┌──────────────────┐
  │ Noctis 扩展      │ ◀─────────────────▶ │  noctis-host     │
  │ popup · panel    │   事件 · 日志       │ (原生助手)       │
  │ options          │                     └────────┬─────────┘
  └────────┬─────────┘                              │ 启动 · 配置
           │                                        ▼
           │                                ┌──────────────────┐
           │  Chrome proxy → SOCKS/HTTP     │   代理引擎       │
           └───────────────────────────────▶│                  │
                                            └────────┬─────────┘
                                                     │ 加密通道
                                                     ▼
                                            ┌──────────────────┐
                                            │   代理服务器     │
                                            └──────────────────┘
```

Noctis 默认自带 sing-box，也能驱动 xray-core 和 mihomo。一个小型原生助手在你的机器上管理引擎，Noctis 会为每台服务器自动挑选合适的引擎——因此单一引擎无法处理的协议也能直接使用。xray 解锁 xhttp/splithttp 和 XTLS 流变体（REALITY-vision）；mihomo 增加 Snell、SSR 和 Mieru。浏览器扩展只发送路由决策——绝不传输原始流量。

## 📥 安装

Noctis 扩展需要在你的机器上运行一个小型原生助手。该助手负责管理代理引擎——sing-box、xray 或 mihomo——也就是真正执行代理的引擎。

### 开始之前

- 基于 Chromium 的浏览器，版本 120 或更新（Chrome、Chromium、Edge、Brave、Arc、Vivaldi、Opera、Yandex Browser）。
- 约 100 MB 的可用磁盘空间，用于助手和各代理引擎。
- 无需管理员 / root 权限——一切都安装到你的用户账户中。

### 安装扩展

从 [Chrome Web Store](https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn) 安装 Noctis。安装后打开扩展——它会检测到助手缺失，并显示一个安装对话框，其中已为你的机器预填好一行命令。

### 运行助手安装程序

从扩展的 Helper Setup 对话框中复制命令，粘贴到你的终端。你的扩展 ID 已经填好——无需自己查找。供参考，命令大致如下：

助手源代码：<https://github.com/c0nn3ct-info/noctis>

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

安装程序会把 noctis-host 和各代理引擎（sing-box、xray、mihomo）下载到你的用户数据目录，并为每个受支持的浏览器写入 native-messaging 清单。

扩展第一次与助手通信时，你的浏览器可能会显示一次性的 native-messaging 提示——请批准它。

### 首次运行

打开扩展的弹窗，粘贴一条 `vless://`、`ss://` 或 `trojan://` 分享链接（或一个订阅 URL），然后切换活动服务器。一旦引擎开始接受流量，状态徽标就会变绿。

### 更新

重新运行适用于你操作系统的那行命令——脚本是幂等的，会替换现有的二进制文件。

### 卸载

1. 通过 `chrome://extensions` 移除扩展。
2. 删除 Noctis 数据目录：
   - macOS / Linux：`~/.local/share/noctis`
   - Windows：`%LOCALAPPDATA%\Noctis`

## ❓ FAQ

**什么是 VLESS，为什么要在浏览器里用它？**
VLESS 是 V2Ray/Xray 家族中一种轻量级代理协议。它本身不做加密——加密由 TLS 负责——因此速度快，且容易伪装成普通的 HTTPS。通过浏览器扩展使用 VLESS，意味着只有浏览器流量被代理；操作系统的其余部分仍走你的真实连接。

**浏览器代理扩展和 VPN 有什么区别？**
VPN 把系统上的每个应用都通过一条连接隧道化，通常还需要管理员权限。像 Noctis 这样的浏览器代理扩展只路由浏览器，无需 root 或管理员权限，让你可以同时把 Zoom、Steam、Telegram 桌面端和 BT 下载保留在真实网络上。

**Noctis 支持 VLESS Reality 吗？**
支持。Noctis 会把 Reality 参数（Server Name、Fingerprint、SNI、Dest、public key、short ID）原样传给助手，并在支持它的引擎上运行该服务器——xray 提供完整的 XTLS-vision 流。粘贴一条 `vless://...flow=xtls-rprx-vision&security=reality` 分享链接，扩展会导入其中每个字段。

**Noctis 支持哪些代理协议？**
VLESS、VMess、Trojan、Shadowsocks、Hysteria2、TUIC、WireGuard、AnyTLS 和 ShadowTLS——此外还通过 xray 和 mihomo 支持 xhttp/splithttp、Snell、SSR 等。V2Ray 和 Xray 的分享链接可直接使用。

**Chrome 代理扩展用起来安全吗？**
比大多数更安全。Noctis 不向开发者发送任何东西——没有分析、没有遥测、没有远程配置。服务器配置保存在浏览器存储中。原生助手无需管理员权限即可运行。完整的权限清单和说明在[隐私政策](./site/PRIVACY.md)中。

**Noctis 能在 Windows、macOS 和 Linux 上运行吗？**
可以——Windows、macOS 和 Linux 上基于 Chromium 的浏览器（Chrome、Edge、Brave、Arc、Vivaldi、Opera、Yandex Browser）。原生助手为每个平台都提供了一行命令的安装脚本。

**我能用订阅 URL 来自动更新服务器吗？**
可以。只需粘贴一次订阅 URL，Noctis 就会按计划刷新它。服务器列表会自动更新；置顶和活动选择会在刷新后保留。

**Noctis 能帮我绕过网站封锁吗？**
Noctis 本身只是一个代理客户端——它把你的浏览器路由到你提供的任意服务器。如果你的服务器位于某个能访问目标站点的地区，Noctis 就会把你路由到那里。它不提供服务器；服务器由你自备。

**Noctis 会阻止 WebRTC 泄漏吗？**
会。一个可选开关会阻止代理之外的 UDP，让 WebRTC 在代理处于活动状态时无法暴露你的真实 IP。

**Noctis 收费吗？**
免费。扩展在 Chrome Web Store 上免费，原生助手在 MIT 许可下开源。你只需为自己选用的代理服务器付费。

## 🙏 致谢

- **[sing-box](https://github.com/SagerNet/sing-box)**（GPL-3.0）、**[xray-core](https://github.com/XTLS/Xray-core)**（MPL-2.0）和 **[mihomo](https://github.com/MetaCubeX/mihomo)**（GPL-3.0）— 负责所有上游路由和加密的代理引擎。Noctis 是控制层；真正的工作由引擎完成，Noctis 会为每台服务器自动挑选合适的引擎。
- **[V2Ray](https://github.com/v2fly/v2ray-core)** 和 **[Xray](https://github.com/XTLS/Xray-core)** — 上游的协议设计（VLESS、VMess、Reality），Noctis 使用它们。

## ⚖️ 法律信息

- 许可 — 专有 EULA：见 [LICENSE](./site/LICENSE.md) 或 <https://noctis.c0nn3ct.info/zh-CN/license/>。
- 隐私 — 见 [PRIVACY](./site/PRIVACY.md) 或 <https://noctis.c0nn3ct.info/zh-CN/privacy/>。
- 原生助手 — MIT 许可：见 <https://github.com/c0nn3ct-info/noctis>。
- 代理引擎 — sing-box（GPL-3.0）、xray-core（MPL-2.0）和 mihomo（GPL-3.0），各自在其上游许可下重新分发。
