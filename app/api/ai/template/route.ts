// ════════════════════════════════════════════════════════════
// ♥ Forilove — 3-Step Agent Template System
// ♥ Step 1: DREAM → Step 2: BUILD → Step 3: REVIEW
// ♥ Language-agnostic, token-optimized, color-safe
// ════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  assembleTemplate,
  validateConcept,
  validateImplementation,
  validateReview,
  mergeToResponse,
  FALLBACK_RESPONSE,
  type AITemplateResponse,
  type DesignConcept,
} from "@/lib/constants/template-sections";

// ♥ Rate Limiter
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

// ════════════════════════════════════════════════════════════
// ♥ STEP 1 — DREAM: Design concept
// ════════════════════════════════════════════════════════════

const STEP1_PROMPT = `You are a Da Vinci of web design — a master artist with a palette and brush. You love simplicity, elegance, and emotional resonance. Every design you create is a unique masterpiece. You know all Google Fonts, all color theory, all design techniques.

Create a UNIQUE design concept for a love/memory page. Return ONLY JSON.

YOUR PALETTE (choose ANY Google Fonts, ANY harmonious colors):
- Pick fonts that MATCH the mood (elegant serif for romantic, clean sans for modern, handwritten for playful)
- Format: "FontName:wght@400;700" (Google Fonts)
- Create a HARMONIOUS color palette — colors that sing together
- LIGHT THEME: text MUST be dark, textLight medium gray, isDarkTheme=false
- DARK THEME: text MUST be light rgba, textLight dimmed rgba, isDarkTheme=true
- primary: the soul color — vibrant, emotional
- primaryLight: whisper of primary (very pale or very dark depending on theme)
- dark: the anchor (deepest tone, footer bg)
- accent: a complementary surprise, NEVER same as primary

SECTIONS (pick 5-8, hero+footer required):
hero, date, gallery, love_letter, timeline, countdown, quotes, full_image, footer

coverPhotoMood: romantic, cinematic, nature, urban, minimal, nostalgic, moody, luxury

JSON:
{"mood":"","architecture":"","colorPalette":{"primary":"","primaryLight":"","dark":"","text":"","textLight":"","accent":""},"fonts":["",""],"sections":[],"animationLevel":"sade|orta|premium","bodyBackground":"","coverPhotoMood":"","isDarkTheme":false}`;

// ════════════════════════════════════════════════════════════
// ♥ STEP 2 — BUILD: CSS + texts
// ════════════════════════════════════════════════════════════

function buildStep2Prompt(concept: DesignConcept, userInput: string): string {
  const dark = concept.isDarkTheme;
  return `You are a Da Vinci of CSS — a master artist who paints with code. You love simplicity and elegance. Every detail matters. This is a PAID premium product.
Write texts in THE SAME LANGUAGE as the user's input. If user writes Turkish, write Turkish. If English, write English.
Return ONLY JSON.

CONCEPT: ${concept.mood} / ${concept.architecture}
COLORS: primary=${concept.colorPalette.primary} primaryLight=${concept.colorPalette.primaryLight} dark=${concept.colorPalette.dark} text=${concept.colorPalette.text} accent=${concept.colorPalette.accent}
BODY: ${concept.bodyBackground} | ${dark ? "DARK THEME" : "LIGHT THEME"}
SECTIONS: ${concept.sections.join(",")}
ANIMATION: ${concept.animationLevel}

ARCHITECTURE: The base template has perfect responsive layout (centered sections, 2-col gallery, consistent spacing). You ONLY add visual personality — like painting on a canvas.

FORBIDDEN — NEVER WRITE:
- display, grid-template-columns, flex-direction, flex-wrap
- max-width, min-width, width, height, min-height (on sections)
- margin, padding (on section containers)
- position, top, left, right, bottom, inset, float
- align-items, justify-content, gap, overflow, text-align
- background on .fl-hero or .fl-hero-bg (user's photo!)
- dark hero text (ALWAYS white/light over photo)
- !important

YOUR BRUSH (visual properties you SHOULD use creatively):
color, background, background-color, background-image, linear-gradient, border, border-color, border-radius, box-shadow, text-shadow, filter, opacity, backdrop-filter, font-size, font-weight, font-style, letter-spacing, line-height, text-transform, animation, transition, transform

PAINT THESE (required):
1. .fl-hero-overlay{background:linear-gradient(...)} — creative gradient
2. .fl-divider{display:block;width:...;height:1px;background:...;margin:0 auto 32px}
3. .fl-gallery-img — border-radius, shadow, hover effect
4. .fl-hero-scroll{display:block} .fl-quote-deco{display:block} .fl-letter-deco{display:block} .fl-hero-deco{display:block}
${dark ? "5. body{color:rgba(255,255,255,0.85)} section text: rgba(255,255,255,0.4-0.85) borders: rgba(255,255,255,0.06-0.1)" : ""}

CLASSES:
.fl-hero-overlay .fl-hero-deco .fl-hero-subtitle .fl-hero-title .fl-hero-date .fl-hero-scroll
.fl-gallery-img .fl-gallery-subtitle .fl-quote .fl-quote-deco .fl-quote-text .fl-quote-author
.fl-letter .fl-letter-deco .fl-letter-text .fl-timeline .fl-timeline-track::before .fl-timeline-dot .fl-timeline-title .fl-timeline-desc
.fl-fullimg-photo .fl-fullimg-text .fl-fullimg-overlay .fl-countdown-date .fl-countdown-text
.fl-date .fl-date-label .fl-date-value .fl-footer .fl-footer-message .fl-footer-names .fl-label .fl-divider body

ANIMATIONS: flFadeInUp flFadeIn flScaleIn flBounce flPulse flGlow flFloat flShimmer flZoomSlow flTextReveal flDotPulse

USER INPUT: ${userInput}

JSON:
{"customCSS":"min 800 chars of VISUAL overrides only","defaultTexts":{"title":"","subtitle":"","special_date":"","gallery_subtitle":"","letter":"3+ paragraphs with \\n","quote_text":"","quote_author":"","milestone_1_title":"","milestone_1_text":"","milestone_2_title":"","milestone_2_text":"","full_image_text":"","countdown_date":"2025-02-14","countdown_label":"","footer_text":"","footer_names":""}}`;
}

