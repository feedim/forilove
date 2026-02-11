import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface HookInput {
  key: string;
  type: string;
  label: string;
  defaultValue: string;
}

// Rate limit: per-user, max 5 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

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

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms / 1000}s)`)), ms)
    ),
  ]);
}

// Sanitize: strip hook inputs to only allowed fields, enforce max lengths
function sanitizeHooks(hooks: any[]): HookInput[] {
  const allowedTypes = new Set(["text", "textarea", "color", "date", "url", "video", "image", "background-image"]);
  return hooks
    .filter((h) => h && typeof h.key === "string" && h.key.length <= 64 && allowedTypes.has(h.type))
    .map((h) => ({
      key: h.key.slice(0, 64),
      type: h.type,
      label: (typeof h.label === "string" ? h.label : h.key).slice(0, 100),
      defaultValue: (typeof h.defaultValue === "string" ? h.defaultValue : "").slice(0, 500),
    }));
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Çok fazla istek. Lütfen 1 dakika bekleyin." },
        { status: 429 }
      );
    }

    // Request body size guard (max ~50KB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 50_000) {
      return NextResponse.json({ error: "İstek çok büyük" }, { status: 413 });
    }

    const body = await req.json();
    const { prompt, hooks: rawHooks } = body as { prompt: string; hooks: any[] };

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 500) {
      return NextResponse.json(
        { error: "Prompt geçersiz veya çok uzun (max 500 karakter)" },
        { status: 400 }
      );
    }

    // Sanitize and validate hooks
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

    // Separate image hooks
    const imageHooks = hooks.filter((h) => h.type === "image" || h.type === "background-image");

    // Build compact hook descriptions (token-optimized: short format)
    const hookLines = hooks.map((h) => {
      const instr: Record<string, string> = {
        text: "metin max100",
        textarea: "paragraf max500",
        color: "HEX romantik",
        date: "GG.AA.YYYY",
        url: '""',
        video: '""',
        image: "EN arama 2-4 kelime",
        "background-image": "EN arama 2-4 kelime",
      };
      return `"${h.key}"(${h.type}): ${instr[h.type] || "metin max100"}`;
    });

    const systemPrompt = `Romantik sayfa tasarımcısısın. JSON döndür: {"key":"değer",...}
Kurallar: Türkçe duygusal içerik. text:max100. textarea:max500. color:HEX. date:GG.AA.YYYY. url/video:"". image/background-image:İngilizce Unsplash arama kelimesi.
Alanlar:
${hookLines.join("\n")}`;

    // Call Gemini with timeout (15s)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8,
        maxOutputTokens: 1500,
      },
    });

    const result = await withTimeout(
      model.generateContent([
        { text: systemPrompt },
        { text: prompt.slice(0, 500) },
      ]),
      15_000,
      "Gemini"
    );

    const aiText = result.response.text();
    if (!aiText) {
      return NextResponse.json({ error: "AI yanıt üretemedi" }, { status: 500 });
    }

    let aiValues: Record<string, string>;
    try {
      aiValues = JSON.parse(aiText);
    } catch {
      return NextResponse.json({ error: "AI yanıtı parse edilemedi" }, { status: 500 });
    }

    // Fetch Unsplash images with timeout (8s per request, 10s total)
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey && unsplashKey !== "..." && imageHooks.length > 0) {
      const imageResults = await withTimeout(
        Promise.all(
          imageHooks.map(async (hook) => {
            const searchQuery = aiValues[hook.key];
            if (!searchQuery || typeof searchQuery !== "string") {
              return { key: hook.key, url: hook.defaultValue };
            }
            try {
              const res = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery.slice(0, 100))}&per_page=1&orientation=landscape`,
                {
                  headers: { Authorization: `Client-ID ${unsplashKey}` },
                  signal: AbortSignal.timeout(8_000),
                }
              );
              if (!res.ok) return { key: hook.key, url: hook.defaultValue };
              const data = await res.json();
              return {
                key: hook.key,
                url: data.results?.[0]?.urls?.regular || hook.defaultValue,
              };
            } catch {
              return { key: hook.key, url: hook.defaultValue };
            }
          })
        ),
        10_000,
        "Unsplash"
      ).catch(() => imageHooks.map((h) => ({ key: h.key, url: h.defaultValue })));

      for (const img of imageResults) {
        aiValues[img.key] = img.url;
      }
    }

    // Filter: only valid hook keys, string values, enforce max length
    const validKeys = new Set(hooks.map((h) => h.key));
    const filteredValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(aiValues)) {
      if (validKeys.has(key) && typeof value === "string") {
        filteredValues[key] = value.slice(0, 2000);
      }
    }

    return NextResponse.json({ values: filteredValues });
  } catch (error: any) {
    console.error("AI generate error:", error);
    const message = error.message || "AI oluşturma hatası";
    const status = message.includes("zaman aşımı") ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
