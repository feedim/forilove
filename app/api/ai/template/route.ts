// ♥ Forilove — AI Template Generation (Claude Haiku 4.5)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  assembleTemplate,
  validateAIResponse,
  FALLBACK_RESPONSE,
  type AITemplateResponse,
} from "@/lib/constants/template-sections";

// ♥ Forilove — Rate Limiter
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

// ♥ Forilove — System Prompt
const SYSTEM_PROMPT = `Sen premium web tasarım AI'ısın. Forilove aşk sayfaları için tasarım kararları üretiyorsun. SADECE JSON döndür.

## GÖREV
Konuya göre BENZERSIZ bir tasarım oluştur. Her seferinde FARKLI mimari, renk, font, bölüm kombinasyonu kullan.

## customCSS — EN ÖNEMLİ ALAN
customCSS ile şablonun TÜM görünümünü değiştirirsin. Override edebileceğin class'lar:

HERO: .fl-hero .fl-hero-bg .fl-hero-overlay .fl-hero-content .fl-hero-subtitle .fl-hero-title .fl-hero-date
GALLERY: .fl-gallery .fl-gallery-header .fl-gallery-subtitle .fl-gallery-grid .fl-gallery-grid img
QUOTE: .fl-quote .fl-quote-text .fl-quote-author
LETTER: .fl-letter .fl-letter-body .fl-letter-text
TIMELINE: .fl-timeline .fl-timeline-track .fl-timeline-item .fl-timeline-dot .fl-timeline-title .fl-timeline-desc
FULL IMAGE: .fl-fullimg .fl-fullimg-photo .fl-fullimg-overlay .fl-fullimg-text
COUNTDOWN: .fl-countdown .fl-countdown-date .fl-countdown-text
DATE: .fl-date .fl-date-label .fl-date-value
FOOTER: .fl-footer .fl-footer-message .fl-footer-names
SHARED: .fl-label body

## 6 MİMARİ — HER SEFERİNDE BİRİNİ SEÇ VEYA KARIŞTIR

1) KARANLIK SİNEMATİK: body{background:#0a0a0a} — düşük opacity beyaz metinler, brightness filtreli fotolar, ince çizgiler, lüks/gizemli
2) SICAK ROMANTİK: body{background:#fef9f3} — yumuşak tonlar, border-radius'lu kartlar, box-shadow'lu galeri, arka plan renkli bölümler
3) MİNİMAL EDİTÖRYEL: body{background:#fff} — çok az renk, ince border ayırıcılar, büyük tipografi, bol boşluk, dergi estetiği
4) NEON GECE: body{background:#0d0d0d} — neon vurgular (cyan/magenta/lime), glow efektleri (text-shadow, box-shadow), futuristik
5) VİNTAGE SICAKLIK: body{background:#f5f0eb} — sepia tonları, nostaljik, sıcak renkler, border-left quote, yumuşak kenarlar
6) BOLD MODERN: güçlü renkler, dev tipografi (font-weight:800, letter-spacing:-4px, text-transform:uppercase), cesur, asimetrik

customCSS minimum 800 karakter olmalı. Her bölümü (hero, gallery, quote, letter, timeline, footer) özelleştir.

## JSON YAPISI
{
  "fonts": ["BaslikFont:wght@400;700", "GovdeFont:wght@300;400;500"],
  "cssVariables": {"--primary":"#hex","--primary-light":"#hex","--dark":"#hex","--text":"#hex","--text-light":"#hex","--accent":"#hex"},
  "sections": ["hero","gallery","quotes","love_letter","timeline","full_image","footer"],
  "animations": {"hero":"fadeInUp","sections":"fadeIn"},
  "bodyBackground": "#fafafa",
  "customCSS": "ÇOK ÖNEMLİ: minimum 800 karakter CSS, her bölümü override et",
  "defaultTexts": {"title":"","subtitle":"","special_date":"","gallery_subtitle":"","letter":"","quote_text":"","quote_author":"","milestone_1_title":"","milestone_1_text":"","milestone_2_title":"","milestone_2_text":"","full_image_text":"","footer_text":"","footer_names":"","countdown_date":"","countdown_label":"","video_caption":""}
}

## FONTLAR
Başlık (HER SEFERİNDE FARKLI): Cormorant Garamond, Playfair Display, Bodoni Moda, Lora, Cinzel, Dancing Script, EB Garamond, Marcellus, Italiana, Spectral, Libre Baskerville, Crimson Text
Format: "FontAdi:wght@400;700" veya "FontAdi:ital,wght@0,400;0,700;1,400"
Gövde: Inter, Poppins, Lato, Nunito, Montserrat, Raleway — Format: "FontAdi:wght@300;400;500"

## BÖLÜMLER
Mevcut: hero, date, gallery, love_letter, timeline, countdown, quotes, full_image, video, footer
5-8 bölüm seç. hero + footer her zaman.

## RENKLER
Karanlık tema: --dark=#fff veya açık ton, --text=rgba beyaz (#d4d4d4), --text-light=#666, --primary=muted tonda
Açık tema: --dark=koyu (#1a1a2e), --text=koyu (#2d2d3a), --text-light=gri (#6b7280), --primary=vurgu rengi
Neon: --primary=neon renk, --accent=ikinci neon, geri kalan karanlık

## METİNLER
Türkçe, duygusal, edebi. title: 2-4 kelime çarpıcı. letter: 3+ paragraf samimi. quote_text: güçlü tek cümle. full_image_text: sinematik kısa.

## KRİTİK
- Her istekte FARKLI mimari + font + renk + customCSS
- Basit prompt bile ("sevgilim için") premium sonuç üretmeli
- customCSS BOŞ BIRAKMA — şablonu benzersiz yapan şey bu`;