// ════════════════════════════════════════════════════════════
// ♥ STEP 3 — REVIEW: Check & fix
// ════════════════════════════════════════════════════════════

function buildStep3Prompt(concept: DesignConcept, css: string): string {
  return `Review this CSS for a ${concept.isDarkTheme ? "DARK" : "LIGHT"} theme love page. Fix issues. Return ONLY JSON.

BODY: ${concept.bodyBackground}
PRIMARY: ${concept.colorPalette.primary}
TEXT: ${concept.colorPalette.text}

CSS TO REVIEW:
${css.slice(0, 3000)}

CHECK:
1. Does .fl-hero or .fl-hero-bg have a background color/image set? REMOVE IT (user's photo)
2. Is hero text (.fl-hero-title etc) dark colored? Make it white
3. ${concept.isDarkTheme ? "Are section texts dark? Make them rgba(255,255,255,0.4-0.85)" : "Are section texts white/invisible on white bg? Make them dark"}
4. Is .fl-divider set to display:block? If not, add it
5. Does .fl-hero-overlay have a gradient? If not, add one
6. Is footer text visible against footer background?
7. REMOVE any structural properties: display, grid-template-columns, max-width, margin, padding, width, height, position, float, align-items, justify-content, gap, overflow, text-align on section elements. Keep ONLY visual properties (color, background, border, shadow, filter, font, animation, transform, opacity)
8. REMOVE any !important declarations

{"issues":["issue1"],"fixedCSS":"complete fixed CSS if issues found, empty string if OK"}`;
}

// ♥ JSON Parser
function parseJSON(raw: string): unknown | null {
  let s = raw.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  try { return JSON.parse(s); } catch { return null; }
}

// ════════════════════════════════════════════════════════════
// ♥ Main Handler
// ════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("user_id", user.id).single();
    if (!profile || (profile.role !== "creator" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: "Çok fazla istek. 1 dakika bekleyin." }, { status: 429 });
    }

    const body = await req.json();
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 300) : "";
    const details = typeof body.details === "string" ? body.details.trim().slice(0, 200) : "";

    if (!topic) {
      return NextResponse.json({ error: "Konu gerekli" }, { status: 400 });
    }

    const userInput = details ? `${topic}\n${details}` : topic;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // ♥ STEP 1: DREAM
    console.log("♥ Step 1: Dreaming...");
    const step1 = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 1,
      system: STEP1_PROMPT,
      messages: [{ role: "user", content: userInput }],
    });

    const concept = validateConcept(parseJSON(step1.content.find(b => b.type === "text")?.text || ""));
    if (!concept) {
      console.error("♥ Step 1 failed");
      return NextResponse.json({ html: assembleTemplate({
        ...FALLBACK_RESPONSE,
        defaultTexts: { ...FALLBACK_RESPONSE.defaultTexts, title: topic.slice(0, 100) },
      }) });
    }
    console.log("♥ Step 1 OK:", concept.mood, concept.isDarkTheme ? "DARK" : "LIGHT");

    // ♥ STEP 2: BUILD
    console.log("♥ Step 2: Building...");
    const step2 = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      temperature: 0.7,
      system: buildStep2Prompt(concept, userInput),
      messages: [{ role: "user", content: topic }],
    });

    const impl = validateImplementation(parseJSON(step2.content.find(b => b.type === "text")?.text || ""));
    if (!impl) {
      console.error("♥ Step 2 failed");
      return NextResponse.json({ html: assembleTemplate({
        ...FALLBACK_RESPONSE,
        defaultTexts: { ...FALLBACK_RESPONSE.defaultTexts, title: topic.slice(0, 100) },
      }) });
    }
    console.log("♥ Step 2 OK:", impl.customCSS.length, "chars");

    // ♥ STEP 3: REVIEW
    console.log("♥ Step 3: Reviewing...");
    let finalCSS = impl.customCSS;
    try {
      const step3 = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        temperature: 0,
        system: buildStep3Prompt(concept, impl.customCSS),
        messages: [{ role: "user", content: "Review and fix." }],
      });
      const review = validateReview(parseJSON(step3.content.find(b => b.type === "text")?.text || ""));
      if (review?.fixedCSS && review.fixedCSS.length > 50) {
        console.log("♥ Step 3: Fixed issues:", review.issues?.join(", "));
        finalCSS = review.fixedCSS;
      } else {
        console.log("♥ Step 3: Clean");
      }
    } catch (e) {
      console.warn("♥ Step 3 skipped:", e);
    }

    // ♥ ASSEMBLE
    const response = mergeToResponse(concept, { customCSS: finalCSS, defaultTexts: impl.defaultTexts });
    return NextResponse.json({ html: assembleTemplate(response) });

  } catch (error: any) {
    console.error("AI error:", error);
    if (error?.status === 429) {
      return NextResponse.json({ error: "AI meşgul. Birkaç saniye bekleyin." }, { status: 429 });
    }
    return NextResponse.json({ error: error.message || "Şablon hatası" }, { status: 500 });
  }
}
