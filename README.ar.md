[English](./README.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [中文](./README.zh-CN.md) · [فارسی](./README.fa.md) · [العربية](./README.ar.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/logo-dark.png">
    <img alt="Noctis" src="./site/media/logo-light.png" width="120">
  </picture>
</p>

<p align="center"><strong>إضافة VLESS لمتصفّح Chrome</strong></p>
<p align="center"><em>وجّه ترافيك المتصفّح عبر وكلائك الخاصين — دون VPN على مستوى النظام.</em></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn"><img src="https://img.shields.io/chrome-web-store/v/nmhobajopepdpihahepaddpdifdcenpn?label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store"></a>
  <a href="./site/LICENSE.md"><img src="https://img.shields.io/badge/license-EULA-blue" alt="الترخيص: EULA"></a>
  <a href="https://github.com/c0nn3ct-info/noctis"><img src="https://img.shields.io/badge/helper-MIT-green" alt="المساعد: MIT"></a>
  <a href="https://noctis.c0nn3ct.info"><img src="https://img.shields.io/badge/site-noctis.c0nn3ct.info-7c3aed" alt="الموقع"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/media/demo-dark.gif">
    <img alt="Noctis demo" src="./site/media/demo-light.gif" width="720">
  </picture>
</p>

> [!IMPORTANT]
> Noctis وكيل للمتصفّح — وليس VPN على مستوى النظام. يُوجَّه ترافيك Chrome وحده؛ أمّا بقية نظام التشغيل فتبقى على اتصالك الحقيقي. الإضافة مجانية بترخيص EULA مملوك؛ والمساعد الأصلي مفتوح المصدر (MIT).

Noctis إضافة متصفّح مجانية توجّه ترافيك Chrome عبر خوادم VLESS وVMess وTrojan وShadowsocks وHysteria2 وReality وغيرها من خلال مساعد محلي يشغّل محرّك وكيل قابلًا للتبديل — sing-box أو xray-core أو mihomo. لا VPN على مستوى النظام، ولا نافذة عميل منفصلة — يبقى التوكيل داخل المتصفّح.

## ✨ المزايا

- **محرّك وكيل قابل للتبديل** — يأتي Noctis مع sing-box ويمكنه أيضًا تشغيل xray-core أو mihomo، ويختار تلقائيًا المحرّك الذي يحتاجه كل خادم — فيعمل xhttp وتدفّقات REALITY-vision وSnell وغيرها ببساطة.
- **خوادم من روابط المشاركة أو رمز QR أو روابط الاشتراك** — الصق `vless://` أو `vmess://` أو `trojan://` أو `ss://` أو `hysteria2://` أو `tuic://` أو `wireguard://` — أو امسح رمز QR. تتحدّث روابط الاشتراك تلقائيًا وفق جدول زمني.
- **توجيه لكل قاعدة** — طابِق حسب النطاق أو GeoSite أو GeoIP. توجّه كل قاعدة إلى الوكيل أو مباشر أو حظر.
- **ثلاثة أوضاع توجيه** — الوضع الشامل يرسل كل شيء عبر الوكيل. وضع القواعد يوجّه المطابقات فقط. الوضع المباشر يتجاوز الوكيل بالكامل.
- **فحوصات السلامة + تجاوز الفشل التلقائي** — فحوصات زمن استجابة في الخلفية؛ نبض يدوي بنقرة واحدة لكل خادم. الخوادم المتعطّلة تخرج من المسار النشط.
- **قائمة مختصرة بالخوادم المثبّتة** — أبقِ ثلاثة مفضّلين أعلى النافذة المنبثقة. بدّل الخادم النشط دون فتح اللوحة الكاملة.
- **بثّ مباشر للسجلّات** — يُبثّ مخرَجا stdout وstderr من محرّك الوكيل إلى الإضافة. شخّص مشاكل الاتصال دون مغادرة المتصفّح.
- **حماية من تسريب WebRTC** — مفتاح اختياري يحظر UDP خارج الوكيل كي لا يكشف WebRTC عنوان IP الحقيقي الخاص بك.
- **قواعد مدمجة لحظر الإعلانات والمتعقّبات** — تُوجَّه عائلات `geosite:ads` إلى الحظر افتراضيًا. أوقِفها إن كنت تفضّل التعامل معها بطريقة أخرى.

## 🔌 بروتوكولات الوكيل المدعومة

`VLESS` · `VLESS Reality` · `VMess` · `Trojan` · `Shadowsocks` · `Hysteria/2` · `TUIC` · `WireGuard` · `AnyTLS` · `ShadowTLS`

يدعم Noctis: VLESS (بما في ذلك VLESS Reality) وVMess وTrojan وShadowsocks وHysteria2 وTUIC وWireGuard وAnyTLS وShadowTLS. تعمل إعدادات V2Ray وXray ولوحات 3X-UI كما هي — الصق رابط مشاركة أو رابط اشتراك وتترجمه الإضافة تلقائيًا إلى إعدادات المحرّك المناسب. يفتح xray قدرات xhttp/splithttp وأنواع تدفّق XTLS؛ ويضيف mihomo Snell وSSR وغيرها.

## 🧩 كيف يعمل

لا تستطيع المتصفّحات تشغيل محرّك وكيل بنفسها. تقسّم الأجزاء الثلاثة العمل عبر حدود البيئة المعزولة — والسهم الذي يعبرها هو المكان الوحيد الذي تتدفّق فيه الرسائل.

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

يأتي Noctis افتراضيًا مع sing-box ويمكنه أيضًا تشغيل xray-core وmihomo. يشرف مساعد أصلي صغير على المحرّك على جهازك، ويختار Noctis المحرّك المناسب لكل خادم تلقائيًا — فتعمل البروتوكولات التي لا يستطيع محرّك واحد التعامل معها ببساطة. يفتح xray قدرات xhttp/splithttp وأنواع تدفّق XTLS (REALITY-vision)؛ ويضيف mihomo Snell وSSR وMieru. لا ترسل إضافة المتصفّح سوى قرارات التوجيه — ولا ترسل أبدًا ترافيكًا خامًا.

## 📥 التثبيت

تحتاج إضافة Noctis إلى مساعد أصلي صغير يعمل على جهازك. يشرف المساعد على محرّك الوكيل — sing-box أو xray أو mihomo — الذي يقوم فعليًا بالتوكيل.

### قبل أن تبدأ

- متصفّح مبني على Chromium، الإصدار 120 أو أحدث (Chrome وChromium وEdge وBrave وArc وVivaldi وOpera وYandex Browser).
- نحو 100 ميغابايت من مساحة القرص الحرّة للمساعد ومحرّكات الوكيل.
- دون صلاحيات مسؤول / root — يُثبَّت كل شيء داخل حساب المستخدم الخاص بك.

### ثبّت الإضافة

ثبّت Noctis من [Chrome Web Store](https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn). افتح الإضافة بعد التثبيت — ستكتشف غياب المساعد وتعرض نافذة إعداد بأمر من سطر واحد مُعبّأ مسبقًا لجهازك.

### شغّل مثبّت المساعد

انسخ الأمر من نافذة Helper Setup في الإضافة والصقه في الطرفية. معرّف الإضافة الخاص بك مُعبّأ مسبقًا — لا حاجة للبحث عنه. للمرجع، يبدو الأمر هكذا:

مصدر المساعد: <https://github.com/c0nn3ct-info/noctis>

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

يُنزّل المثبّت noctis-host ومحرّكات الوكيل (sing-box وxray وmihomo) إلى دليل بيانات المستخدم ويكتب بيان المراسلة الأصلية لكل متصفّح مدعوم.

في أول مرة تتواصل فيها الإضافة مع المساعد، قد يعرض متصفّحك مطالبة مراسلة أصلية تظهر مرة واحدة — وافِق عليها.

### التشغيل الأول

افتح النافذة المنبثقة للإضافة، والصق رابط مشاركة `vless://` أو `ss://` أو `trojan://` (أو رابط اشتراك)، وبدّل الخادم النشط. يتحوّل شارة الحالة إلى الأخضر بمجرد أن يقبل المحرّك الترافيك.

### التحديث

أعد تشغيل الأمر ذي السطر الواحد لنظام تشغيلك — السكربت غير متأثّر بالتكرار وسيستبدل الملفات الثنائية الموجودة.

### إلغاء التثبيت

1. أزِل الإضافة من `chrome://extensions`.
2. احذف دليل بيانات Noctis:
   - macOS / Linux: `~/.local/share/noctis`
   - Windows: `%LOCALAPPDATA%\Noctis`

## ❓ الأسئلة الشائعة

**ما هو VLESS ولماذا استخدامه داخل المتصفّح؟**
VLESS بروتوكول وكيل خفيف من عائلة V2Ray/Xray. لا يحمل تشفيرًا خاصًا به — يتولّى TLS ذلك — لذا فهو سريع ويسهل تمويهه على أنه HTTPS عادي. استخدام VLESS عبر إضافة متصفّح يعني أن ترافيك المتصفّح وحده هو المُوكَّل؛ أمّا بقية نظام التشغيل فتبقى على اتصالك الحقيقي.

**كيف تختلف إضافة وكيل المتصفّح عن VPN؟**
تُنفِّق شبكة VPN كل تطبيق على نظامك عبر اتصال واحد وتحتاج عادةً إلى صلاحيات مسؤول. أمّا إضافة وكيل المتصفّح مثل Noctis فتوجّه المتصفّح فقط، ولا تتطلّب صلاحيات root أو مسؤول، وتتيح لك إبقاء Zoom وSteam وTelegram desktop والتورنت على شبكتك الحقيقية في الوقت نفسه.

**هل يدعم Noctis تقنية VLESS Reality؟**
نعم. ينقل Noctis معاملات Reality (Server Name وFingerprint وSNI وDest والمفتاح العام وShort ID) إلى المساعد دون تغيير ويشغّل الخادم على محرّك يدعمها — يوفّر xray تدفّق XTLS-vision الكامل. الصق رابط مشاركة `vless://...flow=xtls-rprx-vision&security=reality` وتستورد الإضافة كل حقل.

**ما بروتوكولات الوكيل التي يدعمها Noctis؟**
VLESS وVMess وTrojan وShadowsocks وHysteria2 وTUIC وWireGuard وAnyTLS وShadowTLS — إضافةً إلى xhttp/splithttp وSnell وSSR وغيرها عبر xray وmihomo. وتعمل روابط مشاركة V2Ray وXray كما هي.

**هل استخدام إضافة وكيل لـ Chrome آمن؟**
أكثر أمانًا من معظمها. لا يرسل Noctis أي شيء إلى مطوّره — لا تحليلات ولا قياس عن بُعد ولا إعدادات بعيدة. تبقى إعدادات الخوادم في تخزين المتصفّح. يعمل المساعد الأصلي دون صلاحيات مسؤول. تجد قائمة الصلاحيات الكاملة ومبرّراتها في [سياسة الخصوصية](./site/PRIVACY.md).

**هل يعمل Noctis على Windows وmacOS وLinux؟**
نعم — على المتصفّحات المبنية على Chromium في Windows وmacOS وLinux (Chrome وEdge وBrave وArc وVivaldi وOpera وYandex Browser). للمساعد الأصلي سكربتات تثبيت من سطر واحد لكل منصّة.

**هل يمكنني استخدام رابط اشتراك لتحديث الخوادم تلقائيًا؟**
نعم. الصق رابط اشتراك مرة واحدة ويحدّثه Noctis وفق جدول زمني. تتحدّث قوائم الخوادم تلقائيًا؛ وتبقى التحديدات المثبّتة والنشطة عبر التحديثات.

**هل يساعد Noctis في تجاوز حجب المواقع؟**
Noctis في حدّ ذاته مجرّد عميل وكيل — يوجّه متصفّحك عبر أي خادم توفّره. إذا كان خادمك في منطقة يكون فيها الموقع الذي تريد الوصول إليه متاحًا، فإن Noctis يوجّهك إلى هناك. وهو لا يوفّر خوادم؛ أنت من توفّرها.

**هل يحظر Noctis تسريبات WebRTC؟**
نعم. مفتاح اختياري يحظر UDP خارج الوكيل كي لا يكشف WebRTC عنوان IP الحقيقي الخاص بك أثناء عمل الوكيل.

**كم يكلّف Noctis؟**
مجاني. الإضافة مجانية في Chrome Web Store والمساعد الأصلي مفتوح المصدر بترخيص MIT. أنت تدفع فقط مقابل خوادم الوكيل التي تختار استخدامها.

## 🙏 شكر وتقدير

- **[sing-box](https://github.com/SagerNet/sing-box)** (GPL-3.0) و**[xray-core](https://github.com/XTLS/Xray-core)** (MPL-2.0) و**[mihomo](https://github.com/MetaCubeX/mihomo)** (GPL-3.0) — محرّكات الوكيل التي تقوم بكل التوجيه والتشفير الأصلي. Noctis سطح تحكّم؛ والمحرّك هو من يقوم بالعمل الفعلي، ويختار Noctis المحرّك المناسب لكل خادم.
- **[V2Ray](https://github.com/v2fly/v2ray-core)** و**[Xray](https://github.com/XTLS/Xray-core)** — تصاميم البروتوكولات الأصلية (VLESS وVMess وReality) التي يتحدّث بها Noctis.

## ⚖️ الجوانب القانونية

- الترخيص — EULA مملوك: انظر [LICENSE](./site/LICENSE.md) أو <https://noctis.c0nn3ct.info/ar/license/>.
- الخصوصية — انظر [PRIVACY](./site/PRIVACY.md) أو <https://noctis.c0nn3ct.info/ar/privacy/>.
- المساعد الأصلي — بترخيص MIT: انظر <https://github.com/c0nn3ct-info/noctis>.
- محرّكات الوكيل — sing-box (GPL-3.0) وxray-core (MPL-2.0) وmihomo (GPL-3.0)، يُعاد توزيع كلٍّ منها بترخيصه الأصلي.