export async function POST(req: NextRequest) {
  try {
    // ♥ Forilove — Auth
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

    // ♥ Forilove — Parse Request
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

    // ♥ Forilove — Build User Prompt
    const userPrompt = `Konu: ${topic.slice(0, 200)}
${style ? `Stil: ${style.slice(0, 100)}` : ""}
${sections ? `Bölümler: ${sections.slice(0, 200)}` : ""}
${colorScheme ? `Renkler: ${colorScheme.slice(0, 100)}` : ""}
${mood ? `Atmosfer: ${mood.slice(0, 100)}` : ""}`.trim();

    // ♥ Forilove — Call Claude Haiku 4.5
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      temperature: 1,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // ♥ Forilove — Extract Response
    const textBlock = message.content.find((b) => b.type === "text");
    const rawText = textBlock?.text || "";

    if (!rawText) {
      const fallback: AITemplateResponse = {
        ...FALLBACK_RESPONSE,
        defaultTexts: { ...FALLBACK_RESPONSE.defaultTexts, title: topic.slice(0, 100) },
      };
      return NextResponse.json({ html: assembleTemplate(fallback) });
    }

    // ♥ Forilove — Parse JSON (Claude might wrap in ```json```)
    let jsonStr = rawText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Claude JSON parse error, using fallback. Raw:", rawText.slice(0, 500));
      const fallback: AITemplateResponse = {
        ...FALLBACK_RESPONSE,
        defaultTexts: { ...FALLBACK_RESPONSE.defaultTexts, title: topic.slice(0, 100) },
      };
      return NextResponse.json({ html: assembleTemplate(fallback) });
    }

    // ♥ Forilove — Validate & Assemble
    const validated = validateAIResponse(parsed);
    if (!validated) {
      console.error("Claude response validation failed, using fallback");
      const fallback: AITemplateResponse = {
        ...FALLBACK_RESPONSE,
        defaultTexts: { ...FALLBACK_RESPONSE.defaultTexts, title: topic.slice(0, 100) },
      };
      return NextResponse.json({ html: assembleTemplate(fallback) });
    }

    const html = assembleTemplate(validated);
    return NextResponse.json({ html });
  } catch (error: any) {
    console.error("AI template error:", error);

    // ♥ Forilove — Rate limit from Anthropic
    if (error?.status === 429) {
      return NextResponse.json(
        { error: "AI servisi meşgul. Lütfen birkaç saniye bekleyin." },
        { status: 429 }
      );
    }

    const message = error.message || "Şablon oluşturma hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
