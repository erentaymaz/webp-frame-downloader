# WebP Frame Downloader

Açık web sayfasındaki `.webp` dosyalarını tarayan, `frame_0001.webp`, `frame_0002.webp` gibi **sıralı animasyon karelerini** otomatik tanıyan ve hepsini tek tıkla indiren bir tarayıcı eklentisi (Manifest V3).

Chrome, Edge, Opera ve diğer Chromium tabanlı tarayıcılarda çalışır. Framework yoktur; yalnızca vanilla JavaScript, HTML ve CSS kullanılır.

## Özellikler (v0.1)

- Aktif sayfadaki `.webp` kaynaklarını tarar (img/srcset, CSS arka planları, lazy-load `data-src`, fetch/canvas ile yüklenenler dahil).
- `isim_####.webp` biçimindeki sıralı dizileri otomatik gruplar; sıfır doldurmayı (`0001`) korur.
- Bulunan ilk ve son kare numarasını gösterir; başlangıç/bitiş değiştirilebilir.
- **Klasör seçip indir**: kareleri bilgisayarınızda seçtiğiniz herhangi bir klasöre doğrudan kaydeder.
- **İndirilenler/animation_frames'e indir**: tarayıcının indirme sistemiyle hızlı indirme; popup kapansa da sürer.
- İlerleme `87 / 202` biçiminde gösterilir.
- Tek bir kare URL'si yapıştırarak dizi çıkarma: `…/frames/frame_0202.webp` → `frame_0001` … `frame_0202`.
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
3. Birden fazla dizi bulunduysa listeden seçin.
4. Gerekirse başlangıç/bitiş numaralarını düzenleyin.
5. İndirme yöntemini seçin:
   - **Klasör seçip indir…** → küçük bir pencere açılır. **Klasör seç…** ile hedefi seçin, **İndirmeyi başlat**'a basın. İlk seferde tarayıcı bu siteye (ör. `*.cloudfront.net`) erişim izni ister; kareleri klasöre yazabilmek için gereklidir. İndirme bitene kadar pencereyi açık tutun.
   - **İndirilenler/animation_frames'e indir** → dosyalar varsayılan İndirilenler klasörünün altına iner.

### URL'den çıkarma
1. Herhangi bir karenin adresini kopyalayın, örn.
   `https://…cloudfront.net/…/frames/frame_0202.webp`
2. **URL'den çıkar** alanına yapıştırıp **Analiz et**'e basın.
3. Aralık otomatik `1 → 202` olarak dolar. Dizi `frame_0000` ile başlıyorsa başlangıcı `0` yapın; son kare 202'den büyükse bitişi artırın.

> İpucu: Doğrudan bir `.webp` dosyasını sekmede açtığınızda (yukarıdaki örnekteki gibi) sayfa taraması o URL'yi zaten bulur; ayrıca yapıştırmanız gerekmez.

## İzinler

| İzin        | Neden |
|-------------|-------|
| `activeTab` | Yalnızca eklenti simgesine tıkladığınız sekmeyi taramak için. Tüm sitelere kalıcı erişim istenmez. |
| `scripting` | Tarama fonksiyonunu aktif sekmeye enjekte etmek için. |
| `downloads` | "İndirilenler'e indir" seçeneği için. |
| `optional_host_permissions` | Yalnızca "Klasör seçip indir" kullanıldığında, **sadece kareleri barındıran site için** çalışma anında istenir. Kurulumda hiçbir siteye erişim verilmez. |

`storage` veya `tabs` gibi ek izinler kullanılmaz.

> Neden ek izin? `chrome.downloads` API'si yalnızca İndirilenler klasörüne yazabilir. Başka bir klasöre yazmak için dosyaların eklenti tarafından çekilip File System Access API ile kaydedilmesi gerekir; farklı bir sunucudan dosya çekmek de o sunucu için izin ister.

## Dosya yapısı

```
manifest.json   Eklenti tanımı (MV3, minimum izin)
popup.html      Arayüz
popup.css       Stil (açık/koyu tema değişkenleri)
popup.js        Sayfa tarama ve popup arayüz mantığı
frames.js       Ortak dizi çözümleme yardımcıları (popup + save)
save.html/.js   Klasör seçip indirme penceresi (File System Access API)
background.js   İndirilenler'e indirme kuyruğu (4 paralel, ilerleme bildirimi)
icons/          16, 32, 48, 128 px simgeler
```

## Bilinen sınırlamalar

- Tarayıcı Performance API'si varsayılan olarak ilk ~250 kaynağı tutar; çok sayıda kare yükleyen sayfalarda son kareler taramada görünmeyebilir. Bu durumda bitiş numarasını elle artırın ya da son karenin URL'sini yapıştırın.
- Son kare numarası henüz otomatik doğrulanmıyor; aralık dışındaki numaralar 404 ile "başarısız" sayılır.
- Her kare için farklı imzalı (signed) sorgu dizesi kullanan URL'lerde yalnızca ilk karenin sorgusu kullanılır, bu yüzden diğer kareler inmeyebilir.
- Klasöre indirmede aynı adlı dosyaların üzerine yazılır. İndirilenler'e indirmede ise tarayıcı `frame_0001 (1).webp` gibi yeni ad verir.

## Yol haritası

- [ ] Otomatik son-frame tespiti (HEAD istekleriyle ikili arama)
- [ ] ZIP olarak tek dosyada indirme
- [ ] Animasyon dışa aktarma (animated WebP / GIF / MP4)
- [ ] Dizi başına alt klasör seçeneği

## Lisans

MIT — bkz. [LICENSE](LICENSE).
