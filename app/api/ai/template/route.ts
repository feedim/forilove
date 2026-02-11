import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Rate limit: per-user, max 3 requests per minute (heavier operation)
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms / 1000}s)`)), ms)
    ),
  ]);
}

const TEMPLATE_GUIDE = `# Forilove Şablon Kuralları

## Genel
- Tek HTML dosyası: <html>, <head>, <body>
- Tüm CSS inline <style> etiketi içinde
- Responsive: min 320px, clamp(), vw, media query kullan
- Türkçe lang="tr"

## Hook Formatı: data-editable (ÖNERİLEN)
Her düzenlenebilir eleman:
\`\`\`html
<h1 data-editable="title" data-type="text" data-label="Başlık">Varsayılan</h1>
\`\`\`

### Tipler:
- text: tek satır metin, textContent değişir
- textarea: çok satırlı metin
- image: <img> src değişir. Varsayılan src Unsplash URL olmalı
- background-image: style'a background-image eklenir. Varsayılan Unsplash URL
- color: HEX renk. data-css-property ile hedef CSS özelliği belirtilir (varsayılan: background-color)
- date: YYYY-MM-DD formatında tarih
- url: <a> href değişir
- video: <video> src değişir

### Kurallar:
- data-editable key'leri benzersiz, [a-zA-Z0-9_] karakterleri
- data-label ile Türkçe açıklayıcı etiket
- Görseller için gerçek çalışan Unsplash URL'leri kullan (https://images.unsplash.com/photo-...)

## Kaldırılabilir Bölümler
\`\`\`html
<section data-area="gallery" data-area-label="Fotoğraf Galerisi">...</section>
\`\`\`
- data-area benzersiz key
- data-area-label Türkçe bölüm adı
- İçinde data-editable elemanlar olabilir

## CSS İpuçları
- * { margin: 0; padding: 0; box-sizing: border-box; } reset kullan
- Google Fonts <link> ile yüklenebilir
- Animasyonlar @keyframes ile
- Gradient, glassmorphism, parallax efektleri serbest
- Platform altta 34px branding bar ekler, ekstra boşluk gereksiz

## KRİTİK
- JavaScript YASAK (DOMPurify temizler)
- Form elemanları çalışmaz
- Sadece http/https URL'leri
- Her görsel alanının gerçek çalışan bir varsayılan Unsplash görseli olmalı`;

export async function POST(req: NextRequest) {
  try {
    // Auth + role check
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

    const systemPrompt = `Sen Forilove platformu için profesyonel HTML şablon tasarımcısısın. Verilen bilgilere göre tam çalışan, estetik, responsive bir HTML şablon üretiyorsun.

${TEMPLATE_GUIDE}

## Tasarım Prensipleri
- Modern, minimal ve estetik tasarım
- Duygusal, romantik atmosfer
- Smooth scroll, subtle animasyonlar (CSS only)
- Mobil-öncelikli responsive tasarım
- Yeterli whitespace ve hiyerarşi
- Tutarlı renk paleti ve tipografi
- En az 5-8 düzenlenebilir alan (data-editable)
- En az 2-3 kaldırılabilir bölüm (data-area)
- Tüm görseller için gerçek Unsplash URL'leri (https://images.unsplash.com/photo-...)

## Çıktı
SADECE HTML kodu döndür. Başka açıklama, yorum veya markdown ekleme. \`\`\`html gibi code block işaretleri KULLANMA. Direkt <!DOCTYPE html> ile başla.`;

    const userPrompt = `Şablon oluştur:
- Konu: ${topic.slice(0, 200)}
${style ? `- Tasarım stili: ${style.slice(0, 100)}` : ''}
${sections ? `- İstenen bölümler: ${sections.slice(0, 200)}` : ''}
${colorScheme ? `- Renk şeması: ${colorScheme.slice(0, 100)}` : ''}
${mood ? `- Ruh hali/atmosfer: ${mood.slice(0, 100)}` : ''}

data-editable formatını kullan. Her düzenlenebilir alana anlamlı key, type ve Türkçe label ver. Görseller için çalışan Unsplash URL'leri koy.`;

    // Call Gemini with longer timeout (template generation is heavier)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 8000,
      },
    });

    const result = await withTimeout(
      model.generateContent([
        { text: systemPrompt },
        { text: userPrompt },
      ]),
      30_000,
      "Gemini"
    );

    let html = result.response.text();
    if (!html) {
      return NextResponse.json({ error: "AI şablon üretemedi" }, { status: 500 });
    }

    // Clean up: remove markdown code blocks if AI wrapped it
    html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Basic validation
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
