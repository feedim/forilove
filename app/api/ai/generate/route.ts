import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

interface HookInput {
  key: string;
  type: string;
  label: string;
  defaultValue: string;
}

// ─── Curated Unsplash Photos ───────────────────────────────────────────────
// Static Unsplash URLs keyed by theme keyword. No API key needed.
const UNSPLASH_PHOTOS: Record<string, string[]> = {
  couple: [
    "https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&q=80",
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80",
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80",
    "https://images.unsplash.com/photo-1507894009593-5d27ef5a7522?w=800&q=80",
  ],
  wedding: [
    "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80",
    "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80",
    "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&q=80",
  ],
  sunset: [
    "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80",
    "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
    "https://images.unsplash.com/photo-1472120435266-95c21eebd5de?w=800&q=80",
  ],
  flowers: [
    "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80",
    "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=800&q=80",
    "https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=800&q=80",
    "https://images.unsplash.com/photo-1508610048659-a06b669e3321?w=800&q=80",
  ],
  nature: [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
  ],
  heart: [
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80",
    "https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=800&q=80",
  ],
  birthday: [
    "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=800&q=80",
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80",
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80",
  ],
  travel: [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  ],
  night: [
    "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
    "https://images.unsplash.com/photo-1475274047050-1d0c55b91f6f?w=800&q=80",
    "https://images.unsplash.com/photo-1532978379173-523e16f371f2?w=800&q=80",
  ],
  cafe: [
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80",
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80",
  ],
};

function getUnsplashUrl(keyword: string): string {
  const kw = keyword.toLowerCase().trim();
  // Direct match
  if (UNSPLASH_PHOTOS[kw]) {
    const photos = UNSPLASH_PHOTOS[kw];
    return photos[Math.floor(Math.random() * photos.length)];
  }
  // Partial match
  for (const [cat, photos] of Object.entries(UNSPLASH_PHOTOS)) {
    if (kw.includes(cat) || cat.includes(kw)) {
      return photos[Math.floor(Math.random() * photos.length)];
    }
  }
  // Fallback to couple photos
  const fallback = UNSPLASH_PHOTOS.couple;
  return fallback[Math.floor(Math.random() * fallback.length)];
}

// ─── Template Context Extraction ───────────────────────────────────────────
function extractTemplateContext(html: string, templateName: string): string {
  const parts: string[] = [];

  if (templateName) {
    parts.push(`Şablon adı: ${templateName}`);
  }

  // Extract headings
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings: string[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null && headings.length < 5) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text && !text.startsWith('{{')) headings.push(text);
  }
  if (headings.length > 0) {
    parts.push(`Başlıklar: ${headings.join(', ')}`);
  }

  // Extract editable fields info
  const editableRegex = /data-editable="([^"]+)"[^>]*data-type="([^"]+)"[^>]*data-label="([^"]+)"/gi;
  const fields: string[] = [];
  while ((match = editableRegex.exec(html)) !== null && fields.length < 20) {
    fields.push(`${match[3]} (${match[2]})`);
  }
  if (fields.length > 0) {
    parts.push(`Düzenlenebilir alanlar: ${fields.join(', ')}`);
  }

  // Detect theme hints from template name and HTML
  const combined = (templateName + ' ' + html).toLowerCase();
  const themes: string[] = [];
  const themeKeywords: Record<string, string[]> = {
    'düğün': ['düğün', 'wedding', 'nikah', 'gelin'],
    'yıldönümü': ['yıldönümü', 'anniversary', 'yildonumu'],
    'doğum günü': ['doğum günü', 'birthday', 'dogum gunu'],
    'sevgililer günü': ['sevgililer', 'valentine'],
    'aşk mektubu': ['mektup', 'letter'],
    'anı defteri': ['anı', 'memory', 'hatıra', 'memories'],
    'zaman çizelgesi': ['timeline', 'zaman çizelgesi'],
  };
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some(kw => combined.includes(kw))) {
      themes.push(theme);
    }
  }
  if (themes.length > 0) {
    parts.push(`Tespit edilen tema: ${themes.join(', ')}`);
  }

  const result = parts.join('\n');
  return result.slice(0, 2000);
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Sanitize Hooks ────────────────────────────────────────────────────────
function sanitizeHooks(hooks: any[]): HookInput[] {
  const allowedTypes = new Set(["text", "textarea", "color", "date", "url", "image", "background-image"]);
  return hooks
    .filter((h) => h && typeof h.key === "string" && h.key.length <= 64 && allowedTypes.has(h.type))
    .map((h) => ({
      key: h.key.slice(0, 64),
      type: h.type,
      label: (typeof h.label === "string" ? h.label : h.key).slice(0, 100),
      defaultValue: (typeof h.defaultValue === "string" ? h.defaultValue : "").slice(0, 500),
    }));
}

