import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

// Retry with exponential backoff for 429 errors
async function callGeminiWithRetry(
  model: any,
  content: any[],
  maxRetries = 3
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(content);
    } catch (error: any) {
      const is429 = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("Resource exhausted");
      if (is429 && attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 15000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}

const EXAMPLE_TEMPLATE = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bizim Hikayemiz</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#e8496a;--primary-light:#fdf2f4;--dark:#1a1a2e;--text:#2d2d3a;--text-light:#6b7280;--gold:#d4a853}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;color:var(--text);background:#fff;overflow-x:hidden}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}
.hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(26,26,46,0.3),rgba(26,26,46,0.7))}
.hero-content{position:relative;z-index:1;text-align:center;padding:2rem;max-width:700px}
.hero-content h1{font-family:'Playfair Display',serif;font-size:clamp(2.5rem,7vw,5rem);color:#fff;margin-bottom:0.75rem;line-height:1.1;text-shadow:0 2px 20px rgba(0,0,0,0.3)}
.hero-content p{font-size:clamp(1rem,2.5vw,1.25rem);color:rgba(255,255,255,0.9);font-weight:300;letter-spacing:0.02em}
.heart-divider{display:flex;align-items:center;justify-content:center;gap:1rem;padding:2rem 0}
.heart-divider::before,.heart-divider::after{content:'';width:60px;height:1px;background:var(--primary)}
.heart-divider span{color:var(--primary);font-size:1.25rem}
.section{padding:clamp(3rem,8vw,6rem) clamp(1rem,4vw,2rem);max-width:900px;margin:0 auto}
.section-title{font-family:'Playfair Display',serif;font-size:clamp(1.5rem,4vw,2.25rem);text-align:center;margin-bottom:0.5rem;color:var(--dark)}
.section-subtitle{text-align:center;color:var(--text-light);font-size:0.95rem;margin-bottom:2.5rem}
.photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(0.5rem,2vw,1rem)}
.photo-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:1rem;transition:transform 0.4s ease;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
.photo-grid img:hover{transform:scale(1.03)}
.letter-card{background:var(--primary-light);border-radius:1.5rem;padding:clamp(1.5rem,4vw,3rem);position:relative;overflow:hidden}
.letter-card::before{content:'"';position:absolute;top:-20px;left:20px;font-size:8rem;color:var(--primary);opacity:0.1;font-family:'Playfair Display',serif;line-height:1}
.letter-card p{font-size:clamp(1rem,2.5vw,1.15rem);line-height:1.9;color:var(--text);position:relative;white-space:pre-line}
.date-badge{display:inline-flex;align-items:center;gap:0.5rem;background:var(--primary);color:#fff;padding:0.75rem 2rem;border-radius:999px;font-weight:500;font-size:0.95rem;box-shadow:0 4px 15px rgba(232,73,106,0.3)}
.timeline{position:relative;padding-left:2rem}
.timeline::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--primary),var(--gold))}
.timeline-item{position:relative;padding:0 0 2.5rem 2rem}
.timeline-item::before{content:'';position:absolute;left:-0.45rem;top:0.25rem;width:12px;height:12px;background:var(--primary);border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--primary)}
.timeline-item h3{font-family:'Playfair Display',serif;font-size:1.1rem;margin-bottom:0.25rem;color:var(--dark)}
.timeline-item p{color:var(--text-light);font-size:0.9rem;line-height:1.6}
.footer{text-align:center;padding:3rem 1.5rem;background:var(--dark);color:rgba(255,255,255,0.6);font-size:0.875rem}
.footer span{color:var(--primary)}
@media(max-width:640px){
.photo-grid{grid-template-columns:1fr 1fr;gap:0.5rem}
.timeline{padding-left:1.5rem}
.timeline-item{padding-left:1.5rem}
}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
.hero-content{animation:fadeInUp 1s ease-out}
</style>
</head>
<body>
<div class="hero">
<div class="hero-bg" data-editable="cover_photo" data-type="background-image" data-label="Kapak Fotoğrafı" style="background-image:url('https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1400&q=80')"></div>
<div class="hero-content">
<h1 data-editable="title" data-type="text" data-label="Ana Başlık">Bizim Hikayemiz</h1>
<p data-editable="subtitle" data-type="text" data-label="Alt Başlık">Her anımız bir masal gibi</p>
</div>
</div>
<div class="heart-divider"><span>♥</span></div>
<div class="section" style="text-align:center">
<div class="date-badge">
<span data-editable="special_date" data-type="date" data-label="Özel Tarih">14.02.2024</span>
</div>
</div>
<section class="section" data-area="gallery" data-area-label="Fotoğraf Galerisi">
<h2 class="section-title">Anılarımız</h2>
<p class="section-subtitle" data-editable="gallery_subtitle" data-type="text" data-label="Galeri Alt Başlığı">Birlikte geçirdiğimiz en güzel anlar</p>
<div class="photo-grid">
<img data-editable="photo_1" data-type="image" data-label="Fotoğraf 1" src="https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=600&q=80" alt="">
<img data-editable="photo_2" data-type="image" data-label="Fotoğraf 2" src="https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80" alt="">
<img data-editable="photo_3" data-type="image" data-label="Fotoğraf 3" src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80" alt="">
<img data-editable="photo_4" data-type="image" data-label="Fotoğraf 4" src="https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&q=80" alt="">
</div>
</section>
<section class="section" data-area="love_letter" data-area-label="Aşk Mektubu">
<h2 class="section-title">Sana Mektubum</h2>
<div class="letter-card">
<p data-editable="letter" data-type="textarea" data-label="Mektup">Sevgilim,

