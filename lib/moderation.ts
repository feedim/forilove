import type { NSFWJS } from 'nsfwjs';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// TEXT MODERATION — Claude Haiku (all languages, optimized)
// ============================================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODERATION_SYSTEM = `You are a content moderation classifier. Analyze the given text and respond with ONLY a JSON object, no other text.

Categories to check:
- profanity: slurs, vulgar language, offensive terms (ANY language)
- sexual: explicit sexual content, pornographic text
- hate: hate speech, discrimination, racism
- harassment: personal attacks, bullying, threats
- spam: gibberish, repetitive nonsense

Respond with:
{"action":"block","category":"...","reason":"..."} — if text contains clear profanity, explicit sexual content, hate speech, or serious harassment
{"action":"flag","category":"...","reason":"..."} — if text is borderline inappropriate, suggestive, or mildly offensive
{"action":"allow"} — if text is clean

Be strict with profanity in ALL languages (Turkish, English, German, French, Arabic, Russian, etc). Detect leet-speak bypasses (s1k, f*ck, sh1t). Short reason in Turkish.`;

export async function checkTextContent(
  title: string,
  htmlContent: string
): Promise<{ safe: boolean; severity: 'block' | 'flag' | null; reason: string | null }> {
  const plainText = `${title}\n${stripHtml(htmlContent)}`;
  // Skip very short content (under 3 chars)
  if (plainText.trim().length < 3) {
    return { safe: true, severity: null, reason: null };
  }

  // Truncate to 2000 chars to keep costs minimal
  const truncated = plainText.length > 2000 ? plainText.substring(0, 2000) : plainText;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: MODERATION_SYSTEM,
      messages: [{ role: 'user', content: truncated }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const json = JSON.parse(text);
    console.log('[MODERATION] Haiku result:', text);

    if (json.action === 'block') {
      return { safe: false, severity: 'block', reason: json.reason || null };
    }
    if (json.action === 'flag') {
      return { safe: false, severity: 'flag', reason: json.reason || null };
    }
    return { safe: true, severity: null, reason: null };
  } catch (err) {
    console.error('[MODERATION] Haiku API error:', err);
    // Fallback: allow on API failure (don't block users due to API issues)
    return { safe: true, severity: null, reason: null };
  }
}

// ============================================================
// IMAGE MODERATION — NSFW.js (TensorFlow.js)
// ============================================================

let nsfwModel: NSFWJS | null = null;

async function loadModel(): Promise<NSFWJS> {
  if (!nsfwModel) {
    console.log('[NSFW] Loading TensorFlow.js...');
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('[NSFW] TF backend ready:', tf.getBackend());
    const nsfwjs = await import('nsfwjs');
    console.log('[NSFW] Loading NSFW model...');
    nsfwModel = await nsfwjs.load();
    console.log('[NSFW] Model loaded successfully');
  }
  return nsfwModel;
}

type NsfwAction = 'allow' | 'flag' | 'block';

function evaluateScores(scores: Record<string, number>): NsfwAction {
  if ((scores['Porn'] || 0) > 0.6 || (scores['Hentai'] || 0) > 0.6) return 'block';
  if ((scores['Sexy'] || 0) > 0.8) return 'flag';
  return 'allow';
}

async function decodeBufferToTensor(buffer: Buffer, mimeType: string) {
  const tf = await import('@tensorflow/tfjs');
  try {
    let width: number, height: number;
    let pixels: Uint8Array;

    console.log('[NSFW] Decoding image, mimeType:', mimeType, 'buffer size:', buffer.length);

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType === 'jpeg' || mimeType === 'jpg') {
      const jpeg = await import('jpeg-js');
      const decoded = jpeg.decode(buffer, { useTArray: true });
      width = decoded.width;
      height = decoded.height;
      pixels = decoded.data as Uint8Array;
    } else if (mimeType === 'image/png' || mimeType === 'png') {
      const { PNG } = await import('pngjs');
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      pixels = new Uint8Array(png.data);
    } else {
      console.log('[NSFW] Unsupported mimeType, skipping:', mimeType);
      return null;
    }

    console.log('[NSFW] Decoded image:', width, 'x', height);

    const numPixels = width * height;
    const rgb = new Uint8Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      rgb[i * 3] = pixels[i * 4];
      rgb[i * 3 + 1] = pixels[i * 4 + 1];
      rgb[i * 3 + 2] = pixels[i * 4 + 2];
    }

    return tf.tensor3d(rgb, [height, width, 3], 'int32');
  } catch (err) {
    console.error('[NSFW] decodeBufferToTensor error:', err);
    return null;
  }
}

export async function checkImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ safe: boolean; action: NsfwAction; scores: Record<string, number> }> {
  try {
    const model = await loadModel();
    const tensor = await decodeBufferToTensor(buffer, mimeType);
    if (!tensor) {
      console.warn('[NSFW] Could not decode image to tensor');
      return { safe: true, action: 'allow', scores: {} };
    }

    try {
      const predictions = await model.classify(tensor);
      tensor.dispose();

      const scores: Record<string, number> = {};
      for (const p of predictions) {
        scores[p.className] = p.probability;
      }

      const action = evaluateScores(scores);
      console.log('[NSFW] Buffer check result:', JSON.stringify(scores), '→', action);
      return { safe: action === 'allow', action, scores };
    } catch (err) {
      console.error('[NSFW] classify error:', err);
      tensor.dispose();
      return { safe: true, action: 'allow', scores: {} };
    }
  } catch (err) {
    console.error('[NSFW] checkImageBuffer error:', err);
    return { safe: true, action: 'allow', scores: {} };
  }
}

// ============================================================
// HTML IMAGE EXTRACTION — base64 + URL images
// ============================================================

const MAX_IMAGES = 5;
const MAX_BASE64_LENGTH = 5 * 1024 * 1024;

interface ExtractedImage {
  type: 'base64' | 'url';
  data: string;
  mimeType: string;
}

function extractImagesFromHtml(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];

  const b64Regex = /src="data:image\/(jpeg|jpg|png);base64,([^"]+)"/g;
  let match;
  while ((match = b64Regex.exec(html)) !== null) {
    if (match[2].length > MAX_BASE64_LENGTH) continue;
    images.push({ type: 'base64', data: match[2], mimeType: match[1].toLowerCase() });
  }

  const urlRegex = /<img[^>]+src="(https?:\/\/[^"]+)"/g;
  while ((match = urlRegex.exec(html)) !== null) {
    images.push({ type: 'url', data: match[1], mimeType: '' });
  }

  return images.slice(0, MAX_IMAGES);
}

function getMimeFromUrl(url: string, contentType?: string): string {
  if (contentType) {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg';
    if (contentType.includes('png')) return 'image/png';
  }
  const lower = url.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  if (lower.includes('.png')) return 'image/png';
  return '';
}

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const mimeType = getMimeFromUrl(url, contentType);
    if (!mimeType) return null;
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > 10 * 1024 * 1024) return null;
    return { buffer: Buffer.from(arrayBuf), mimeType };
  } catch {
    return null;
  }
}

export async function checkImageContent(htmlContent: string): Promise<{
  safe: boolean;
  action: NsfwAction;
  flaggedCount: number;
}> {
  const images = extractImagesFromHtml(htmlContent);
  console.log('[NSFW] Found', images.length, 'images in HTML (types:', images.map(i => i.type).join(', '), ')');
  if (images.length === 0) {
    return { safe: true, action: 'allow', flaggedCount: 0 };
  }

  try {
    const model = await loadModel();
    let action: NsfwAction = 'allow';
    let flaggedCount = 0;

    for (const img of images) {
      let buffer: Buffer;
      let mimeType: string;

      if (img.type === 'base64') {
        buffer = Buffer.from(img.data, 'base64');
        mimeType = img.mimeType === 'jpg' ? 'image/jpeg' : `image/${img.mimeType}`;
      } else {
        const fetched = await fetchImageBuffer(img.data);
        if (!fetched) continue;
        buffer = fetched.buffer;
        mimeType = fetched.mimeType;
      }

      const tensor = await decodeBufferToTensor(buffer, mimeType);
      if (!tensor) continue;

      try {
        const predictions = await model.classify(tensor);
        tensor.dispose();

        const scores: Record<string, number> = {};
        for (const p of predictions) {
          scores[p.className] = p.probability;
        }

        const imgAction = evaluateScores(scores);
        console.log('[NSFW] Image scores:', JSON.stringify(scores), '→', imgAction);
        if (imgAction === 'block') {
          action = 'block';
          flaggedCount++;
        } else if (imgAction === 'flag') {
          if (action !== 'block') action = 'flag';
          flaggedCount++;
        }
      } catch (err) {
        console.error('[NSFW] classify error in checkImageContent:', err);
        tensor.dispose();
      }
    }

    return { safe: action === 'allow', action, flaggedCount };
  } catch (err) {
    console.error('[NSFW] checkImageContent error:', err);
    return { safe: true, action: 'allow', flaggedCount: 0 };
  }
}

// ============================================================
// COMBINED MODERATION
// ============================================================

/**
 * Decision matrix:
 *  | Text   | Image      | Result                                |
 *  | block  | *          | block  — 400 error, not published     |
 *  | flag   | *          | moderation — sent to moderation queue |
 *  | safe   | block/flag | moderation — sent to moderation queue |
 *  | safe   | safe       | allow  — published normally           |
 */
export async function moderateContent(
  title: string,
  htmlContent: string
): Promise<{ action: 'allow' | 'moderation' | 'block'; reason: string | null }> {
  console.log('[MODERATION] Running moderation on post, title:', title.substring(0, 50));

  // 1. Text check via Claude Haiku (all languages, ~200ms)
  const textResult = await checkTextContent(title, htmlContent);
  console.log('[MODERATION] Text result:', textResult.severity, textResult.reason || 'clean');

  if (textResult.severity === 'block') {
    return {
      action: 'block',
      reason: textResult.reason || 'İçerik politikamıza aykırı içerik tespit edildi. Lütfen içeriğinizi düzenleyin.',
    };
  }

  // 2. Image check via NSFW.js (TensorFlow)
  const imageResult = await checkImageContent(htmlContent);
  console.log('[MODERATION] Image result:', imageResult.action, 'flagged:', imageResult.flaggedCount);

  if (textResult.severity === 'flag' || imageResult.action !== 'allow') {
    return {
      action: 'moderation',
      reason: textResult.reason || 'Gönderiniz incelemeye alındı. Moderatörler onayladıktan sonra yayınlanacak.',
    };
  }

  return { action: 'allow', reason: null };
}
