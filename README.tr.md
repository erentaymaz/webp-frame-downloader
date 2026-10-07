# WebP Frame Downloader

Web sayfalarındaki sıralı WebP animasyon karelerini tespit edin
ve tek seferde indirin.

![Chrome](https://img.shields.io/badge/Chrome-destekleniyor-4285F4?logo=googlechrome&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-destekleniyor-0078D7?logo=microsoftedge&logoColor=white)
![Opera](https://img.shields.io/badge/Opera-destekleniyor-FF1B2D?logo=opera&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6c5ce7)
![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-green)

[English](README.md) · **Türkçe**

<p align="center">
  <img src="docs/demo.gif" width="720" alt="WebP Frame Downloader demo">
</p>

## Neden?

Bazı web siteleri kaydırma animasyonlarını yüzlerce dosyayla oluşturur:

```
frame_0001.webp
frame_0002.webp
frame_0003.webp
...
frame_0202.webp
```

WebP Frame Downloader bu diziyi otomatik tespit eder,
gerçek başlangıç ve bitişini bulur ve tüm kareleri indirir.

### Özellikler

✓ Otomatik dizi tespiti  
✓ İlk ve son karenin otomatik bulunması  
✓ Geç yüklenen kareler için derin tarama  
✓ Frame URL'sinden doğrudan analiz  
✓ Toplu indirme  
✓ İstediğiniz hedef klasör  
✓ Chrome / Edge / Opera  
✓ İzleme yok, analitik yok

## Kurulum

Eklenti henüz bir mağazada yayında değil; geliştirici modunda yüklenir:

1. Bu repoyu indirin veya klonlayın.
2. Tarayıcınızın eklentiler sayfasını açın:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
3. **Geliştirici modu**nu açın.
4. **Paketlenmemiş öğe yükle** (Load unpacked) deyip repo klasörünü seçin.
5. Eklentiyi araç çubuğuna sabitleyin.

## Kullanım

### Açık sayfayı tarama

1. Animasyonun olduğu sayfayı açın ve yüklenmesini bekleyin.
2. Eklenti simgesine tıklayın; sayfa otomatik taranır.
   - Dizi bulunamazsa veya eksik görünüyorsa **Derin tara**'ya basın. İlk seferde tarayıcı bu site için erişim izni ister. Ardından sayfa yenilenir ve kendiliğinden kaydırılır (10–30 sn).
3. Birden fazla dizi bulunduysa listeden seçin.
4. Eklenti ilk ve son kareyi kendisi bulur (`✓ Otomatik bulundu: …`). Aralığı yine de elle değiştirebilirsiniz.
5. İndirme yöntemini seçin:
   - **Klasör seçip indir…** küçük bir pencere açar. **Klasör seç…** ile hedefi seçip **İndirmeyi başlat**'a basın. İlk seferde tarayıcı, kareleri barındıran sunucu için (örn. `*.cloudfront.net`) erişim izni ister. İndirme bitene kadar pencereyi açık tutun.
   - **İndirilenler/animation_frames'e indir** tarayıcının kendi indirme sistemini kullanır; popup kapansa da indirme sürer.

İlerleme `87 / 202` biçiminde gösterilir.

### URL ile analiz

**URL ile analiz** alanına bir adres yazıp **Analiz et**'e basın:

- **Sayfa adresi** (örn. `https://racing.porsche.com`): sekme o sayfayı açar ve derin taramayı sizin yerinize yapar.
- **Frame adresi** (örn. `…/frames/frame_0202.webp`): dizi bu tek dosyadan çıkarılır; ilk ve son kare otomatik bulunur.

> İpucu: Bir `.webp` dosyasını doğrudan sekmede açtıysanız sayfa taraması o adresi zaten bulur; ayrıca yapıştırmanız gerekmez.

## Nasıl çalışır?

- **Tarama**, `.webp` adreslerini yüklenen kaynaklardan (Performance API), `<img>`/`srcset`'ten, lazy-load `data-*` özniteliklerinden, CSS arka planlarından ve sayfa içi JSON verisinden toplar. Aynı klasördeki `isim_####.webp` dosyaları tek bir dizi olarak gruplanır; sıfır doldurma (`0001`) korunur.
- **Derin tarama:** Tarayıcı varsayılan olarak bir sayfanın yüklediği ilk ~250 kaynağı kaydeder; ağır sitelerde kareler bu yüzden görünmeyebilir. Derin tarama bu sınırı sayfa yüklenmeden önce kaldırır, sayfayı yeniler, geç yüklenen kareleri tetiklemek için en alta kadar kaydırır ve ardından tarar.
- **İlk/son kare tespiti**, bir karenin var olup olmadığını onu görsel olarak yükleyerek dener. Büyüyen adımlarla (1, 2, 4, 8…) ilerler, sonra ikili aramayla daraltır. 400 karelik bir dizi için yaklaşık 20 deneme yeterlidir ve ek izin gerekmez.

## İzinler

| İzin | Neden |
|---|---|
| `activeTab` | Yalnızca eklenti simgesine tıkladığınız sekmeyi taramak için. Hiçbir siteye kalıcı erişim istenmez. |
| `scripting` | Tarayıcıyı o sekmede çalıştırmak için. |
| `downloads` | "İndirilenler/animation_frames'e indir" seçeneği için. |
| `optional_host_permissions` | Yalnızca **Derin tara** veya **Klasör seçip indir** kullanıldığında, **sadece ilgili site için** çalışma anında istenir. Kurulumda hiçbir siteye erişim verilmez. |

Eklenti `storage`, `tabs`, analitik veya kendine ait herhangi bir sunucu kullanmaz.

> **Neden isteğe bağlı izin?** `chrome.downloads` API'si yalnızca İndirilenler klasörüne yazabilir. Seçtiğiniz bir klasöre yazmak için eklentinin dosyaları kendisi çekip File System Access API ile kaydetmesi gerekir; başka bir sunucudan dosya çekmek de o sunucu için izin ister.

## Proje yapısı

```
manifest.json   Eklenti tanımı (MV3, minimum izin)
popup.html      Popup arayüzü
popup.css       Stil (açık/koyu tema değişkenleri)
popup.js        Popup mantığı: tarama, aralık tespiti, indirme
frames.js       Ortak yardımcılar: dizi çözümleme, ilk/son kare tespiti, site izni
scanner.js      Sayfaya enjekte edilen fonksiyonlar: tarayıcı ve otomatik kaydırma
capture.js      Derin tarama: sayfa yüklenmeden önce 250 kaynak sınırını kaldırır
save.html/.js   "Klasör seç" indirme penceresi (File System Access API)
background.js   Derin tarama akışı + İndirilenler klasörüne indirme kuyruğu
icons/          16, 32, 48, 128 px simgeler
docs/demo.gif   Bu README'nin başındaki demo animasyonu
```

Derleme adımı ve framework yoktur: yalnızca JavaScript, HTML ve CSS.

## Bilinen sınırlamalar

- Hızlı tarama yalnızca tarayıcının kaydettiği ilk ~250 kaynağı görür; ağır sitelerde **Derin tara** kullanın.
- Kareleri bir Web Worker içinde yükleyen siteler hiçbir taramada görünmez; bu durumda tek bir karenin adresini yapıştırın.
- İlk/son kare tespiti, kare numaralarında boşluk olmadığını varsayar.
- Her kare farklı imzalı (signed) sorgu dizesi kullanıyorsa yalnızca ilk karenin sorgusu kullanılır; diğer kareler inmeyebilir.
- Klasöre indirmede aynı adlı dosyaların üzerine yazılır. İndirilenler'e indirmede ise tarayıcı `frame_0001 (1).webp` gibi yeni ad verir.

## Yol haritası

- [x] İlk/son karenin otomatik bulunması
- [ ] İngilizce arayüz
- [ ] Tek ZIP dosyası olarak indirme
- [ ] Animasyon olarak dışa aktarma (animated WebP / GIF / MP4)
- [ ] Dizi başına isteğe bağlı alt klasör

## Lisans

MIT — bkz. [LICENSE](LICENSE).
