-- blog_posts: dinamik blog yazıları tablosu
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL DEFAULT '',
  read_time TEXT NOT NULL DEFAULT '1 dk',
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_public_read" ON public.blog_posts
  FOR SELECT USING (is_published = true);

CREATE POLICY "blog_posts_admin_all" ON public.blog_posts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_published_date ON public.blog_posts(is_published, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_posts_updated_at();

-- Seed: mevcut 2 statik yazı
INSERT INTO public.blog_posts (slug, title, description, keywords, content, read_time, is_published, created_at, updated_at) VALUES
(
  'sevgililer-gununde-alabileceginiz-en-iyi-5-hediye',
  'Sevgililer Gününde Alabileceğiniz En İyi 5 Hediye',
  '14 Şubat için en anlamlı ve yaratıcı hediye fikirleri. Klasik seçeneklerden dijital sürprizlere kadar sevgilinizi mutlu edecek 5 hediye önerisi.',
  ARRAY['sevgililer günü hediye','sevgiliye hediye önerileri','14 şubat hediye','sevgililer günü hediye fikirleri','sevgiliye ne alınır','romantik hediye'],
  '<p>14 Şubat yaklaşıyor ve kafanızda hâlâ "ne alsam?" sorusu dönüyorsa — rahat olun, yalnız değilsiniz. Her yıl milyonlarca kişi aynı stresi yaşıyor. Ama bu sene farklı olacak, çünkü biz sizin için hem klasik hem yaratıcı seçenekleri bir araya getirdik.</p>
<p>Hazırsanız başlıyoruz</p>

<h2>1. Kişiselleştirilmiş Dijital Anı Sayfası</h2>
<p>Tamam, biliyoruz — listenin birincisi bizim ürün. Ama bir saniye, açıklamamıza izin verin çünkü gerçekten mantıklı</p>
<p><strong>Forilove</strong> ile sevgilinize özel bir web sayfası oluşturuyorsunuz. Birlikte çekildiğiniz fotoğraflar, favori şarkınız, tanışma tarihinizden bu yana geçen süre sayacı, kalpten gelen mesajlarınız... Hepsi tek bir sayfada, tek bir linkte.</p>
<p>En güzel yanı ne biliyor musunuz? Çiçek solar, çikolata biter — ama bu sayfa <strong>sonsuza kadar</strong> kalır. Yıllar sonra birlikte açıp "aaa bak ne yazmışım" diyeceğiniz dijital bir anı defteri</p>
<p>Üstelik 10 dakikada hazır, teknik bilgi falan gerekmiyor. <a href="https://forilove.com/templates">Şablonlara bir göz atın</a>, belki tam da aradığınız şey ordadır</p>

<h2>2. El Yazısı Mektup</h2>
<p>Evet, 2026''da el yazısıyla mektup yazmak. Kulağa eski moda mı geliyor? Tam da bu yüzden bu kadar değerli.</p>
<p>Düşünsenize — herkes mesaj atıyor, herkes story paylaşıyor. Ama biri oturup sizin için kağıda kalemle bir şeyler yazdığında... O bambaşka bir his. O kağıdı yıllar sonra bile çekmeceden çıkarıp okuyorsunuz</p>
<p><strong>Ne yazacağınızı bilmiyorsanız şöyle başlayın:</strong> Tanıştığınız günü hatırlayın. İlk izleniminiz ne olmuştu? Sizi güldüren bir anınız var mı? Onu yazın. Mükemmel cümleler kurmak zorunda değilsiniz — samimi olan her şey güzeldir.</p>
<p>Bonus ipucu: Mektubun içine Forilove sayfanızın linkini de koyabilirsiniz. Mektubu okuyup telefonu açtığında müzikle karşılaşsın</p>

<h2>3. Deneyim Hediyesi</h2>
<p>Bir nesne almak yerine bir <strong>anı</strong> hediye edin. Ciddiyiz — araştırmalar da bunu söylüyor: insanlar nesnelerden çok deneyimlerden mutlu oluyor.</p>
<p>Birkaç fikir:</p>
<ul>
<li>İkili yemek atölyesi (birlikte makarna yapmak düşündüğünüzden çok daha eğlenceli)</li>
<li>Çift masajı (ikisinin de ihtiyacı var, kabul edelim)</li>
<li>Sürpriz bir şehir gezisi veya günlük kaçamak</li>
<li>Planlanmış bir piknik — battaniye, mum, favori atıştırmalıklar</li>
<li>Açık hava sineması veya retro bir film gecesi</li>
</ul>
<p>Bu tür hediyelerin güzel tarafı şu: hem veren hem alan aynı anda mutlu oluyor. Karşılıklı bir hediye gibi düşünün</p>

<h2>4. Kişiselleştirilmiş Takı</h2>
<p>Klasik ama altın gibi bir seçenek (pun intended). Üzerine isim, tarih ya da anlamlı bir kelime kazınmış bir kolye veya bileklik — her baktığında sizi hatırlasın.</p>
<p>Burada önemli olan şey şu: <strong>pahalı olması gerekmiyor</strong>. 50 TL''lik ama üzerinde tanışma tarihiniz kazılı bir bileklik, 500 TL''lik sıradan bir kolyeden çok daha anlamlı. Mesele karat değil, düşünce.</p>
<p>Tavsiyemiz: İsim yerine sadece ikinizin bildiği bir kelime veya tarih kazıtın. Böylece her baktığında küçük bir sır gibi gülümsesin</p>

<h2>5. Sürpriz Kutu</h2>
<p>Bu hediyenin güzelliği, içine ne koyarsanız koyun "vay be, tüm bunları düşünmüş" dedirtmesi.</p>
<p><strong>Nasıl yapılır?</strong> Güzel bir kutu alın ve sevgilinizin sevdiği küçük şeyleri doldurun:</p>
<ul>
<li>Favori çikolatası veya atıştırmalığı</li>
<li>Birlikte çekildiğiniz bir fotoğrafın baskısı</li>
<li>"Seni sevmemin 10 nedeni" yazdığınız küçük notlar</li>
<li>Sevdiği bir parfümün seyahat boyu</li>
<li>Belki içine bir de Forilove sayfa linki yazılmış bir kart</li>
</ul>
<p>Burada sır şu: kutunun içindeki her şey "seni tanıyorum, seni dinliyorum, seni düşündüm" demeli. Bu mesajı veren her hediye, ne kadar küçük olursa olsun, kalbe dokunur</p>

<h2>Bonus: Kombine Et, Efsane Yap</h2>
<p>Yukarıdaki hediyelerden birini tek başına verin — güzel. İkisini birleştirin — <strong>unutulmaz</strong>.</p>
<p>Mesela şöyle bir senaryo düşünün:</p>
<p>El yazısıyla bir mektup yazıyorsunuz. Mektubun sonuna "Sana bir sürprizim daha var..." diye bir not bırakıp Forilove sayfanızın linkini ekliyorsunuz. Sevgiliniz mektubu okuyor, linke tıklıyor ve karşısına müzikli, fotoğraflı, kişisel mesajlarla dolu bir sayfa açılıyor</p>
<p>Bu kombinasyon, 14 Şubat''ın en çok hatırlanacak hediyesi olmaya aday. Ve toplam maliyeti? Muhtemelen bir restoran yemeğinden daha az</p>

<h2>Son Söz</h2>
<p>Hediye vermenin özü şudur: "Sen benim için önemlisin ve bunu sana göstermek istedim." Bu mesajı veren her şey — ister 10 TL''lik bir not olsun, ister saatler harcayarak hazırladığınız bir sayfa — karşı taraf için paha biçilmezdir.</p>
<p>Bu Sevgililer Günü''nde sevgilinize sadece bir hediye değil, bir <strong>his</strong> verin. Mutlu 14 Şubatlar!</p>',
  '6 dk',
  true,
  '2026-02-09T00:00:00Z',
  '2026-02-09T00:00:00Z'
),
(
  'sevgiliye-dijital-hediye-kisisellestirilmis-ask-sayfasi',
  'Sevgiliye En Güzel Dijital Hediye: Kişiselleştirilmiş Anı Sayfası',
  'Sevgililer günü, yıl dönümü veya özel bir gün için sevgiline en anlamlı dijital hediyeyi keşfet. Kişiselleştirilmiş online anı sayfası ile duygularını kalıcı hale getir.',
  ARRAY['sevgiliye dijital hediye','online anı sayfası','sevgililer günü hediye fikirleri','kişiselleştirilmiş hediye','dijital anı mektubu','sevgiliye online hediye'],
  '<p>Sevgililer günü yaklaşıyor ve hâlâ hediye arıyorsanız, yalnız değilsiniz. Her yıl milyonlarca insan sevdiklerine ne alacağını düşünür. Çiçekler solar, çikolatalar biter — ama dijital bir hediye sonsuza kadar kalır.</p>

<h2>Dijital Hediye Nedir?</h2>
<p>Dijital hediye, internet üzerinden hazırlanıp paylaşılan kişiselleştirilmiş bir sürprizdir. Bir web sayfası, bir video, bir müzik listesi veya hepsi bir arada olabilir. Önemli olan, karşı tarafa "seni düşündüm, senin için emek harcadım" mesajını vermesidir.</p>
<p>Geleneksel hediyelerin aksine, dijital hediyeler her yerden erişilebilir. Sevgiliniz ister İstanbul''da ister yurt dışında olsun, telefonunu açtığı an hediyenize ulaşabilir.</p>

<h2>Neden Kişiselleştirilmiş Bir Anı Sayfası?</h2>
<p>Bir anı sayfası, sevgilinize özel olarak tasarlanmış bir web sayfasıdır. İçinde birlikte çektiğiniz fotoğraflar, favori şarkınız, tanışma tarihinizden bu yana geçen süre sayacı ve kalbinizden geçen mesajlar yer alabilir.</p>
<p>Kişiselleştirilmiş anı sayfasının avantajları:</p>
<ul>
<li><strong>Benzersiz:</strong> Dünyada sadece sevgilinize özel bir hediye</li>
<li><strong>Kalıcı:</strong> Yıllar sonra bile erişilebilir, anılarınız kaybolmaz</li>
<li><strong>Kolay paylaşım:</strong> Tek bir link ile her yerden erişim</li>
<li><strong>Müzikli:</strong> Favori şarkınızı arka planda çalabilirsiniz</li>
<li><strong>Uygun fiyat:</strong> Lüks restoran fiyatının çok altında, ama etkisi çok daha büyük</li>
</ul>

<h2>Forilove ile Nasıl Yapılır?</h2>
<p>Forilove, kod bilmeden dakikalar içinde profesyonel görünümlü bir anı sayfası oluşturmanızı sağlar. Yapmanız gereken çok basit:</p>
<ol>
<li><strong>Üye olun</strong> — Ücretsiz hesap oluşturun</li>
<li><strong>Şablon seçin</strong> — Birbirinden güzel şablonlar arasından size en uygun olanı seçin</li>
<li><strong>Kişiselleştirin</strong> — Fotoğraflarınızı, mesajlarınızı ve müziğinizi ekleyin</li>
<li><strong>Yayınlayın</strong> — Tek tıkla sayfanızı yayına alın ve linki sevgilinize gönderin</li>
</ol>
<p>Tüm süreç 10 dakikadan kısa sürer. Teknik bilgi gerektirmez. Telefonunuzdan bile yapabilirsiniz.</p>

<h2>Hangi Özel Günlerde Kullanılır?</h2>
<p>Kişiselleştirilmiş anı sayfaları sadece Sevgililer Günü için değil, birçok özel an için harika bir hediye seçeneğidir:</p>
<ul>
<li>Sevgililer Günü sürprizi</li>
<li>Yıl dönümü kutlaması</li>
<li>Doğum günü hediyesi</li>
<li>Evlilik teklifi sayfası</li>
<li>Uzak mesafe ilişkilerde moral hediyesi</li>
<li>Tanışma yıl dönümü</li>
</ul>

<h2>Sevgilinizin Yüzündeki Gülümseme İçin</h2>
<p>Hediyenin maddi değeri değil, arkasındaki düşünce önemlidir. Sevgiliniz için özel bir sayfa hazırlamak, ona ne kadar değer verdiğinizi göstermenin en güzel yollarından biridir. Üstelik bu hediye, yıllar sonra birlikte bakıp gülümseyeceğiniz dijital bir anı defteri olacak.</p>
<p>Forilove ile bugün ilk adımı atın ve sevgilinize unutulmaz bir dijital hediye hazırlayın.</p>',
  '4 dk',
  true,
  '2026-02-10T00:00:00Z',
  '2026-02-10T00:00:00Z'
);
