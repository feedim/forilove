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

const STEP1_PROMPT = `You are a world-class web design director. Create a UNIQUE design concept for a love/memory page. Return ONLY JSON.

CRITICAL COLOR RULES:
- LIGHT THEME (white/cream body): text MUST be dark (#1a1a1a-#3a3a3a), textLight medium gray (#6b7280-#9ca3af), isDarkTheme=false
- DARK THEME (black/dark body): text MUST be "rgba(255,255,255,0.85)", textLight "rgba(255,255,255,0.4)", isDarkTheme=true
- primary: vibrant accent color
- primaryLight: very pale version of primary (light theme) or very dark tone (dark theme)
- dark: darkest tone (footer bg)
- accent: complementary to primary, NEVER same as primary

FONTS (Google Fonts, format "Name:wght@400;700"):
Heading: Cormorant Garamond, Playfair Display, Bodoni Moda, Lora, Cinzel, Dancing Script, EB Garamond, Marcellus, Italiana, Spectral, Libre Baskerville, Crimson Text, Montserrat
Body: Inter, Poppins, Lato, Nunito, Raleway

SECTIONS (pick 5-8, hero+footer required):
hero, date, gallery, love_letter, timeline, countdown, quotes, full_image, video, footer

coverPhotoMood: romantic, cinematic, nature, urban, minimal, nostalgic, moody, luxury

JSON:
{"mood":"","architecture":"","colorPalette":{"primary":"","primaryLight":"","dark":"","text":"","textLight":"","accent":""},"fonts":["",""],"sections":[],"animationLevel":"sade|orta|premium","bodyBackground":"","coverPhotoMood":"","isDarkTheme":false}`;

// ════════════════════════════════════════════════════════════
// ♥ STEP 2 — BUILD: CSS + texts
// ════════════════════════════════════════════════════════════

function buildStep2Prompt(concept: DesignConcept, userInput: string): string {
  const dark = concept.isDarkTheme;
  return `You are a CSS master. Write customCSS overrides + default texts for a love page. Return ONLY JSON.
Write texts in THE SAME LANGUAGE as the user's input. If user writes Turkish, write Turkish. If English, write English.

CONCEPT: ${concept.mood} / ${concept.architecture}
COLORS: primary=${concept.colorPalette.primary} dark=${concept.colorPalette.dark} text=${concept.colorPalette.text}
BODY: ${concept.bodyBackground} | ${dark ? "DARK THEME" : "LIGHT THEME"}
SECTIONS: ${concept.sections.join(",")}
ANIMATION: ${concept.animationLevel}

FORBIDDEN (NEVER DO THIS):
- NEVER set background on .fl-hero or .fl-hero-bg (it's a user photo!)
- NEVER make hero text dark (it's ALWAYS over a photo, must be white/light)
- NEVER write animation:none
- NEVER use same color for text and background

REQUIRED OVERRIDES:
1. .fl-hero-overlay{background:linear-gradient(...)} — darken the photo
2. .fl-divider{display:block;width:...;height:1px;background:...;margin:0 auto 32px}
3. .fl-gallery-img — hover effect, border-radius, shadow
4. .fl-footer{background:${dark ? concept.colorPalette.dark : "var(--dark)"}}.fl-footer-message{color:${dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.6)"}}.fl-footer-names{color:${dark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.3)"}}
${dark ? "5. body{color:rgba(255,255,255,0.85)}\n6. All section text colors: rgba(255,255,255,0.4-0.85)\n7. Borders: rgba(255,255,255,0.06-0.1)" : ""}

AVAILABLE CSS CLASSES:
.fl-hero-overlay .fl-hero-deco .fl-hero-subtitle .fl-hero-title .fl-hero-date .fl-hero-scroll
.fl-gallery .fl-gallery-grid .fl-gallery-img .fl-gallery-subtitle
.fl-quote .fl-quote-deco .fl-quote-text .fl-quote-author
.fl-letter .fl-letter-deco .fl-letter-text
.fl-timeline .fl-timeline-track::before .fl-timeline-dot .fl-timeline-title .fl-timeline-desc
.fl-fullimg-photo .fl-fullimg-text
.fl-countdown-date .fl-countdown-text
.fl-date .fl-date-label .fl-date-value
.fl-footer .fl-footer-message .fl-footer-names
.fl-label .fl-divider body

HIDDEN ELEMENTS (open with display:block):
.fl-hero-deco .fl-letter-deco .fl-quote-deco .fl-divider .fl-hero-scroll

ANIMATIONS: flFadeInUp flFadeIn flScaleIn flBounce flPulse flGlow flFloat flShimmer flZoomSlow flTextReveal flDotPulse

USER INPUT: ${userInput}

JSON:
{"customCSS":"min 800 chars","defaultTexts":{"title":"","subtitle":"","special_date":"","gallery_subtitle":"","letter":"3+ paragraphs with \\n","quote_text":"","quote_author":"","milestone_1_title":"","milestone_1_text":"","milestone_2_title":"","milestone_2_text":"","full_image_text":"","countdown_date":"2025-02-14","countdown_label":"","footer_text":"","footer_names":"","video_caption":""}}`;
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
