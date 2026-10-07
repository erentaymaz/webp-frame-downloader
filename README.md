# WebP Frame Downloader

Açık web sayfasındaki `.webp` dosyalarını tarayan, `frame_0001.webp`, `frame_0002.webp` gibi **sıralı animasyon karelerini** otomatik tanıyan ve hepsini tek tıkla indiren bir tarayıcı eklentisi (Manifest V3).

Chrome, Edge, Opera ve diğer Chromium tabanlı tarayıcılarda çalışır. Framework yoktur; yalnızca vanilla JavaScript, HTML ve CSS kullanılır.

## Özellikler (v0.1)

- Aktif sayfadaki `.webp` kaynaklarını tarar (img/srcset, CSS arka planları, lazy-load `data-src`, fetch/canvas ile yüklenenler dahil).
- `isim_####.webp` biçimindeki sıralı dizileri otomatik gruplar; sıfır doldurmayı (`0001`) korur.
- **Derin tarama**: sayfayı yeniler, tarayıcının 250 kaynak sınırını kaldırır, sayfayı otomatik kaydırır ve geç yüklenen kareleri de yakalar.
- **Otomatik ilk/son kare tespiti**: birkaç kare bile görülse, sunucuyu yoklayarak dizinin gerçek başını ve sonunu bulur (~15-25 deneme).
- **URL ile analiz**: sayfa adresi yazılırsa o sayfa açılıp derin taranır; frame adresi yazılırsa dizi doğrudan çıkarılır.
- Başlangıç/bitiş elle değiştirilebilir.
- **Klasör seçip indir**: kareleri bilgisayarınızda seçtiğiniz herhangi bir klasöre doğrudan kaydeder.
- **İndirilenler/animation_frames'e indir**: tarayıcının indirme sistemiyle hızlı indirme; popup kapansa da sürer.
- İlerleme `87 / 202` biçiminde gösterilir.
- Sistem temasına uyan açık/koyu arayüz.

## Kurulum (geliştirici modu)

1. Bu klasörü bilgisayarınıza indirin.
2. Tarayıcıda eklentiler sayfasını açın:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
3. **Geliştirici modu**nu açın.
4. **Paketlenmemiş öğe yükle** (Load unpacked) deyip bu klasörü seçin.
5. Eklentiyi araç çubuğuna sabitleyin.

## Kullanım

### Sayfadan tarama
1. Animasyonun olduğu sayfayı açın ve animasyonun yüklenmesini bekleyin.
2. Eklenti simgesine tıklayın; sayfa otomatik taranır.
   - Dizi bulunamazsa veya eksik görünüyorsa **Derin tara**'ya basın. İlk seferde site için erişim izni istenir; sayfa yenilenir ve kendiliğinden kaydırılır (10-30 sn).
3. Birden fazla dizi bulunduysa listeden seçin.
4. Eklenti ilk ve son kareyi otomatik bulur (`✓ Otomatik bulundu: …`). Gerekirse aralığı elle düzenleyin.
5. İndirme yöntemini seçin:
   - **Klasör seçip indir…** → küçük bir pencere açılır. **Klasör seç…** ile hedefi seçin, **İndirmeyi başlat**'a basın. İlk seferde tarayıcı bu siteye (ör. `*.cloudfront.net`) erişim izni ister; kareleri klasöre yazabilmek için gereklidir. İndirme bitene kadar pencereyi açık tutun.
   - **İndirilenler/animation_frames'e indir** → dosyalar varsayılan İndirilenler klasörünün altına iner.

### URL ile analiz
- **Sayfa adresi** (örn. `https://racing.porsche.com`): **Analiz et** sekmeyi o sayfaya götürür ve derin taramayı kendisi yapar.
- **Frame adresi** (örn. `…/frames/frame_0202.webp`): dizi doğrudan çıkarılır, ilk ve son kare otomatik bulunur.

> İpucu: Doğrudan bir `.webp` dosyasını sekmede açtığınızda (yukarıdaki örnekteki gibi) sayfa taraması o URL'yi zaten bulur; ayrıca yapıştırmanız gerekmez.

## İzinler

| İzin        | Neden |
|-------------|-------|
| `activeTab` | Yalnızca eklenti simgesine tıkladığınız sekmeyi taramak için. Tüm sitelere kalıcı erişim istenmez. |
| `scripting` | Tarama fonksiyonunu aktif sekmeye enjekte etmek için. |
| `downloads` | "İndirilenler'e indir" seçeneği için. |
| `optional_host_permissions` | Yalnızca "Derin tara" veya "Klasör seçip indir" kullanıldığında, **sadece ilgili site için** çalışma anında istenir. Kurulumda hiçbir siteye erişim verilmez. |

`storage` veya `tabs` gibi ek izinler kullanılmaz.

> Neden ek izin? `chrome.downloads` API'si yalnızca İndirilenler klasörüne yazabilir. Başka bir klasöre yazmak için dosyaların eklenti tarafından çekilip File System Access API ile kaydedilmesi gerekir; farklı bir sunucudan dosya çekmek de o sunucu için izin ister.

## Dosya yapısı

```
manifest.json   Eklenti tanımı (MV3, minimum izin)
popup.html      Arayüz
popup.css       Stil (açık/koyu tema değişkenleri)
popup.js        Popup arayüz mantığı (tarama, aralık tespiti, indirme)
frames.js       Ortak yardımcılar: dizi çözümleme, ilk/son kare tespiti, site izni
scanner.js      Sayfaya enjekte edilen tarama ve otomatik kaydırma fonksiyonları
capture.js      Derin taramada sayfa yüklenmeden önce 250 kaynak sınırını kaldırır
save.html/.js   Klasör seçip indirme penceresi (File System Access API)
background.js   Derin tarama akışı + İndirilenler'e indirme kuyruğu
icons/          16, 32, 48, 128 px simgeler
```

## Bilinen sınırlamalar

- Hızlı tarama yalnızca tarayıcının kaydettiği ilk ~250 kaynağı görür; ağır sitelerde **Derin tara** kullanın.
- Kareleri bir Web Worker içinde yükleyen siteler taramada görünmez; bu durumda bir karenin adresini yapıştırın.
- Otomatik aralık tespiti karelerin kesintisiz numaralandığını varsayar.
- Her kare için farklı imzalı (signed) sorgu dizesi kullanan URL'lerde yalnızca ilk karenin sorgusu kullanılır, bu yüzden diğer kareler inmeyebilir.
- Klasöre indirmede aynı adlı dosyaların üzerine yazılır. İndirilenler'e indirmede ise tarayıcı `frame_0001 (1).webp` gibi yeni ad verir.

## Yol haritası

- [x] Otomatik ilk/son frame tespiti
- [ ] ZIP olarak tek dosyada indirme
- [ ] Animasyon dışa aktarma (animated WebP / GIF / MP4)
- [ ] Dizi başına alt klasör seçeneği

## Lisans

MIT — bkz. [LICENSE](LICENSE).
