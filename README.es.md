[English](./README.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [中文](./README.zh-CN.md) · [فارسی](./README.fa.md) · [العربية](./README.ar.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/logo-dark.png">
    <img alt="Noctis" src="./site/media/logo-light.png" width="120">
  </picture>
</p>

<p align="center"><strong>Extensión VLESS para el navegador Chrome</strong></p>
<p align="center"><em>Enruta el tráfico del navegador a través de tus propios proxies — sin una VPN de sistema.</em></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn"><img src="https://img.shields.io/chrome-web-store/v/nmhobajopepdpihahepaddpdifdcenpn?label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store"></a>
  <a href="./site/LICENSE.md"><img src="https://img.shields.io/badge/license-EULA-blue" alt="Licencia: EULA"></a>
  <a href="https://github.com/c0nn3ct-info/noctis"><img src="https://img.shields.io/badge/helper-MIT-green" alt="Helper: MIT"></a>
  <a href="https://noctis.c0nn3ct.info"><img src="https://img.shields.io/badge/site-noctis.c0nn3ct.info-7c3aed" alt="Sitio web"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/demo-dark.gif">
    <img alt="Noctis demo" src="./site/media/demo-light.gif" width="720">
  </picture>
</p>

> [!IMPORTANT]
> Noctis es un proxy para el navegador, no una VPN de sistema. Solo se enruta el tráfico de Chrome; el resto de tu sistema operativo se queda en tu conexión real. La extensión es gratuita bajo una EULA propietaria; el helper nativo es de código abierto (MIT).

Noctis es una extensión de navegador gratuita que enruta Chrome a través de VLESS, VMess, Trojan, Shadowsocks, Hysteria2, Reality y otros servidores proxy mediante un helper local que controla un motor de proxy modular: sing-box, xray-core o mihomo. Sin VPN de sistema, sin ventana de cliente aparte: el proxy se queda dentro del navegador.

## ✨ Funciones

- **Motor de proxy modular** — Noctis incluye sing-box y también puede controlar xray-core o mihomo, eligiendo automáticamente el motor que necesita cada servidor — así xhttp, los flujos REALITY-vision, Snell y más simplemente funcionan.
- **Servidores desde enlaces de compartir, QR o URL de suscripción** — Pega `vless://`, `vmess://`, `trojan://`, `ss://`, `hysteria2://`, `tuic://`, `wireguard://` — o escanea un código QR. Las URL de suscripción se actualizan automáticamente según un horario.
- **Enrutamiento por reglas** — Coincidencia por dominio, GeoSite o GeoIP. Cada regla enruta a proxy, directo o bloqueo.
- **Tres modos de enrutamiento** — Global envía todo a través del proxy. Rules solo enruta las coincidencias. Direct lo omite por completo.
- **Comprobaciones de estado + conmutación automática** — Sondeos de latencia en segundo plano; ping manual con un toque por servidor. Los servidores que fallan salen de la ruta activa.
- **Lista de servidores fijados** — Mantén tres favoritos en la parte superior del popup. Cambia el servidor activo sin abrir el panel completo.
- **Flujo de registros en vivo** — La salida stdout y stderr del motor de proxy se transmite a la extensión. Diagnostica problemas de conexión sin salir del navegador.
- **Protección contra fugas de WebRTC** — Un interruptor opcional bloquea el UDP fuera del proxy para que WebRTC no pueda revelar tu IP real.
- **Reglas integradas de bloqueo de anuncios y rastreadores** — Las familias `geosite:ads` se enrutan a bloqueo de forma predeterminada. Desactívalo si prefieres gestionarlo en otro sitio.

## 🔌 Protocolos de proxy compatibles

`VLESS` · `VLESS Reality` · `VMess` · `Trojan` · `Shadowsocks` · `Hysteria/2` · `TUIC` · `WireGuard` · `AnyTLS` · `ShadowTLS`

Noctis admite VLESS (incluido VLESS Reality), VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS y ShadowTLS. Las configuraciones de los paneles V2Ray, Xray y 3X-UI funcionan tal cual — pega un enlace de compartir o una URL de suscripción y la extensión la traduce automáticamente a la configuración del motor adecuado. xray habilita xhttp/splithttp y variantes de flujo XTLS; mihomo añade Snell, SSR y más.

## 🧩 Cómo funciona

Los navegadores no pueden ejecutar por sí solos un motor de proxy. Tres piezas reparten el trabajo a través de la frontera del sandbox — y la flecha que la cruza es el único lugar por donde fluyen los mensajes.

```
  Navegador                                  Tu equipo
  ┌──────────────────┐  native messaging   ┌──────────────────┐
  │ Extensión        │ ◀─────────────────▶ │  noctis-host     │
  │ Noctis           │   eventos · logs    │ (helper nativo)  │
  │ popup · panel    │                     └────────┬─────────┘
  └────────┬─────────┘                              │ arranque · config
           │                                        ▼
           │                                ┌──────────────────┐
           │  Chrome proxy → SOCKS/HTTP     │  motor de proxy  │
           └───────────────────────────────▶│                  │
                                            └────────┬─────────┘
                                                     │ cifrado
                                                     ▼
                                            ┌──────────────────┐
                                            │ Servidores proxy │
                                            └──────────────────┘
```

Noctis incluye sing-box de forma predeterminada y también puede controlar xray-core y mihomo. Un pequeño helper nativo supervisa el motor en tu equipo, y Noctis elige el adecuado para cada servidor automáticamente — así los protocolos que un solo motor no puede manejar simplemente funcionan. xray habilita xhttp/splithttp y las variantes de flujo XTLS (REALITY-vision); mihomo añade Snell, SSR y Mieru. La extensión del navegador solo envía decisiones de enrutamiento, nunca tráfico en bruto.

## 📥 Instalación

La extensión Noctis necesita un pequeño helper nativo ejecutándose en tu equipo. El helper supervisa el motor de proxy —sing-box, xray o mihomo— que realmente hace el proxy.

### Antes de empezar

- Un navegador basado en Chromium, versión 120 o más reciente (Chrome, Chromium, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser).
- Unos 100 MB de disco libre para el helper y los motores de proxy.
- Sin permisos de administrador / root — todo se instala en tu cuenta de usuario.

### Instala la extensión

Instala Noctis desde [Chrome Web Store](https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn). Abre la extensión tras instalarla — detectará que falta el helper y mostrará un diálogo de configuración con un comando ya rellenado para tu equipo.

### Ejecuta el instalador del helper

Copia el comando del diálogo Helper Setup de la extensión y pégalo en tu terminal. El ID de tu extensión ya está incluido — no necesitas buscarlo. A modo de referencia, el comando tiene este aspecto:

Código fuente del helper: <https://github.com/c0nn3ct-info/noctis>

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

El instalador descarga noctis-host y los motores de proxy (sing-box, xray, mihomo) en tu directorio de datos de usuario y escribe un manifiesto de native-messaging para cada navegador compatible.

La primera vez que la extensión se comunica con el helper, tu navegador puede mostrar un aviso único de native-messaging — apruébalo.

### Primer arranque

Abre el popup de la extensión, pega un enlace de compartir `vless://`, `ss://` o `trojan://` (o una URL de suscripción) y activa el servidor. La insignia de estado se vuelve verde en cuanto el motor acepta tráfico.

### Actualización

Vuelve a ejecutar el comando de una línea para tu sistema operativo — el script es idempotente y reemplazará los binarios existentes.

### Desinstalación

1. Elimina la extensión desde `chrome://extensions`.
2. Borra el directorio de datos de Noctis:
   - macOS / Linux: `~/.local/share/noctis`
   - Windows: `%LOCALAPPDATA%\Noctis`

## ❓ Preguntas frecuentes

**¿Qué es VLESS y por qué usarlo en un navegador?**
VLESS es un protocolo de proxy ligero de la familia V2Ray/Xray. No lleva cifrado propio —de eso se encarga TLS—, por lo que es rápido y fácil de disfrazar como HTTPS normal. Usar VLESS a través de una extensión de navegador significa que solo se proxea el tráfico del navegador; el resto de tu sistema operativo se queda en tu conexión real.

**¿En qué se diferencia una extensión proxy de navegador de una VPN?**
Una VPN tuneliza todas las aplicaciones de tu sistema a través de una única conexión y normalmente necesita permisos de administrador. Una extensión proxy de navegador como Noctis solo enruta el navegador, no requiere root ni administrador, y te permite mantener Zoom, Steam, Telegram para escritorio y los torrents en tu red real al mismo tiempo.

**¿Noctis admite VLESS Reality?**
Sí. Noctis pasa los parámetros de Reality (Server Name, Fingerprint, SNI, Dest, clave pública, short ID) al helper sin modificarlos y ejecuta el servidor en un motor que los admite — xray ofrece el flujo XTLS-vision completo. Pega un enlace de compartir `vless://...flow=xtls-rprx-vision&security=reality` y la extensión importa todos los campos.

**¿Qué protocolos de proxy admite Noctis?**
VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS y ShadowTLS — además de xhttp/splithttp, Snell, SSR y más mediante xray y mihomo. Los enlaces de compartir de V2Ray y Xray funcionan tal cual.

**¿Es seguro usar una extensión proxy de Chrome?**
Más segura que la mayoría. Noctis no envía nada a su desarrollador — ni analíticas, ni telemetría, ni configuración remota. Las configuraciones de servidor se quedan en el almacenamiento del navegador. El helper nativo se ejecuta sin permisos de administrador. La lista completa de permisos y su justificación están en la [política de privacidad](./site/PRIVACY.md).

**¿Noctis funciona en Windows, macOS y Linux?**
Sí — en navegadores basados en Chromium en Windows, macOS y Linux (Chrome, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser). El helper nativo tiene scripts de instalación de una línea para cada plataforma.

**¿Puedo usar una URL de suscripción para actualizar los servidores automáticamente?**
Sí. Pega una URL de suscripción una vez y Noctis la actualiza según un horario. Las listas de servidores se actualizan automáticamente; las selecciones fijadas y la activa sobreviven a las actualizaciones.

**¿Noctis ayuda a sortear los bloqueos de sitios web?**
Noctis en sí solo es un cliente de proxy — enruta tu navegador a través del servidor que tú le indiques. Si tu servidor está en una región donde el sitio al que quieres acceder está disponible, Noctis te lleva allí. No proporciona servidores; tú los aportas.

**¿Noctis bloquea las fugas de WebRTC?**
Sí. Un interruptor opcional bloquea el UDP fuera del proxy para que WebRTC no pueda revelar tu IP real mientras el proxy está activo.

**¿Cuánto cuesta Noctis?**
Es gratis. La extensión es gratuita en Chrome Web Store y el helper nativo es de código abierto bajo MIT. Solo pagas por los servidores proxy que decidas usar.

## 🙏 Agradecimientos

- **[sing-box](https://github.com/SagerNet/sing-box)** (GPL-3.0), **[xray-core](https://github.com/XTLS/Xray-core)** (MPL-2.0) y **[mihomo](https://github.com/MetaCubeX/mihomo)** (GPL-3.0) — los motores de proxy que se encargan de todo el enrutamiento y el cifrado upstream. Noctis es una superficie de control; el trabajo de verdad lo hace el motor, y Noctis elige el adecuado para cada servidor.
- **[V2Ray](https://github.com/v2fly/v2ray-core)** y **[Xray](https://github.com/XTLS/Xray-core)** — los diseños de protocolo originales (VLESS, VMess, Reality) que Noctis habla.

## ⚖️ Información legal

- Licencia — EULA propietaria: consulta [LICENSE](./site/LICENSE.md) o <https://noctis.c0nn3ct.info/es/license/>.
- Privacidad — consulta [PRIVACY](./site/PRIVACY.md) o <https://noctis.c0nn3ct.info/es/privacy/>.
- Helper nativo — con licencia MIT: consulta <https://github.com/c0nn3ct-info/noctis>.
- Motores de proxy — sing-box (GPL-3.0), xray-core (MPL-2.0) y mihomo (GPL-3.0), cada uno redistribuido bajo su licencia upstream.
