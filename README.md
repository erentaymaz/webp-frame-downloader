# WebP Frame Downloader

Açık web sayfasındaki `.webp` dosyalarını tarayan, `frame_0001.webp`, `frame_0002.webp` gibi **sıralı animasyon karelerini** otomatik tanıyan ve hepsini tek tıkla indiren bir tarayıcı eklentisi (Manifest V3).

Chrome, Edge, Opera ve diğer Chromium tabanlı tarayıcılarda çalışır. Framework yoktur; yalnızca vanilla JavaScript, HTML ve CSS kullanılır.

## Özellikler (v0.1)

- Aktif sayfadaki `.webp` kaynaklarını tarar (img/srcset, CSS arka planları, lazy-load `data-src`, fetch/canvas ile yüklenenler dahil).
- `isim_####.webp` biçimindeki sıralı dizileri otomatik gruplar; sıfır doldurmayı (`0001`) korur.
- Bulunan ilk ve son kare numarasını gösterir; başlangıç/bitiş değiştirilebilir.
- **Tümünü İndir**: kareleri `İndirilenler/animation_frames/` klasörüne indirir.
- İlerleme `87 / 202` biçiminde gösterilir; popup kapansa da indirme sürer, tekrar açınca ilerleme görünür.
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
4. Gerekirse başlangıç/bitiş numaralarını düzenleyip **Tümünü İndir**'e basın.

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
| `downloads` | Kareleri `animation_frames` klasörüne indirmek için. |

`host_permissions`, `storage` veya `tabs` gibi ek izinler kullanılmaz.

## Dosya yapısı

```
manifest.json   Eklenti tanımı (MV3, minimum izin)
popup.html      Arayüz
popup.css       Stil (açık/koyu tema değişkenleri)
popup.js        Tarama, dizi çözümleme, arayüz mantığı
background.js   İndirme kuyruğu (4 paralel indirme, ilerleme bildirimi)
icons/          16, 32, 48, 128 px simgeler
```

## Bilinen sınırlamalar

- Tarayıcı Performance API'si varsayılan olarak ilk ~250 kaynağı tutar; çok sayıda kare yükleyen sayfalarda son kareler taramada görünmeyebilir. Bu durumda bitiş numarasını elle artırın ya da son karenin URL'sini yapıştırın.
- Son kare numarası henüz otomatik doğrulanmıyor; aralık dışındaki numaralar 404 ile "başarısız" sayılır.
- Her kare için farklı imzalı (signed) sorgu dizesi kullanan URL'lerde yalnızca ilk karenin sorgusu kullanılır, bu yüzden diğer kareler inmeyebilir.
- Aynı adlı dosyalar varsa tarayıcı `frame_0001 (1).webp` gibi yeni ad verir.

## Yol haritası

- [ ] Otomatik son-frame tespiti (HEAD istekleriyle ikili arama)
- [ ] ZIP olarak tek dosyada indirme
- [ ] Animasyon dışa aktarma (animated WebP / GIF / MP4)
- [ ] Dizi başına alt klasör seçeneği

## Lisans

MIT — bkz. [LICENSE](LICENSE).
