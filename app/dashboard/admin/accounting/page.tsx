"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Download, FileText, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

type PeriodKey = "thisMonth" | "lastMonth" | "last3m" | "custom";

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "last3m":
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case "custom":
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd ? new Date(customEnd + "T23:59:59.999Z") : end;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

export default function AdminAccountingPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [togglingInvoice, setTogglingInvoice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "payouts">("sales");
  const router = useRouter();
  const supabase = createClient();

  const loadData = async (p?: PeriodKey) => {
    const activePeriod = p || period;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const { startDate, endDate } = getDateRange(activePeriod, customStart, customEnd);

      const res = await fetch(`/api/admin/accounting?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
        setPayouts(data.payouts || []);
        setSummary(data.summary || null);
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = (newPeriod: PeriodKey) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      loadData(newPeriod);
    }
  };

  const handleCustomSearch = () => {
    if (!customStart || !customEnd) {
      toast.error("Başlangıç ve bitiş tarihi seçin");
      return;
    }
    loadData("custom");
  };

  const handleToggleInvoice = async (paymentId: string, current: boolean) => {
    setTogglingInvoice(paymentId);
    try {
      const res = await fetch("/api/admin/accounting", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, invoiceSent: !current }),
      });
      if (res.ok) {
        setSales(prev => prev.map(s => s.id === paymentId ? { ...s, invoiceSent: !current } : s));
        if (summary) {
          setSummary((prev: any) => ({
            ...prev,
            uninvoicedCount: prev.uninvoicedCount + (current ? 1 : -1),
          }));
        }
      } else {
        toast.error("Güncelleme başarısız");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setTogglingInvoice(null);
    }
  };

  const handleExportCSV = async () => {
    const { startDate, endDate } = getDateRange(period, customStart, customEnd);
    try {
      const res = await fetch(`/api/admin/accounting?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&format=csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `muhasebe_raporu.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV indirildi");
      }
    } catch {
      toast.error("CSV indirilemedi");
    }
  };

  const uninvoicedSales = useMemo(() => sales.filter(s => !s.invoiceSent), [sales]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="container mx-auto px-6 flex items-center justify-between min-h-[73px]">
          <button onClick={() => router.back()} className="flex items-center gap-2 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg font-semibold">Muhasebe Raporu</h1>
          <div className="w-16" />
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-16 max-w-4xl">
        {/* Dönem Seçici */}
        <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {([
              { key: "thisMonth" as PeriodKey, label: "Bu Ay" },
              { key: "lastMonth" as PeriodKey, label: "Geçen Ay" },
              { key: "last3m" as PeriodKey, label: "Son 3 Ay" },
              { key: "custom" as PeriodKey, label: "Özel" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePeriodChange(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition shrink-0 ${
                  period === key ? "bg-pink-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Başlangıç</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input-modern w-full text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Bitiş</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input-modern w-full text-sm"
                />
              </div>
              <button onClick={handleCustomSearch} className="btn-primary px-4 py-2.5 text-sm shrink-0">
                Ara
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-28" />
              <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-28" />
              <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-28" />
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-60" />
          </div>
        ) : (
          <>
            {/* Özet Kartları */}
            {summary && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-500">{summary.totalRevenue.toLocaleString("tr-TR")}</p>
                  <p className="text-xs text-zinc-400">Toplam Gelir (TRY)</p>
                  <p className="text-[10px] text-zinc-500">{summary.salesCount} satış</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-500">{summary.totalExpense.toLocaleString("tr-TR")}</p>
                  <p className="text-xs text-zinc-400">Toplam Gider (TRY)</p>
                  <p className="text-[10px] text-zinc-500">{summary.payoutsCount} ödeme</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <DollarSign className="h-5 w-5 text-pink-500 mx-auto mb-1" />
                  <p className={`text-xl font-bold ${summary.netProfit >= 0 ? "text-pink-500" : "text-red-500"}`}>
                    {summary.netProfit.toLocaleString("tr-TR")}
                  </p>
                  <p className="text-xs text-zinc-400">Net Kazanç (TRY)</p>
                </div>
              </div>
            )}

            {/* Fatura Uyarısı */}
            {uninvoicedSales.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">{uninvoicedSales.length} satış için fatura kesilmemiş</p>
                  <p className="text-xs text-zinc-400 mt-1">Aşağıdaki satış tablosundan fatura durumlarını güncelleyebilirsiniz.</p>
                </div>
              </div>
            )}

            {/* CSV İndir */}
            <div className="flex justify-end mb-4">
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium transition">
                <Download className="h-4 w-4" />
                CSV İndir
              </button>
            </div>

            {/* Tab Seçici */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("sales")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  activeTab === "sales" ? "bg-pink-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Satışlar ({sales.length})
              </button>
              <button
                onClick={() => setActiveTab("payouts")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  activeTab === "payouts" ? "bg-pink-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Affiliate Ödemeleri ({payouts.length})
              </button>
            </div>

            {/* Satışlar Tablosu */}
            {activeTab === "sales" && (
              <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-pink-500" />
                  <h3 className="font-semibold">Satışlar</h3>
                </div>

                {sales.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">Bu dönemde satış yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-400 text-xs">
                          <th className="text-left py-2 pr-2">Tarih</th>
                          <th className="text-left py-2 pr-2">Müşteri</th>
                          <th className="text-left py-2 pr-2 hidden sm:table-cell">E-posta</th>
                          <th className="text-right py-2 pr-2">Tutar</th>
                          <th className="text-left py-2 pr-2 hidden sm:table-cell">Paket</th>
                          <th className="text-center py-2">Fatura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((sale) => (
                          <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2.5 pr-2 text-xs text-zinc-400 whitespace-nowrap">
                              {new Date(sale.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                            </td>
                            <td className="py-2.5 pr-2 text-xs font-medium truncate max-w-[120px]">{sale.customerName}</td>
                            <td className="py-2.5 pr-2 text-xs text-zinc-400 truncate max-w-[150px] hidden sm:table-cell">{sale.customerEmail}</td>
                            <td className="py-2.5 pr-2 text-xs font-bold text-right whitespace-nowrap">{sale.amount.toLocaleString("tr-TR")} TRY</td>
                            <td className="py-2.5 pr-2 text-xs text-zinc-400 truncate max-w-[100px] hidden sm:table-cell">{sale.packageName}</td>
                            <td className="py-2.5 text-center">
                              <button
                                onClick={() => handleToggleInvoice(sale.id, sale.invoiceSent)}
                                disabled={togglingInvoice === sale.id}
                                className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                                  sale.invoiceSent
                                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                    : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                }`}
                              >
                                {togglingInvoice === sale.id ? "..." : sale.invoiceSent ? "Kesildi" : "Kesilmedi"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Affiliate Ödemeleri Tablosu */}
            {activeTab === "payouts" && (
              <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-pink-500" />
                  <h3 className="font-semibold">Affiliate Ödemeleri</h3>
                </div>

                {payouts.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">Bu dönemde affiliate ödemesi yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-400 text-xs">
                          <th className="text-left py-2 pr-2">Tarih</th>
                          <th className="text-left py-2 pr-2">Affiliate</th>
                          <th className="text-left py-2 pr-2 hidden sm:table-cell">TC Kimlik</th>
                          <th className="text-right py-2 pr-2">Tutar</th>
                          <th className="text-center py-2">Fatura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map((payout) => (
                          <tr key={payout.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2.5 pr-2 text-xs text-zinc-400 whitespace-nowrap">
                              {new Date(payout.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                            </td>
                            <td className="py-2.5 pr-2 text-xs font-medium truncate max-w-[120px]">{payout.affiliateName}</td>
                            <td className="py-2.5 pr-2 text-xs text-zinc-400 font-mono hidden sm:table-cell">{payout.tcKimlik || <span className="text-yellow-500">Eksik</span>}</td>
                            <td className="py-2.5 pr-2 text-xs font-bold text-right whitespace-nowrap">{payout.amount.toLocaleString("tr-TR")} {payout.currency}</td>
                            <td className="py-2.5 text-center">
                              {payout.invoiceUrl ? (
                                <a
                                  href={payout.invoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition"
                                >
                                  <FileText className="h-3 w-3" />
                                  PDF
                                </a>
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
