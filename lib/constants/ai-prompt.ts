export const AI_PROMPT = `Forilove platformu için romantik tek sayfa HTML şablon üret.

KONU: [ör: Sevgililer Günü / Yıldönümü / Doğum Günü / Özür / Evlilik Teklifi / Mesafe]
STİL: [ör: Minimal / Modern-lüks / Vintage / Soft-pastel / Dark-romance / Neon / Cinematic]

ÇIKTI KURALLARI:
- Tek HTML dosyası döndür. <!DOCTYPE html> ile başla. Başka açıklama/yorum/markdown YAZMA.
- Tüm CSS inline style olmalı. Harici CSS/framework (Tailwind, Bootstrap) YASAK.
- Sadece animasyon keyframes için <style> etiketi kullanılabilir.
- JavaScript / <script> YASAK.
- Google Fonts kullanabilirsin (<link> ile).
- Görseller için sadece placeholder.jpg yaz, dış URL kullanma.
- iframe, embed, form elemanları YASAK.

DÜZENLENEBİLİR ALAN SİSTEMİ:
Editör bu attribute'ları tarar ve kullanıcıya düzenleme sunar:

  data-editable="benzersiz_key"  → snake_case benzersiz ID
  data-type="tip"                → text | textarea | image | background-image | date | color | url
  data-label="Türkçe Etiket"    → Kullanıcıya gösterilecek isim

Örnekler:
  <h1 data-editable="hero_title" data-type="text" data-label="Ana Başlık">Seni Seviyorum</h1>
  <p data-editable="love_letter" data-type="textarea" data-label="Mektup">Seninle geçen her an...</p>
  <img data-editable="photo_1" data-type="image" data-label="Fotoğraf 1" src="placeholder.jpg"/>
  <div data-editable="hero_bg" data-type="background-image" data-label="Arka Plan" style="background-image:url('placeholder.jpg'); background-size:cover; min-height:100vh;"></div>
  <span data-editable="special_date" data-type="date" data-label="Özel Tarih">14 Şubat 2025</span>
  <span data-editable="accent_color" data-type="color" data-label="Vurgu Rengi" style="color:#ff69b4;">♥</span>
  <a data-editable="song_link" data-type="url" data-label="Şarkı Linki" href="#">Şarkımızı Dinle</a>

Kurallar:
- Her key benzersiz olmalı, aynı key iki kez OLMAZ.
- İç içe data-editable OLMAZ.
- Minimum 12, maksimum 25 alan.
- data-label Türkçe ve kullanıcı dostu.

BÖLÜMLER:
A) Hero — tam ekran arka plan (background-image), başlık, alt başlık, tarih, giriş animasyonu
B) Timeline — 3-5 olay kartı (text + textarea), mobilde dikey
C) Galeri — 4-6 fotoğraf (image), hover efekti
D) Mektup — uzun metin (textarea), özel görsel çerçeve
E) Butonlar — şarkı linki (url), CTA butonu (text)
F) Kapanış — isim (text), kapanış cümlesi (text)

TASARIM:
- Mobil öncelikli (320px'den başla), max-width: 480px container
- Google Fonts max 2 aile (başlık: serif/display, gövde: sans-serif)
- 2-5 CSS animasyonu (fade, float, shimmer), prefers-reduced-motion desteği
- Tüm placeholder metinler TÜRKÇE, romantik ve samimi

Şimdi KONU'ya göre üretim kalitesinde şablonu oluştur.`;
