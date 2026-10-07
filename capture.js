/**
 * WebP Frame Downloader — derin tarama içerik betiği
 *
 * Yalnızca "Derin tara" sırasında, ilgili site için geçici olarak kaydedilir
 * ve sayfa yüklenmeden önce (document_start, MAIN world) çalışır.
 *
 * Tarayıcı varsayılan olarak yalnızca ilk 250 kaynağın kaydını tutar;
 * ağır sitelerde animasyon kareleri bu sınırın dışında kalır.
 * Sınırı büyüterek sayfanın yüklediği tüm karelerin görülmesini sağlar.
 */
try {
  performance.setResourceTimingBufferSize(100000);
} catch (_) { /* desteklenmiyorsa yoksay */ }
