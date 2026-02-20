import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
    }

    const body = await request.json();
    const { email, amount } = body as { email?: string; amount?: number };

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
    }

    if (!amount || typeof amount !== "number" || amount < 1 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: "Miktar en az 1 FL olmalıdır." }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: "Tek seferde en fazla 10.000 FL gönderilebilir." }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Kendine gönderme kontrolü
    if (trimmedEmail === user.email?.toLowerCase()) {
      return NextResponse.json({ error: "Kendinize hediye gönderemezsiniz." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Alıcıyı bul (auth.users tablosundan e-posta ile)
    const { data: recipientId, error: recipientError } = await admin.rpc(
      "get_user_id_by_email",
      { p_email: trimmedEmail }
    );

    if (recipientError) {
      console.error("[Gift] Recipient lookup error:", recipientError.message);
      return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
    }

    if (!recipientId) {
      return NextResponse.json(
        { error: "Bu e-posta adresine kayıtlı kullanıcı bulunamadı." },
        { status: 404 }
      );
    }

    // Gönderenin bakiyesini ve adını al
    const { data: senderProfile, error: senderError } = await admin
      .from("profiles")
      .select("coin_balance, name, surname, role")
      .eq("user_id", user.id)
      .single();

    if (senderError || !senderProfile) {
      return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
    }

    if (senderProfile.coin_balance < amount) {
      return NextResponse.json(
        { error: "Yetersiz bakiye. Lütfen bakiye yükleyin." },
        { status: 400 }
      );
    }

    // Rate limit: saatte max 10 hediye
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentGifts } = await admin
      .from("gifts")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", oneHourAgo);

    if ((recentGifts || 0) >= 10) {
      return NextResponse.json(
        { error: "Çok fazla hediye gönderdiniz. Lütfen bir süre bekleyin." },
        { status: 429 }
      );
    }

    // Gönderenden düş (DB CHECK constraint ile race condition koruması)
    const { error: decrError } = await admin.rpc("increment_coin_balance", {
      p_user_id: user.id,
      p_amount: -amount,
    });

    if (decrError) {
      console.error("[Gift] Sender balance decrement error:", decrError.message);
      // CHECK constraint ihlali = yetersiz bakiye (race condition yakalandı)
      if (decrError.message?.includes("profiles_coin_balance_non_negative")) {
        return NextResponse.json(
          { error: "Yetersiz bakiye. Lütfen bakiye yükleyin." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
    }

    // Alıcıya ekle
    const { error: incrError } = await admin.rpc("increment_coin_balance", {
      p_user_id: recipientId,
      p_amount: amount,
    });

    if (incrError) {
      console.error("[Gift] Recipient balance increment error:", incrError.message);
      // Geri al
      await admin.rpc("increment_coin_balance", {
        p_user_id: user.id,
        p_amount: amount,
      });
      return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
    }

    // gifts tablosuna kayıt
    await admin.from("gifts").insert({
      sender_id: user.id,
      recipient_id: recipientId,
      recipient_email: trimmedEmail,
      amount,
    });

    // coin_transactions: sender
    await admin.from("coin_transactions").insert({
      user_id: user.id,
      amount: -amount,
      transaction_type: "gift_sent",
      description: `${trimmedEmail} adresine ${amount} FL hediye gönderildi`,
      reference_type: "gift",
    });

    // coin_transactions: recipient (e-posta yerine ad soyad göster)
    const senderName = senderProfile.role === "admin"
      ? "*ADMİN*"
      : [senderProfile.name, senderProfile.surname].filter(Boolean).join(" ") || "Bir kullanıcı";
    await admin.from("coin_transactions").insert({
      user_id: recipientId,
      amount: amount,
      transaction_type: "gift_received",
      description: `${senderName} kişisinden ${amount} FL hediye alındı`,
      reference_type: "gift",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Gift] Exception:", error?.message);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
