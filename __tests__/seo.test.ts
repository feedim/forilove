import { describe, it, expect } from 'vitest';
import { generateMetaKeywords, generateMetaTitle, generateMetaDescription } from '@/lib/seo';

// ─── Yardımcı: HTML üretici ───

function makeHtml(opts: {
  paragraphs?: string[];
  headings?: string[];
  bolds?: string[];
  captions?: string[];
}) {
  let html = '';
  for (const h of opts.headings || []) html += `<h2>${h}</h2>`;
  for (const p of opts.paragraphs || []) {
    let content = p;
    for (const b of opts.bolds || []) {
      content = content.replace(b, `<strong>${b}</strong>`);
    }
    html += `<p>${content}</p>`;
  }
  for (const c of opts.captions || []) html += `<figcaption>${c}</figcaption>`;
  return html;
}

// ─── Test 1: Boks Animeleri Örneği ───

describe('generateMetaKeywords', () => {
  it('boks animeleri örneği — "boks animeleri" birinci keyword olmalı', () => {
    const title = 'İzlenmesi Gereken Boks Animeleri: Tam LİSTE!';
    const bodyText = Array(15).fill(
      'Bu boks animeleri listesinde en iyi boks animeleri yer almaktadır. Boks animelerinin heyecan verici dünyasına hoş geldiniz.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['En İyi Boks Animeleri', 'Boks Animeleri Listesi'],
      bolds: ['boks animeleri'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'izlenmesi-gereken-boks-animeleri-tam-liste',
      tags: ['boks animeleri', 'anime'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // "boks animeleri" birinci keyword olmalı
    expect(keywords[0]).toContain('boks animeleri');
  });

  // ─── Test 2: Suffix Korunma ───

  it('suffix korunma — "animeleri" olduğu gibi kalmalı, "anime" olmamalı', () => {
    const title = 'En İyi Boks Animeleri';
    const bodyText = Array(10).fill(
      'Boks animeleri arasında en popüler boks animeleri şunlardır.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['Boks Animeleri Rehberi'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'en-iyi-boks-animeleri',
      tags: ['boks animeleri'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // "animeleri" ekleri korunmalı, "anime" olarak kırpılmamalı
    const hasAnimeleri = keywords.some(k => k.includes('animeleri'));
    expect(hasAnimeleri).toBe(true);
    // Tek başına "anime" olarak kırpılmış olmamalı
    const hasBareAnime = keywords.some(k => k === 'anime');
    expect(hasBareAnime).toBe(false);
  });

  // ─── Test 3: Yüksek Frekanslı Body-Only İfade ───

  it('yüksek frekanslı body-only ifade — bodyFreq >= 3 ile eşik geçmeli', () => {
    const title = 'Genel Başlık Yazısı';
    // "derin öğrenme" body'de 5+ kez tekrar ediyor ama title/slug/tag'de yok
    const bodyText = Array(6).fill(
      'Derin öğrenme teknolojileri ile yapay zeka gelişiyor. Derin öğrenme modelleri çok güçlüdür.'
    ).join(' ');
    const html = makeHtml({ paragraphs: [bodyText] });

    const result = generateMetaKeywords(title, html, {
      slug: 'genel-baslik-yazisi',
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    const hasDeepLearning = keywords.some(k => k.includes('derin öğrenme'));
    expect(hasDeepLearning).toBe(true);
  });

  // ─── Test 4: Tek Zone İfade Elenmeli ───

  it('tek zone ifade — tag-only + içerikte yok → elenmeli', () => {
    const title = 'Yemek Tarifleri Rehberi';
    const bodyText = Array(5).fill(
      'Bu bir yemek tarifleri rehberidir. Lezzetli yemek tarifleri burada bulunur.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['Yemek Tarifleri Çeşitleri'],
    });

    // "kuantum fiziği" sadece tag'de geçiyor, içerikte hiç yok → tek zone → elenmeli
    const result = generateMetaKeywords(title, html, {
      slug: 'yemek-tarifleri-rehberi',
      tags: ['yemek tarifleri', 'kuantum fiziği'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    const hasQuantum = keywords.some(k => k.includes('kuantum fiziği'));
    expect(hasQuantum).toBe(false);
  });

  // ─── Test 5: Dedup — Alt-String Elenmeli ───

  it('dedup — alt-string olan düşük puanlı aday elenmeli', () => {
    const title = 'React Native Mobil Uygulama Geliştirme';
    const bodyText = Array(8).fill(
      'React Native ile mobil uygulama geliştirme sürecinde React Native kullanarak harika uygulamalar yapabilirsiniz.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['React Native Geliştirme'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'react-native-mobil-uygulama-gelistirme',
      tags: ['react native'],
    });

    const keywords = result.split(',').map(k => k.trim().toLowerCase());
    // "react native" ve "react native mobil" gibi aynı anda olmamalı
    // (daha uzun olan tercih edilmeli, kısa alt-string elenmeli)
    const reactNativeExact = keywords.filter(k => k === 'react native');
    const reactNativeLonger = keywords.filter(k => k.includes('react native') && k !== 'react native');
    // Eğer daha uzun bir "react native ..." varsa, tek başına "react native" olmamalı
    if (reactNativeLonger.length > 0) {
      expect(reactNativeExact.length).toBe(0);
    }
  });

  // ─── Test 5b: Listicle Item Filtreleme ───

  it('listicle item isimleri — anchor zone yoksa heading+caption yetmemeli', () => {
    const title = 'İzlenmesi Gereken Boks Animeleri: Tam LİSTE!';
    // Her anime ismi heading + caption + body'de geçiyor ama title/slug/tag ile eşleşmiyor
    const html = [
      '<h2>1. Megalobox (2018)</h2>',
      '<figcaption>Megalobox (2018)</figcaption>',
      '<p>Megalobox, yeraltı dövüşlerinde geçen bir boks animesidir. Boks animeleri arasında en popüler olanlardan biridir.</p>',
      '<h2>2. Hajime no Ippo (2000)</h2>',
      '<figcaption>Hajime no Ippo (2000)</figcaption>',
      '<p>Hajime no Ippo, boksla tanışan bir gencin hikayesidir. Boks animeleri sevenler için mükemmel bir seridir.</p>',
      '<h2>3. Kengan Ashura (2019)</h2>',
      '<figcaption>Kengan Ashura (2019)</figcaption>',
      '<p>Kengan Ashura, gladyatör dövüşlerinin anlatıldığı bir seridir. Boks animeleri tadında bir yapımdır.</p>',
    ].join('');

    const result = generateMetaKeywords(title, html, {
      slug: 'izlenmesi-gereken-boks-animeleri-tam-liste',
      tags: ['boks animeleri'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // Anime isimleri keyword olmamalı — anchor zone (title/slug/tag) ile eşleşmiyorlar
    expect(keywords.some(k => k.includes('hajime no ippo'))).toBe(false);
    expect(keywords.some(k => k.includes('kengan ashura'))).toBe(false);
    // "boks animeleri" olmalı
    expect(keywords.some(k => k.includes('boks animeleri'))).toBe(true);
  });

  // ─── Test 5c: Metadata Label Filtreleme ───

  it('metadata label — tekrar eden "X:" pattern\'leri keyword olmamalı', () => {
    const title = 'En İyi Netflix Hastane Dizileri';
    // Her dizide "IMDb:", "Tür:", "Yayın:" tekrar ediyor — metadata label'lar
    const items = Array.from({ length: 5 }, (_, i) => [
      `<h2>${i + 1}. Dizi Adı ${i + 1}</h2>`,
      `<p>Bu dizi hastane ortamında geçer. Netflix hastane dizileri arasında öne çıkar.</p>`,
      `<p>IMDb: ${(7 + i * 0.2).toFixed(1)}</p>`,
      `<p>Yayın: Ocak ${2020 + i}</p>`,
      `<p>Tür: Dram</p>`,
    ].join('')).join('');
    const html = items;

    const result = generateMetaKeywords(title, html, {
      slug: 'en-iyi-netflix-hastane-dizileri',
      tags: ['hastane dizileri', 'netflix dizi'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // Metadata label'ları keyword olmamalı
    expect(keywords.some(k => k.includes('yayın'))).toBe(false);
    expect(keywords.some(k => k.includes('imdb'))).toBe(false);
    // "tür dram" veya "tür" içeren n-gram olmamalı
    const hasTurLabel = keywords.some(k => k.split(/\s+/).includes('tür'));
    expect(hasTurLabel).toBe(false);
    // Gerçek keyword "hastane dizileri" olmalı
    expect(keywords.some(k => k.includes('hastane dizileri'))).toBe(true);
  });

  // ─── Test 5d: Bağlaç/Stop Word Kenar Filtresi ───

  it('bağlaç filtresi — stop word ile başlayan/biten n-gram keyword olmamalı', () => {
    const title = 'Kraliyet Temalı En İyi Anime: Taht Oyunları ve Saray Entrikaları';
    const bodyText = Array(8).fill(
      'Bu kraliyet animeleri arasında taht oyunları ve saray entrikaları öne çıkar. Bu yapımlar ile birlikte izleyiciyi ekrana kilitler.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['Kraliyet Animeleri', 'Taht Oyunları'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'kraliyet-temali-en-iyi-anime-taht-oyunlari-ve-saray-entrikalari',
      tags: ['kraliyet animeleri'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // "ve saray entrikaları" gibi bağlaç ile başlayan ifadeler olmamalı
    const startsWithVe = keywords.some(k => k.startsWith('ve '));
    expect(startsWithVe).toBe(false);
    // "en iyi" tek başına keyword olmamalı (stop word kenar)
    expect(keywords.includes('en iyi')).toBe(false);
    // Gerçek keyword'ler olmalı
    const hasKraliyet = keywords.some(k => k.includes('kraliyet'));
    expect(hasKraliyet).toBe(true);
  });

  // ─── Test 5e: Tag Çapraz Çarpımı ───

  it('tag çapraz çarpımı — tek-kelime + çok-kelime tag birleşmeli', () => {
    const title = "Netflix'te İzleyebileceğiniz En İyi Zombi Dizileri";
    const bodyText = Array(5).fill(
      'Bu zombi dizileri arasında en popüler zombi dizileri Netflix ile izlenebilir.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['En İyi Zombi Dizileri'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'netflixte-izleyebileceginiz-en-iyi-zombi-dizileri',
      tags: ['zombi dizileri', 'netflix'],
    });

    const keywords = result.split(',').map(k => k.trim().toLocaleLowerCase('tr-TR'));
    // "zombi dizileri" ana keyword olmalı
    expect(keywords.some(k => k.includes('zombi dizileri'))).toBe(true);
    // "netflix zombi dizileri" tag combo olarak bulunmalı
    expect(keywords.some(k => k.includes('netflix zombi dizileri'))).toBe(true);
  });

  // ─── Test 6: Çarpan Patlaması Yok ───

  it('çarpan patlaması yok — 5+ zone\'da max ×1.5', () => {
    const title = 'Test Konusu Hakkında';
    const bodyText = Array(10).fill(
      'Test konusu hakkında detaylı bilgi. Test konusu ile ilgili yazılar.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: ['Test Konusu Rehberi'],
      bolds: ['test konusu'],
      captions: ['test konusu görseli'],
    });

    const result = generateMetaKeywords(title, html, {
      slug: 'test-konusu-hakkinda',
      tags: ['test konusu'],
    });

    // Sonuç dönmeli (patlamamalı, hata vermemeli)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  // ─── Test 7: Boş İçerik Fallback ───

  it('boş içerik fallback — title dönmeli', () => {
    const title = 'Empty content test';
    const html = '';

    const result = generateMetaKeywords(title, html);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Fallback olarak title bazlı bir şey dönmeli
    expect(result.toLowerCase()).toContain('empty content test');
  });

  // ─── Test 8: Max 8 Keyword ───

  it('max 8 keyword döndürmeli', () => {
    const title = 'Çok Konulu Uzun Bir Makale Başlığı';
    const bodyText = Array(20).fill(
      'Bu makale birçok farklı konu hakkında bilgi verir. Yazılım geliştirme, veri bilimi, yapay zeka, ' +
      'makine öğrenmesi, bulut bilişim, siber güvenlik, mobil uygulama ve web geliştirme konularını kapsar.'
    ).join(' ');
    const html = makeHtml({
      paragraphs: [bodyText],
      headings: [
        'Yazılım Geliştirme', 'Veri Bilimi', 'Yapay Zeka',
        'Makine Öğrenmesi', 'Bulut Bilişim', 'Siber Güvenlik',
        'Mobil Uygulama', 'Web Geliştirme', 'DevOps Pratikleri',
        'Blockchain Teknolojisi',
      ],
    });

    const result = generateMetaKeywords(title, html);
    const keywords = result.split(',').map(k => k.trim()).filter(k => k.length > 0);
    expect(keywords.length).toBeLessThanOrEqual(8);
  });
});

// ─── generateMetaTitle Regresyon Testleri ───

describe('generateMetaTitle', () => {
  it('kısa title olduğu gibi dönmeli', () => {
    expect(generateMetaTitle('Kısa Başlık', '')).toBe('Kısa Başlık');
  });

  it('60 karakter sınırı — uzun title kesilmeli', () => {
    const longTitle = 'Bu çok uzun bir başlık ve altmış karakterden fazla olduğu için kesilmesi gerekiyor mutlaka';
    const result = generateMetaTitle(longTitle, '');
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).toContain('...');
  });

  it('60 karakter veya altında ise kesilmemeli', () => {
    const title = 'Tam altmış karakterlik bir başlık bu olacak şekilde ayarla';
    if (title.length <= 60) {
      expect(generateMetaTitle(title, '')).toBe(title);
    }
  });
});

// ─── generateMetaDescription Regresyon Testleri ───

describe('generateMetaDescription', () => {
  it('ilk paragraf 120-155 karakter arasında ise direkt dönmeli', () => {
    const para = 'A'.repeat(130);
    const html = `<p>${para}</p>`;
    expect(generateMetaDescription('Test', html)).toBe(para);
  });

  it('ilk paragraf 155 karakterden uzunsa kesilmeli', () => {
    const para = 'Bu bir test paragrafıdır ve çok uzundur. '.repeat(10);
    const html = `<p>${para}</p>`;
    const result = generateMetaDescription('Test', html);
    expect(result.length).toBeLessThanOrEqual(155);
  });

  it('paragraf yoksa plainText kullanılmalı', () => {
    const html = '<div>Bu bir düz metin içeriğidir ve paragraf etiketi yoktur ama yeterince uzundur.</div>';
    const result = generateMetaDescription('Test', html);
    expect(result.length).toBeGreaterThan(0);
  });

  it('içerik yoksa title fallback', () => {
    const result = generateMetaDescription('Güzel Başlık', '');
    expect(result).toContain('Güzel Başlık');
  });
});
