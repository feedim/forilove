import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

const COUPON_VALIDITY_MINUTES = 20;

// Basit IP-based rate limit: IP + promo kombinasyonu → son üretilen kupon
const recentGenerations = new Map<string, { code: string; expiresAt: string; createdAt: number }>();

// Her 5 dk'da temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of recentGenerations) {
    if (now - val.createdAt > COUPON_VALIDITY_MINUTES * 60 * 1000) {
      recentGenerations.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const { promoCode } = await request.json();

    if (!promoCode || !/^[a-zA-ZİŞĞÜÖÇışğüöç0-9]{3,20}$/.test(promoCode)) {
      return NextResponse.json({ valid: false, error: "Geçersiz promo link" });
    }

    const normalizedPromo = promoCode.toUpperCase();

    // IP al
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
    const cacheKey = `${ip}_${normalizedPromo}`;

    // Aynı IP + promo için son 20 dk'da kod üretilmiş mi?
    const cached = recentGenerations.get(cacheKey);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return NextResponse.json({
        valid: true,
        coupon_code: cached.code,
        discount_percent: null, // client zaten biliyor
        expires_at: cached.expiresAt,
      });
    }

    const admin = createAdminClient();

    // 1. Promo link doğrula
    const { data: promo, error: promoError } = await admin
      .from("promo_links")
      .select("id, discount_percent, max_signups, current_signups, expires_at, is_active")
      .ilike("code", normalizedPromo)
      .eq("is_active", true)
      .single();

    if (promoError || !promo) {
      return NextResponse.json({ valid: false, error: "Promo link bulunamadı" });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "Promo link süresi dolmuş" });
    }

    if (promo.max_signups && promo.current_signups >= promo.max_signups) {
      return NextResponse.json({ valid: false, error: "Promo link limiti dolmuş" });
    }

    if (!promo.discount_percent || promo.discount_percent <= 0) {
      return NextResponse.json({ valid: false, error: "Bu promo linkte indirim yok" });
    }

    // 2. DB'de bu promo'dan üretilmiş, süresi dolmamış, kullanılmamış kod var mı?
    const { data: existingCoupon } = await admin
      .from("coupons")
      .select("id, code, discount_percent, expires_at, current_uses, max_uses")
      .eq("coupon_type", "promo_generated")
      .gt("expires_at", new Date().toISOString())
      .eq("current_uses", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // IP cache'de yoksa ama DB'de varsa — yine de yeni üret (farklı kullanıcı olabilir)
    // Sadece aynı IP için tekrar üretmeyi engelliyoruz (cache ile)

    // 3. Random kupon kodu üret
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let couponCode = "";
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      couponCode += chars[bytes[i] % chars.length];
    }

    // 4. Coupons tablosuna ekle
    const expiresAt = new Date(Date.now() + COUPON_VALIDITY_MINUTES * 60 * 1000).toISOString();

    const attempts = [
      { code: couponCode, discount_percent: promo.discount_percent, max_uses: 1, expires_at: expiresAt, is_active: true, coupon_type: "promo_generated", promo_link_id: promo.id },
      { code: couponCode, discount_percent: promo.discount_percent, max_uses: 1, expires_at: expiresAt, is_active: true, coupon_type: "promo_generated" },
      { code: couponCode, discount_percent: promo.discount_percent, max_uses: 1, expires_at: expiresAt, is_active: true },
    ];

    let coupon: any = null;
    for (const attempt of attempts) {
      const { data: c, error: e } = await admin
        .from("coupons")
        .insert(attempt)
        .select("id, code, discount_percent, expires_at")
        .single();

      if (!e && c) {
        coupon = c;
        break;
      }
    }

    if (!coupon) {
      return NextResponse.json({ valid: false, error: "Kupon oluşturulamadı" }, { status: 500 });
    }

    // 5. Cache'e kaydet
    recentGenerations.set(cacheKey, {
      code: coupon.code,
      expiresAt: coupon.expires_at,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      valid: true,
      coupon_code: coupon.code,
      discount_percent: coupon.discount_percent,
      expires_at: coupon.expires_at,
    });
  } catch (error: any) {
    console.error("[Promo Generate] Exception:", error?.message);
    return NextResponse.json({ valid: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
