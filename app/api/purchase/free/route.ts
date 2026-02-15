import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActivePrice } from "@/lib/discount";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await request.json();
    if (!templateId) {
      return NextResponse.json(
        { error: "templateId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Template fiyatını doğrula — ücretsiz olmalı
    const { data: template, error: tplErr } = await admin
      .from("templates")
      .select("id, coin_price, discount_price, discount_expires_at")
      .eq("id", templateId)
      .single();

    if (tplErr || !template) {
      return NextResponse.json(
        { error: "Şablon bulunamadı" },
        { status: 404 }
      );
    }

    if (getActivePrice(template) !== 0) {
      return NextResponse.json(
        { error: "Bu şablon ücretsiz değil" },
        { status: 400 }
      );
    }

    // 2. Mevcut purchase kontrol (idempotent)
    const { data: existing } = await admin
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", templateId)
      .eq("payment_status", "completed")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true });
    }

    // 3. Purchase kaydı
    const { error: purchaseError } = await admin.from("purchases").insert({
      user_id: user.id,
      template_id: templateId,
      coins_spent: 0,
      payment_method: "coins",
      payment_status: "completed",
    });

    if (purchaseError) {
      return NextResponse.json(
        { success: false, error: "Satın alma kaydı oluşturulamadı" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
