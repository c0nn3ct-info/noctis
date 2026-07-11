[English](./README.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [中文](./README.zh-CN.md) · [فارسی](./README.fa.md) · [العربية](./README.ar.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/logo-dark.png">
    <img alt="Noctis" src="./site/media/logo-light.png" width="120">
  </picture>
</p>

<p align="center"><strong>Расширение VLESS для браузера Chrome</strong></p>
<p align="center"><em>Маршрутизация трафика браузера через ваши прокси — без системного VPN.</em></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn"><img src="https://img.shields.io/chrome-web-store/v/nmhobajopepdpihahepaddpdifdcenpn?label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store"></a>
  <a href="./site/LICENSE.md"><img src="https://img.shields.io/badge/license-EULA-blue" alt="Лицензия: EULA"></a>
  <a href="https://github.com/c0nn3ct-info/noctis"><img src="https://img.shields.io/badge/helper-MIT-green" alt="Helper: MIT"></a>
  <a href="https://noctis.c0nn3ct.info"><img src="https://img.shields.io/badge/site-noctis.c0nn3ct.info-7c3aed" alt="Сайт"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/demo-dark.gif">
    <img alt="Noctis demo" src="./site/media/demo-light.gif" width="720">
  </picture>
</p>

> [!IMPORTANT]
> Noctis — это прокси для браузера, а не системный VPN. Маршрутизируется только трафик Chrome; остальная ОС остаётся на вашем реальном подключении. Расширение бесплатно под проприетарной EULA; нативный хелпер — open source (MIT).

Noctis — бесплатное расширение, которое маршрутизирует трафик Chrome через ваши собственные прокси VLESS, VMess, Trojan, Shadowsocks, Hysteria2, Reality и другие — через локальный хелпер, управляющий подключаемым движком прокси: sing-box, xray-core или mihomo. Никакого системного VPN, никакого отдельного клиента — прокси работает прямо внутри браузера.

## ✨ Возможности

- **Подключаемый движок прокси** — Noctis поставляется с sing-box и умеет управлять xray-core или mihomo, автоматически выбирая нужный движок под каждый сервер — поэтому xhttp, потоки REALITY-vision, Snell и другое просто работают.
- **Серверы из share-ссылок, QR-кодов и subscription URL** — Вставьте `vless://`, `vmess://`, `trojan://`, `ss://`, `hysteria2://`, `tuic://`, `wireguard://` — или отсканируйте QR. Subscription URL обновляются по расписанию автоматически.
- **Маршрутизация по правилам** — Сопоставление по домену, GeoSite или GeoIP. Каждое правило направляет в прокси, напрямую или блокирует.
- **Три режима маршрутизации** — Global — всё через прокси. Rules — только совпадения по правилам. Direct — обход прокси полностью.
- **Health checks и автоматический failover** — Фоновые замеры задержки; ручной пинг по одному клику. Неработающие серверы автоматически уходят из активного маршрута.
- **Закреплённые серверы** — Три избранных сервера всегда наверху popup. Переключайте активный сервер без открытия полной панели.
- **Живой поток логов** — stdout и stderr движка прокси стримятся прямо в расширение. Диагностика подключений без выхода из браузера.
- **Защита от утечек WebRTC** — Опциональный тумблер блокирует UDP мимо прокси, чтобы WebRTC не раскрыл ваш реальный IP.
- **Встроенные правила блокировки рекламы и трекеров** — Семейства `geosite:ads` по умолчанию маршрутизируются в block. Можно отключить, если предпочитаете решать это иначе.

## 🔌 Поддерживаемые протоколы

`VLESS` · `VLESS Reality` · `VMess` · `Trojan` · `Shadowsocks` · `Hysteria/2` · `TUIC` · `WireGuard` · `AnyTLS` · `ShadowTLS`

Noctis поддерживает VLESS (включая VLESS Reality), VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS и ShadowTLS. Конфиги от V2Ray, Xray и панелей 3X-UI работают как есть — вставьте share-ссылку или subscription URL, и расширение автоматически переведёт её в конфиг нужного движка. xray открывает xhttp/splithttp и варианты потоков XTLS; mihomo добавляет Snell, SSR и другое.

## 🧩 Как это устроено

Браузер не может сам запустить движок прокси. Три части разделяют работу через границу песочницы — и стрелка между ними единственное место, где идут сообщения.

```
  Browser                                    Ваша машина
  ┌──────────────────┐  native messaging   ┌──────────────────┐
  │ Расширение       │ ◀─────────────────▶ │  noctis-host     │
  │ Noctis           │   события · логи    │ (нативный хелпер)│
  │ popup · panel    │                     └────────┬─────────┘
  └────────┬─────────┘                              │ запуск · конфиг
           │                                        ▼
           │                                ┌──────────────────┐
           │  Chrome proxy → SOCKS/HTTP     │  движок прокси   │
           └───────────────────────────────▶│                  │
                                            └────────┬─────────┘
                                                     │ шифрованный канал
                                                     ▼
                                            ┌──────────────────┐
                                            │ Прокси-серверы   │
                                            └──────────────────┘
```

Noctis по умолчанию поставляется с sing-box и умеет управлять xray-core и mihomo. Небольшой нативный хелпер следит за движком на вашей машине, а Noctis автоматически выбирает нужный под каждый сервер — поэтому протоколы, которые не тянет один движок, просто работают. xray открывает xhttp/splithttp и варианты потоков XTLS (REALITY-vision); mihomo добавляет Snell, SSR и Mieru. Расширение в браузере отправляет только решения о маршрутизации — никогда сырой трафик.

## 📥 Установка

Расширению Noctis нужен небольшой нативный хелпер на вашей машине. Хелпер управляет движком прокси — sing-box, xray или mihomo — который и проксирует трафик.

### Перед установкой

- Браузер на Chromium версии 120 или новее (Chrome, Chromium, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser).
- Около 100 МБ свободного места для хелпера и движков прокси.
- Без admin / root прав — всё устанавливается в ваш пользовательский аккаунт.

### Установите расширение

Установите Noctis из [Chrome Web Store](https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn). Откройте расширение после установки — оно обнаружит отсутствие хелпера и покажет диалог установки с уже подставленной командой для вашей машины.

### Запустите установщик хелпера

Скопируйте команду из диалога Helper Setup и вставьте в терминал. ID расширения уже подставлен — искать ничего не нужно. Для справки команда выглядит так:

Исходники хелпера: <https://github.com/c0nn3ct-info/noctis>

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

Установщик скачивает noctis-host и движки прокси (sing-box, xray, mihomo) в каталог пользовательских данных и пишет манифест native-messaging для каждого поддерживаемого браузера.

При первом обращении расширения к хелперу браузер может показать одноразовое подтверждение native-messaging — подтвердите его.

### Первый запуск

Откройте popup расширения, вставьте share-ссылку `vless://`, `ss://` или `trojan://` (или subscription URL), переключите активный сервер. Статус-бейдж становится зелёным, как только движок принимает трафик.

### Обновление

Запустите ту же команду для вашей ОС повторно — скрипт идемпотентен и заменит существующие бинарники.

### Удаление

1. Удалите расширение через `chrome://extensions`.
2. Удалите каталог данных Noctis:
   - macOS / Linux: `~/.local/share/noctis`
   - Windows: `%LOCALAPPDATA%\Noctis`

## ❓ FAQ

**Что такое VLESS и зачем он нужен в браузере?**
VLESS — это легковесный прокси-протокол из семейства V2Ray/Xray. Сам по себе он не шифрует трафик — за шифрование отвечает TLS — поэтому быстрый и легко маскируется под обычный HTTPS. Использование VLESS через расширение браузера означает, что проксируется только трафик браузера; остальная операционная система остаётся на вашем реальном подключении.

**Чем расширение-прокси для браузера отличается от VPN?**
VPN тоннелирует все приложения системы через одно соединение и обычно требует прав администратора. Прокси-расширение для браузера вроде Noctis маршрутизирует только браузер, не требует root или admin и позволяет одновременно держать Zoom, Steam, Telegram desktop и торренты на вашем реальном подключении.

**Поддерживает ли Noctis VLESS Reality?**
Да. Noctis передаёт параметры Reality (Server Name, Fingerprint, SNI, Dest, public key, short ID) хелперу без изменений и запускает сервер на движке, который их поддерживает — xray обеспечивает полный поток XTLS-vision. Вставьте share-ссылку `vless://...flow=xtls-rprx-vision&security=reality` — расширение импортирует все поля.

**Какие протоколы прокси поддерживает Noctis?**
VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, AnyTLS и ShadowTLS — плюс xhttp/splithttp, Snell, SSR и другое через xray и mihomo. Share-ссылки V2Ray и Xray работают как есть.

**Безопасно ли использовать прокси-расширение для Chrome?**
Безопаснее большинства. Noctis ничего не отправляет разработчику — никакой аналитики, телеметрии, удалённой конфигурации. Конфиги серверов хранятся в storage браузера. Нативный хелпер работает без прав администратора. Полный список разрешений и обоснование — в [политике приватности](./site/PRIVACY.md).

**Работает ли Noctis на Windows, macOS и Linux?**
Да — в Chromium-браузерах на Windows, macOS и Linux (Chrome, Edge, Brave, Arc, Vivaldi, Opera, Yandex Browser). Установщик хелпера — одна команда для каждой платформы.

**Можно ли подключить subscription URL для автообновления серверов?**
Да. Вставьте subscription URL один раз — Noctis будет обновлять его по расписанию. Списки серверов обновляются автоматически; закреплённые и активный серверы сохраняются между обновлениями.

**Поможет ли Noctis обойти блокировку Telegram, YouTube и других сервисов?**
Noctis — это всего лишь прокси-клиент, который маршрутизирует браузер через сервер, который вы предоставили. Если ваш сервер находится в регионе, где нужный сайт доступен, Noctis доведёт вас туда. Серверы Noctis не предоставляет — их добавляете вы.

**Поддерживается ли защита от утечек WebRTC?**
Да. Опциональный тумблер блокирует UDP мимо прокси, чтобы WebRTC не раскрыл ваш реальный IP, пока прокси активен.

**Сколько стоит расширение Noctis?**
Бесплатно. Расширение бесплатно в Chrome Web Store, нативный хелпер — open-source под MIT. Вы платите только за прокси-серверы, которые выбираете сами.

## 🙏 Благодарности

- **[sing-box](https://github.com/SagerNet/sing-box)** (GPL-3.0), **[xray-core](https://github.com/XTLS/Xray-core)** (MPL-2.0) и **[mihomo](https://github.com/MetaCubeX/mihomo)** (GPL-3.0) — движки прокси, которые делают всю upstream-маршрутизацию и шифрование. Noctis — управляющая поверхность; работу делает движок, а Noctis автоматически выбирает нужный под каждый сервер.
- **[V2Ray](https://github.com/v2fly/v2ray-core)** и **[Xray](https://github.com/XTLS/Xray-core)** — оригинальный дизайн протоколов (VLESS, VMess, Reality), которые Noctis говорит.

## ⚖️ Юридическая информация

- Лицензия — проприетарная EULA: см. [LICENSE](./site/LICENSE.md) или <https://noctis.c0nn3ct.info/ru/license/>.
- Приватность — см. [PRIVACY](./site/PRIVACY.md) или <https://noctis.c0nn3ct.info/ru/privacy/>.
- Нативный хелпер — лицензия MIT: см. <https://github.com/c0nn3ct-info/noctis>.
- Движки прокси — sing-box (GPL-3.0), xray-core (MPL-2.0) и mihomo (GPL-3.0), каждый переиздаётся под своей upstream-лицензией.