Seninle geçirdiğim her an hayatımın en değerli hazinesi. Gülüşün güneş gibi aydınlatıyor dünyamı.

Sonsuza kadar seninle...</p>
</div>
</section>
<section class="section" data-area="timeline" data-area-label="Zaman Çizelgesi">
<h2 class="section-title">Hikayemiz</h2>
<div class="timeline">
<div class="timeline-item">
<h3 data-editable="milestone_1_title" data-type="text" data-label="Anı 1 Başlık">İlk Tanışma</h3>
<p data-editable="milestone_1_text" data-type="text" data-label="Anı 1 Açıklama">Kaderimiz o gün birleşti</p>
</div>
<div class="timeline-item">
<h3 data-editable="milestone_2_title" data-type="text" data-label="Anı 2 Başlık">İlk Buluşma</h3>
<p data-editable="milestone_2_text" data-type="text" data-label="Anı 2 Açıklama">Kalbimin sana ait olduğunu anladım</p>
</div>
</div>
</section>
<div class="footer">
<p data-editable="footer_text" data-type="text" data-label="Alt Yazı">Sonsuza kadar <span>♥</span></p>
</div>
</body>
</html>`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "creator" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Çok fazla istek. Lütfen 1 dakika bekleyin." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { topic, style, sections, colorScheme, mood } = body as {
      topic: string;
      style: string;
      sections: string;
      colorScheme: string;
      mood: string;
    };

    if (!topic || typeof topic !== "string" || topic.length > 200) {
      return NextResponse.json({ error: "Konu geçersiz (max 200 karakter)" }, { status: 400 });
    }

    const systemPrompt = `Sen dünya standartlarında bir web tasarımcısısın. Forilove platformu için görsel olarak çarpıcı, profesyonel HTML aşk/anı şablonları üretiyorsun.

## TASARIM KALİTESİ - ÇOK ÖNEMLİ
Awwwards, Dribbble ve Pinterest'teki en iyi tasarımlar seviyesinde üret. Şunları MUTLAKA uygula:
- Google Fonts kullan (Playfair Display, Cormorant Garamond, Dancing Script, Lora, Inter, Poppins gibi)
- CSS custom properties (--primary, --dark, --text gibi) ile tutarlı renk sistemi
- Gradient overlay'ler, box-shadow, border-radius ile derinlik kat
- Smooth hover efektleri (transform, opacity transition)
- @keyframes ile subtle giriş animasyonları (fadeInUp, fadeIn gibi)
- clamp() ile responsive tipografi: başlıklar clamp(2rem, 6vw, 4rem), paragraflar clamp(0.95rem, 2vw, 1.15rem)
- Minimum 100vh hero section, background-image cover + dark overlay
- Bölümler arası dekoratif ayırıcılar (kalp, çizgi, süsleme)
- letter-spacing, line-height ile mükemmel tipografi
- Yeterli padding ve margin ile nefes alan tasarım
- Mobil (320px) ve desktop'ta eşit güzel görünmeli

## ŞABLON KURALLARI
- data-editable formatı kullan (data-editable, data-type, data-label attribute'ları)
- Tipler: text, textarea, image, background-image, color, date, url, video
- data-area ile kaldırılabilir bölümler (data-area-label ile Türkçe isim)
- En az 8-12 düzenlenebilir alan
- En az 3-4 kaldırılabilir bölüm
- Tüm görseller için GERÇEK Unsplash URL'leri (https://images.unsplash.com/photo-... formatında, ?w=800&q=80 ile)
- JavaScript YASAK
- Tüm CSS <style> etiketinde

## REFERANS ŞABLON
Aşağıdaki şablonu kalite ve yapı referansı olarak kullan. KOPYALAMA, kendi orijinal tasarımını yap ama aynı kalite seviyesinde ol:

${EXAMPLE_TEMPLATE}

## ÇIKTI
SADECE HTML kodu döndür. \`\`\`html code block KULLANMA. Direkt <!DOCTYPE html> ile başla. Hiçbir açıklama ekleme.`;

    const userPrompt = `Aşağıdaki bilgilere göre özgün, çarpıcı bir şablon tasarla:
- Konu: ${topic.slice(0, 200)}
${style ? `- Tasarım stili: ${style.slice(0, 100)}` : '- Tasarım stili: Modern, elegant'}
${sections ? `- Bölümler: ${sections.slice(0, 200)}` : '- Bölümler: Hero kapak, tarih, fotoğraf galerisi, aşk mektubu, timeline, footer'}
${colorScheme ? `- Renkler: ${colorScheme.slice(0, 100)}` : '- Renkler: Romantik pembe-bordo tonları'}
${mood ? `- Atmosfer: ${mood.slice(0, 100)}` : '- Atmosfer: Duygusal ve romantik'}

Her bölüme anlamlı data-editable ve data-area attribute'ları ekle. Varsayılan metinler Türkçe ve duygusal olsun.`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 16000,
      },
    });

    const result = await callGeminiWithRetry(
      model,
      [{ text: systemPrompt }, { text: userPrompt }],
      3
    );

    let html = result.response.text();
    if (!html) {
      return NextResponse.json({ error: "AI şablon üretemedi" }, { status: 500 });
    }

    html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      return NextResponse.json({ error: "Geçersiz HTML çıktısı" }, { status: 500 });
    }

    return NextResponse.json({ html });
  } catch (error: any) {
    console.error("AI template error:", error);
    const message = error.message || "Şablon oluşturma hatası";
    const status = message.includes("zaman aşımı") ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
