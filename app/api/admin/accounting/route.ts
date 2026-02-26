import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const format = searchParams.get("format");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate ve endDate gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Satışlar (coin_payments)
    const { data: sales } = await admin
      .from("coin_payments")
      .select("id, user_id, price_paid, coins_purchased, status, created_at, invoice_sent, package_id")
      .eq("status", "completed")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false })
      .limit(5000);

    const salesList = sales || [];

    // Fetch user profiles for sales
    const saleUserIds = [...new Set(salesList.map(s => s.user_id))];
    let saleProfileMap = new Map<string, any>();
    let saleEmailMap = new Map<string, string>();

    if (saleUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, name, surname")
        .in("user_id", saleUserIds);

      if (profiles) {
        saleProfileMap = new Map(profiles.map(p => [p.user_id, p]));
      }

      for (const id of saleUserIds) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(id);
          if (authUser?.user?.email) saleEmailMap.set(id, authUser.user.email);
        } catch { /* skip */ }
      }
    }

    const enrichedSales = salesList.map(sale => {
      const profile = saleProfileMap.get(sale.user_id);
      return {
        id: sale.id,
        date: sale.created_at,
        customerName: profile ? `${profile.name || ""} ${profile.surname || ""}`.trim() || "—" : "—",
        customerEmail: saleEmailMap.get(sale.user_id) || "—",
        amount: Number(sale.price_paid) || 0,
        packageName: sale.package_id || "—",
        invoiceSent: sale.invoice_sent || false,
      };
    });

    // 2. Affiliate Ödemeleri
    const { data: payouts } = await admin
      .from("affiliate_payouts")
      .select("id, affiliate_user_id, amount, status, requested_at, processed_at, invoice_url, currency")
      .eq("status", "approved")
      .gte("requested_at", startDate)
      .lte("requested_at", endDate)
      .order("requested_at", { ascending: false })
      .limit(5000);

    const payoutList = payouts || [];

    // Fetch affiliate profiles
    const affiliateIds = [...new Set(payoutList.map(p => p.affiliate_user_id))];
    let affiliateProfileMap = new Map<string, any>();

    if (affiliateIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, name, surname, tc_kimlik_no, affiliate_iban, address")
        .in("user_id", affiliateIds);

      if (profiles) {
        affiliateProfileMap = new Map(profiles.map(p => [p.user_id, p]));
      }
    }

    const enrichedPayouts = payoutList.map(payout => {
      const profile = affiliateProfileMap.get(payout.affiliate_user_id);
      return {
        id: payout.id,
        date: payout.requested_at,
        affiliateName: profile ? `${profile.name || ""} ${profile.surname || ""}`.trim() || "—" : "—",
        tcKimlik: profile?.tc_kimlik_no || null,
        iban: profile?.affiliate_iban || null,
        address: profile?.address || null,
        amount: Number(payout.amount) || 0,
        currency: payout.currency || "TRY",
        invoiceUrl: payout.invoice_url || null,
      };
    });

    // 3. Özet
    const totalRevenue = enrichedSales.reduce((sum, s) => sum + s.amount, 0);
    const totalExpense = enrichedPayouts.reduce((sum, p) => sum + p.amount, 0);
    const netProfit = totalRevenue - totalExpense;

    const summary = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      salesCount: enrichedSales.length,
      payoutsCount: enrichedPayouts.length,
      uninvoicedCount: enrichedSales.filter(s => !s.invoiceSent).length,
    };

    // CSV export
    if (format === "csv") {
      const BOM = "\uFEFF";
      let csv = BOM + "TIP;TARIH;AD;EMAIL/TC;TUTAR;PAKET/IBAN;FATURA\n";

      for (const sale of enrichedSales) {
        csv += `SATIS;${new Date(sale.date).toLocaleDateString("tr-TR")};${sale.customerName};${sale.customerEmail};${sale.amount.toFixed(2)};${sale.packageName};${sale.invoiceSent ? "Evet" : "Hayır"}\n`;
      }

      for (const payout of enrichedPayouts) {
        csv += `ODEME;${new Date(payout.date).toLocaleDateString("tr-TR")};${payout.affiliateName};${payout.tcKimlik || "-"};${payout.amount.toFixed(2)};${payout.iban || "-"};${payout.invoiceUrl ? "Var" : "Yok"}\n`;
      }

      csv += `\nOZET;;Toplam Gelir;;${summary.totalRevenue.toFixed(2)};;\n`;
      csv += `;;Toplam Gider;;${summary.totalExpense.toFixed(2)};;\n`;
      csv += `;;Net Kazanc;;${summary.netProfit.toFixed(2)};;\n`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="muhasebe_${startDate}_${endDate}.csv"`,
        },
      });
    }

    return NextResponse.json({
      sales: enrichedSales,
      payouts: enrichedPayouts,
      summary,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Admin accounting GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { paymentId, invoiceSent } = await request.json();

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "Geçersiz ödeme ID" }, { status: 400 });
    }
    if (typeof invoiceSent !== "boolean") {
      return NextResponse.json({ error: "invoiceSent boolean olmalı" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("coin_payments")
      .update({ invoice_sent: invoiceSent })
      .eq("id", paymentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Admin accounting PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
