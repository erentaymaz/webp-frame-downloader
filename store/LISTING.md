# Store listing kit

Everything needed to publish WebP Frame Downloader on the Chrome Web Store, Microsoft Edge Add-ons and Opera add-ons: which image goes where, and the text to paste into each form.

## Which file goes where

| Store field | File | Size |
|---|---|---|
| Chrome · Store icon | `icons/chrome-store-icon-128.png` | 128×128 (96 px artwork + 16 px transparent margin, as Chrome recommends) |
| Chrome · Screenshots (max 5) | `screenshots/en/01…05.png` | 1280×800 |
| Chrome · Screenshots, Turkish listing | `screenshots/tr/01…05.png` | 1280×800 |
| Chrome · Small promo tile (required) | `promo/small-tile-440x280.png` | 440×280 |
| Chrome · Marquee promo tile (optional) | `promo/marquee-1400x560.png` | 1400×560 |
| Edge · Logo | `icons/edge-logo-300.png` | 300×300 |
| Edge · Screenshots (max 10) | `screenshots/en/*.png`, `screenshots/tr/*.png` | 1280×800 |
| Edge · Promotional tiles (optional) | `promo/small-tile-440x280.png`, `promo/marquee-1400x560.png` | 440×280, 1400×560 |
| Opera · Icon | `icons/opera-icon-64.png` | 64×64 |
| Opera · Screenshots | `screenshots/opera/en/*.png` | 800×600 (Opera's maximum) |

Screenshot order and what each one shows:

1. `01-auto-detect` — page scan, sequence found, first/last frame detected automatically
2. `02-deep-scan` — deep scan result on a page that loads frames while scrolling
3. `03-frame-url` — a single frame URL pasted, whole sequence derived
4. `04-bulk-download` — download to Downloads/animation_frames with live progress
5. `05-save-to-folder` — the save-to-folder window

The ZIP to upload must contain only the extension files: `manifest.json`, `*.js`, `*.html`, `*.css`, `icons/`, `_locales/`. Leave out `test/`, `docs/`, `store/`, `.github/`, `package.json`, `README*.md`, `LICENSE`, `PRIVACY.md`.

---

## Chrome Web Store

### Store listing

**Name** (from manifest): WebP Frame Downloader

**Summary** (from manifest `description`, max 132 characters):
Detects sequential WebP animation frames like frame_####.webp on web pages and downloads them in bulk.

**Category:** Tools (alternative: Art & Design)

**Language:** English (add Turkish as a second language with the text in the "Turkish listing" section below)

**Detailed description:**

```
Some websites build their scroll animations from hundreds of separate WebP files named frame_0001.webp, frame_0002.webp and so on. Saving them one by one is slow. WebP Frame Downloader finds the whole sequence and downloads every frame in one go.

HOW IT WORKS
1. Open the page with the animation and click the extension icon.
2. The page is scanned and files like frame_####.webp are grouped into a sequence.
3. The real first and last frame are found automatically. Adjust the range if you like.
4. Download to your Downloads folder, or save straight into any folder you choose.

FEATURES
• Automatic sequence detection: images, CSS backgrounds, lazy-loaded files and inline JSON are all scanned.
• Automatic first/last frame discovery, even when the page has only loaded a few frames so far.
• Deep scan for pages that load frames while you scroll: reloads the page, scrolls to the bottom and collects everything.
• Paste one frame URL and the extension works out the whole sequence. Paste a page URL to deep scan it.
• Bulk download with live progress (for example 87 / 202). Downloads keep running if the popup closes.
• Save into any folder on your computer, with no download prompts.
• Zero padding such as 0001 and query strings are preserved; files keep their original names.
• Interface in English and Turkish, switchable from the popup.
• Light and dark theme, following your system setting.

PRIVACY
No analytics, no tracking, no accounts and no server of its own. The extension only talks to the website hosting the frames you download. Site access is requested only when you use Deep scan or Save to folder, and only for that site.

PERMISSIONS
• activeTab and scripting: scan the tab where you clicked the icon.
• downloads: save frames to your Downloads folder.
• Optional site access: requested at runtime, per site, for Deep scan and Save to folder.

OPEN SOURCE
The source code is on GitHub: https://github.com/erentaymaz/webp-frame-downloader
Found a bug or have an idea? Open an issue there.
```

### Privacy tab

**Single purpose description:**
Detect sequential WebP animation frames (for example frame_0001.webp … frame_0202.webp) on the current web page and download them in bulk.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | To scan the page in the tab where the user clicked the extension icon for .webp image URLs. No access to other tabs or to sites the user has not clicked on. |
| `scripting` | To inject the scanner function into the active tab (collecting image URLs from the DOM, CSS and the Performance API) and, during Deep scan, to scroll the page so lazy-loaded frames appear. |
| `downloads` | To save the detected frames into the Downloads/animation_frames folder and to report download progress. |
| Host permissions (optional, `http://*/*`, `https://*/*`) | Declared as optional and requested at runtime, only for the single site involved, in two cases: (1) Deep scan registers a content script on that site to lift the browser's resource-timing limit before the page reloads; (2) Save to folder fetches the frames from the hosting server so they can be written into the folder the user chose. Nothing is requested at install time. |

**Remote code:** No, the extension does not use remote code.

**Data usage:** The extension does not collect or transmit any user data. Tick none of the data categories, and certify the three disclosures (no sale of data, data not used for unrelated purposes, not used for creditworthiness or lending).

**Privacy policy URL:** https://github.com/erentaymaz/webp-frame-downloader/blob/main/PRIVACY.md

### Other fields

- **Homepage URL:** https://github.com/erentaymaz/webp-frame-downloader
- **Support URL:** https://github.com/erentaymaz/webp-frame-downloader/issues
- **Mature content:** No
- **Visibility:** Public

---

## Microsoft Edge Add-ons

**Display name:** WebP Frame Downloader

**Short description** (max 250 characters):
Finds sequential WebP animation frames such as frame_0001.webp on the current page, detects the real first and last frame, and downloads them all in one click, to your Downloads folder or any folder you choose.

**Description:** use the Chrome detailed description above.

**Category:** Productivity (alternative: Photos)

**Search terms:** webp, frames, animation, sequence, bulk download, image downloader, scroll animation

**Privacy policy URL:** https://github.com/erentaymaz/webp-frame-downloader/blob/main/PRIVACY.md

**Website:** https://github.com/erentaymaz/webp-frame-downloader

**Support contact:** https://github.com/erentaymaz/webp-frame-downloader/issues

**Notes for certification** (the reviewer sees these; adapt the test URL before submitting):

```
The extension has no login and needs no account.

To test the main flow, open any web page that loads a numbered WebP sequence, click the extension icon, wait for "Found automatically", then click "Download to Downloads/animation_frames".

To test without such a page, open any website, click the icon, paste the URL of one frame of a public sequence into "Analyze URL" and click "Analyze":
<add a public frame URL here, for example https://…/frames/frame_0001.webp>

Deep scan and "Choose folder and download" request access to the current site at runtime; this is expected.

The extension collects no data and makes no requests other than to the site hosting the frames.
```

---

## Opera add-ons

**Name:** WebP Frame Downloader

**Summary:** Detect and bulk download sequential WebP animation frames from web pages.

**Description:** use the Chrome detailed description above.

**Category:** Downloads (alternative: Photos)

**Icon:** `icons/opera-icon-64.png`; screenshots from `screenshots/opera/en/`.

---

## Turkish listing (Chrome and Edge localized fields)

**Ad:** WebP Frame Downloader

**Kısa açıklama** (manifest, 132 karakter sınırı):
Sayfadaki frame_####.webp gibi sıralı WebP animasyon karelerini tespit eder ve toplu indirir.

**Edge kısa açıklama** (250 karakter sınırı):
Açık sayfadaki frame_0001.webp gibi sıralı WebP animasyon karelerini bulur, gerçek ilk ve son kareyi tespit eder ve hepsini tek tıkla İndirilenler klasörüne ya da seçtiğiniz bir klasöre indirir.

**Ayrıntılı açıklama:**

```
Bazı web siteleri kaydırma animasyonlarını frame_0001.webp, frame_0002.webp gibi yüzlerce ayrı WebP dosyasından oluşturur. Bunları tek tek kaydetmek saatler alır. WebP Frame Downloader diziyi bütün olarak bulur ve tüm kareleri tek seferde indirir.

NASIL ÇALIŞIR
1. Animasyonun olduğu sayfayı açın ve eklenti simgesine tıklayın.
2. Sayfa taranır; frame_####.webp gibi dosyalar tek bir dizide toplanır.
3. Gerçek ilk ve son kare kendiliğinden bulunur. İsterseniz aralığı değiştirin.
4. İndirilenler klasörüne indirin ya da doğrudan seçtiğiniz bir klasöre kaydedin.

ÖZELLİKLER
• Otomatik dizi tespiti: görseller, CSS arka planları, geç yüklenen dosyalar ve sayfa içi JSON verisi taranır.
• Sayfa henüz birkaç kare yüklemiş olsa bile ilk ve son kare otomatik bulunur.
• Kaydırdıkça kare yükleyen sayfalar için derin tarama: sayfayı yeniler, en alta kadar kaydırır ve her şeyi toplar.
• Tek bir karenin adresini yapıştırın, eklenti tüm diziyi çıkarsın. Sayfa adresi yapıştırırsanız derin tarama yapar.
• Canlı ilerlemeli toplu indirme (örneğin 87 / 202). Popup kapansa da indirme sürer.
• Bilgisayarınızda istediğiniz klasöre, indirme uyarısı olmadan kaydetme.
• 0001 gibi sıfır doldurma ve sorgu dizeleri korunur; dosyalar özgün adlarıyla iner.
• Türkçe ve İngilizce arayüz; popup içinden değiştirilebilir.
• Sistem ayarını izleyen açık ve koyu tema.

GİZLİLİK
Analitik, izleme, hesap ve kendine ait sunucu yoktur. Eklenti yalnızca indirdiğiniz kareleri barındıran siteyle iletişim kurar. Site erişimi yalnızca Derin tara veya Klasöre kaydet kullandığınızda ve yalnızca o site için istenir.

İZİNLER
• activeTab ve scripting: simgeye tıkladığınız sekmeyi taramak için.
• downloads: kareleri İndirilenler klasörüne kaydetmek için.
• İsteğe bağlı site erişimi: Derin tara ve Klasöre kaydet için, çalışma anında ve site başına istenir.

AÇIK KAYNAK
Kaynak kodu GitHub'da: https://github.com/erentaymaz/webp-frame-downloader
Hata bulursanız veya öneriniz varsa orada bir issue açın.
```

---

## Before you submit

- Bump `version` in `manifest.json` and `package.json` if the store build differs from the last GitHub release.
- Build the ZIP from a clean checkout so no `node_modules` or test files slip in.
- Chrome asks for a 2-step verified account and a one-time developer fee; Edge and Opera developer accounts are free.
- Review usually takes a few days on Chrome and Edge; Opera can take longer.