// ─── Post-process: Replace [IMG:keyword] with Unsplash URLs ────────────────
function resolveImagePlaceholders(values: Record<string, string>, hooks: HookInput[]): Record<string, string> {
  const imageTypes = new Set(["image", "background-image"]);
  const result = { ...values };

  for (const hook of hooks) {
    if (!imageTypes.has(hook.type)) continue;
    const val = result[hook.key];
    if (!val) continue;

    const imgMatch = val.match(/\[IMG:([^\]]+)\]/);
    if (imgMatch) {
      result[hook.key] = getUnsplashUrl(imgMatch[1]);
    } else if (!val.startsWith('http') && !val.startsWith('data:')) {
      // AI returned a keyword directly instead of [IMG:keyword] format
      result[hook.key] = getUnsplashUrl(val);
    }
  }

  return result;
}

// ─── Main Handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Çok fazla istek. Lütfen 1 dakika bekleyin." },
        { status: 429 }
      );
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 200_000) {
      return NextResponse.json({ error: "İstek çok büyük" }, { status: 413 });
    }

    const body = await req.json();
    const { prompt, hooks: rawHooks, htmlContent, templateName } = body as {
      prompt: string;
      hooks: any[];
      htmlContent?: string;
      templateName?: string;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 500) {
      return NextResponse.json(
        { error: "Prompt geçersiz veya çok uzun (max 500 karakter)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(rawHooks) || rawHooks.length === 0 || rawHooks.length > 50) {
      return NextResponse.json(
        { error: "Hook listesi geçersiz (1-50 arası)" },
        { status: 400 }
      );
    }
    const hooks = sanitizeHooks(rawHooks);
    if (hooks.length === 0) {
      return NextResponse.json({ error: "Geçerli hook bulunamadı" }, { status: 400 });
    }

    // Template context
    const templateContext = extractTemplateContext(
      typeof htmlContent === "string" ? htmlContent : "",
      typeof templateName === "string" ? templateName : ""
    );

    // Today's date
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

    // Separate text and image hooks
    const imageTypes = new Set(["image", "background-image"]);
    const textHooks = hooks.filter(h => !imageTypes.has(h.type));
    const imageHooks = hooks.filter(h => imageTypes.has(h.type));

    // Build field descriptions
    const fieldLines = hooks.map((h) => {
      if (imageTypes.has(h.type)) {
        return `"${h.key}": GÖRSEL ALANI — [IMG:anahtar_kelime] formatında döndür. Anahtar kelime İngilizce olmalı (couple, sunset, flowers, wedding, nature, heart, birthday, travel, night, cafe). (label: "${h.label}")`;
      }
      const defaultLen = h.defaultValue ? h.defaultValue.length : 0;
      const lenHint = defaultLen > 0 ? ` (~${defaultLen} karakter)` : '';
      const exampleHint = h.defaultValue && h.defaultValue.length > 0 && h.defaultValue.length <= 80
        ? ` Örnek format: "${h.defaultValue}"`
        : '';
      const typeHint = h.type === 'text' ? `kısa metin${lenHint}${exampleHint}`
        : h.type === 'textarea' ? `paragraf metin${lenHint}${exampleHint}`
        : h.type === 'date' ? `tarih, format: GG.AA.YYYY`
        : h.type === 'color' ? 'hex renk kodu (#FF6B9D gibi)'
        : h.type === 'url' ? 'boş string döndür ""'
        : h.type;
      return `"${h.key}": ${typeHint} (label: "${h.label}")`;
    });

    const requiredKeys = hooks.map(h => `"${h.key}"`).join(', ');

    const systemPrompt = `Sen Forilove platformu için içerik asistanısın. Kullanıcılar sevdikleri kişiler için dijital anı sayfaları oluşturuyor. Senin görevin bu sayfaların içeriklerini doldurmak.

ŞABLON BİLGİSİ:
${templateContext}

Bugün: ${todayStr}

GÖREV: Kullanıcının açıklamasına göre aşağıdaki TÜM alanları (${hooks.length} adet) doldur. Hiçbir alan atlanmamalı.

ALANLAR:
${fieldLines.join('\n')}

YAZIM KURALLARI:
- Her alanın label'ına ve default değer uzunluğuna dikkat et. "Başlık" label'ı = çok kısa (3-5 kelime). "Açıklama" = 1-2 cümle. "Mesaj/Mektup" = 2-4 cümle.
- text tipi: Kısa ve öz. Başlıklar max 5 kelime. Asla uzun cümle olmamalı.
- textarea tipi: Samimi, içten bir dilde yaz. Kullanıcının verdiği isimleri ve detayları kullan. Default değer uzunluğuna yakın tut.
- date: GG.AA.YYYY formatında. Kullanıcı tarih verdiyse onu kullan, yoksa ${todayStr}.
- color: HEX renk kodu. Şablon temasına uygun seç.
- url: Her zaman "" (boş string) döndür.
- image/background-image: [IMG:anahtar_kelime] formatında döndür. Anahtar kelimeler: couple, sunset, flowers, wedding, nature, heart, birthday, travel, night, cafe.

YASAKLAR:
- Klişe romantik kalıplar KULLANMA: "kalbimin derinliklerinde", "sonsuz aşk", "yıldızlar kadar", "gökyüzündeki yıldızlar", "kalpten kalbe" gibi ifadeler YASAK.
- Gerçekçi ve samimi yaz. Günlük konuşma dilinde, doğal Türkçe kullan.
- Emoji KULLANMA.
- Kullanıcının verdiği bilgileri (isim, tarih, yer, anı) doğrudan içeriğe yansıt. Genel/jenerik ifadeler yerine kişiye özel detaylar kullan.
- "X yıllık" ifadesi varsa tarihi bugünden geriye hesapla.

JSON formatında SADECE bu key'leri içeren obje döndür: ${requiredKeys}
Başka hiçbir metin veya açıklama ekleme. Sadece geçerli JSON.`;

    const userMessage = `${prompt.slice(0, 500)}

Tüm ${hooks.length} alanı doldur: ${requiredKeys}`;

    // Call Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    let aiText = "";
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        const block = response.content[0];
        if (block.type === "text") {
          aiText = block.text;
          break;
        }
        throw new Error("AI yanıt üretemedi");
      } catch (error: any) {
        const status = error?.status;
        if ((status === 429 || status === 529) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, Math.min(2000 * Math.pow(2, attempt), 15000)));
          continue;
        }
        throw error;
      }
    }

    if (!aiText) {
      return NextResponse.json({ error: "AI yanıt üretemedi" }, { status: 500 });
    }

    // Parse JSON from AI response
    let aiValues: Record<string, string>;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      aiValues = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("AI JSON parse error. Raw response:", aiText.slice(0, 1000));
      return NextResponse.json({ error: "AI yanıtı parse edilemedi" }, { status: 500 });
    }

    // Build final values: ensure ALL hook keys are present
    const validKeys = new Set(hooks.map((h) => h.key));
    const filteredValues: Record<string, string> = {};

    for (const hook of hooks) {
      const aiVal = aiValues[hook.key];
      if (typeof aiVal === "string" && aiVal.trim().length > 0) {
        filteredValues[hook.key] = aiVal.slice(0, 2000);
      } else {
        filteredValues[hook.key] = hook.defaultValue;
      }
    }

    // Post-process: resolve [IMG:keyword] → Unsplash URLs
    const finalValues = resolveImagePlaceholders(filteredValues, hooks);

    // Log coverage
    const aiFilledCount = Object.keys(aiValues).filter(k => validKeys.has(k)).length;
    const imageFilledCount = imageHooks.filter(h => finalValues[h.key] && finalValues[h.key].startsWith('http')).length;
    console.log(`AI generate: ${aiFilledCount}/${hooks.length} fields filled (${imageFilledCount} images resolved)`);

    return NextResponse.json({ values: finalValues });
  } catch (error: any) {
    console.error("AI generate error:", error);
    const message = error.message || "AI oluşturma hatası";
    const status = message.includes("zaman aşımı") ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
