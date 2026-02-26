"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Download, FileText, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp, CreditCard, User, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

type PeriodKey = "thisMonth" | "lastMonth" | "last3m" | "custom";

const PAGE_SIZE = 20;

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
  const [salesPage, setSalesPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadData = async (p?: PeriodKey) => {
    const activePeriod = p || period;
    setLoading(true);
    setSalesPage(1);
    setPayoutsPage(1);
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
      toast.error("Baslangic ve bitis tarihi secin");
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
        toast.error("Guncelleme basarisiz");
      }
    } catch {
      toast.error("Bir hata olustu");
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

  // Pagination
  const paginatedSales = useMemo(() => sales.slice(0, salesPage * PAGE_SIZE), [sales, salesPage]);
  const paginatedPayouts = useMemo(() => payouts.slice(0, payoutsPage * PAGE_SIZE), [payouts, payoutsPage]);
  const hasMoreSales = paginatedSales.length < sales.length;
  const hasMorePayouts = paginatedPayouts.length < payouts.length;

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

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-16 max-w-5xl">
        {/* Donem Secici */}
        <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {([
              { key: "thisMonth" as PeriodKey, label: "Bu Ay" },
              { key: "lastMonth" as PeriodKey, label: "Gecen Ay" },
              { key: "last3m" as PeriodKey, label: "Son 3 Ay" },
              { key: "custom" as PeriodKey, label: "Ozel" },
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
                <label className="block text-xs text-zinc-500 mb-1">Baslangic</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input-modern w-full text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Bitis</label>
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
            {/* Ozet Kartlari */}
            {summary && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-pink-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{summary.totalRevenue.toLocaleString("tr-TR")}</p>
                  <p className="text-xs text-zinc-400">Toplam Gelir</p>
                  <p className="text-[10px] text-zinc-500">{summary.salesCount} satis — TRY</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <TrendingDown className="h-5 w-5 text-pink-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{summary.totalExpense.toLocaleString("tr-TR")}</p>
                  <p className="text-xs text-zinc-400">Toplam Gider</p>
                  <p className="text-[10px] text-zinc-500">{summary.payoutsCount} odeme — TRY</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                  <Wallet className="h-5 w-5 text-pink-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-pink-500">
                    {summary.netProfit.toLocaleString("tr-TR")}
                  </p>
                  <p className="text-xs text-zinc-400">Net Kazanc</p>
                  <p className="text-[10px] text-zinc-500">TRY</p>
                </div>
              </div>
            )}

            {/* Fatura Uyarisi */}
            {uninvoicedSales.length > 0 && (
              <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-pink-400 font-medium">{uninvoicedSales.length} satis icin fatura kesilmemis</p>
                  <p className="text-xs text-zinc-400 mt-1">Asagidaki satis tablosundan fatura durumlarini guncelleyebilirsiniz.</p>
                </div>
              </div>
            )}

            {/* CSV Indir */}
            <div className="flex justify-end mb-4">
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-xl text-sm font-medium transition">
                <Download className="h-4 w-4" />
                CSV Indir (Muhasebeci)
              </button>
            </div>

            {/* Tab Secici */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("sales")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  activeTab === "sales" ? "bg-pink-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Satislar ({sales.length})
              </button>
              <button
                onClick={() => setActiveTab("payouts")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  activeTab === "payouts" ? "bg-pink-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Affiliate Odemeleri ({payouts.length})
              </button>
            </div>

            {/* Satislar Tablosu */}
            {activeTab === "sales" && (
              <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-pink-500" />
                    <h3 className="font-semibold">Satislar</h3>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {paginatedSales.length} / {sales.length}
                  </span>
                </div>

                {sales.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">Bu donemde satis yok.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-zinc-400 text-xs">
                            <th className="text-left py-2 pr-2">Tarih</th>
                            <th className="text-left py-2 pr-2">Musteri</th>
                            <th className="text-left py-2 pr-2 hidden sm:table-cell">E-posta</th>
                            <th className="text-right py-2 pr-2">Tutar</th>
                            <th className="text-left py-2 pr-2 hidden sm:table-cell">Paket</th>
                            <th className="text-center py-2">Fatura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSales.map((sale) => (
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
                                      ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                                      : "bg-white/10 text-zinc-400 hover:bg-white/15"
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

                    {/* Sayfalama */}
                    {hasMoreSales && (
                      <button
                        onClick={() => setSalesPage(p => p + 1)}
                        className="w-full mt-4 py-3 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Daha Fazla Goster ({sales.length - paginatedSales.length} kaldi)
                      </button>
                    )}
                    {salesPage > 1 && !hasMoreSales && (
                      <button
                        onClick={() => setSalesPage(1)}
                        className="w-full mt-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3" />
                        Basa Don
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Affiliate Odemeleri Tablosu */}
            {activeTab === "payouts" && (
              <div className="bg-zinc-900 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-pink-500" />
                    <h3 className="font-semibold">Affiliate Odemeleri</h3>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {paginatedPayouts.length} / {payouts.length}
                  </span>
                </div>

                {payouts.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">Bu donemde affiliate odemesi yok.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paginatedPayouts.map((payout) => {
                        const isExpanded = expandedPayout === payout.id;
                        return (
                          <div key={payout.id} className="border border-white/5 rounded-xl overflow-hidden">
                            {/* Satir Ozeti */}
                            <button
                              onClick={() => setExpandedPayout(isExpanded ? null : payout.id)}
                              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-zinc-400">
                                      {new Date(payout.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                    <span className="text-sm font-medium truncate">{payout.affiliateName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {payout.tcKimlik ? (
                                      <span className="text-[10px] text-zinc-500 font-mono">TC: {payout.tcKimlik}</span>
                                    ) : (
                                      <span className="text-[10px] text-pink-400 font-medium">TC Eksik</span>
                                    )}
                                    {payout.iban && (
                                      <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">IBAN: {payout.iban.slice(0, 6)}...{payout.iban.slice(-4)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-bold text-pink-500">{payout.amount.toLocaleString("tr-TR")} {payout.currency}</span>
                                {payout.invoiceUrl ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">PDF</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">-</span>
                                )}
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                              </div>
                            </button>

                            {/* Detay Paneli */}
                            {isExpanded && (
                              <div className="border-t border-white/5 bg-white/[0.02] p-4 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {/* Kisisel Bilgiler */}
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                      <User className="h-3 w-3" /> Kisisel Bilgiler
                                    </p>
                                    <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">Ad Soyad</span>
                                        <span className="text-xs font-medium">{payout.affiliateName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">E-posta</span>
                                        <span className="text-xs font-medium">{payout.affiliateEmail || "—"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">TC Kimlik No</span>
                                        <span className={`text-xs font-mono ${payout.tcKimlik ? "font-medium" : "text-pink-400"}`}>
                                          {payout.tcKimlik || "Eksik"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-start">
                                        <span className="text-xs text-zinc-500 shrink-0">Adres</span>
                                        <span className={`text-xs text-right ml-2 ${payout.address ? "" : "text-pink-400"}`}>
                                          {payout.address || "Eksik"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Odeme Bilgileri */}
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                      <CreditCard className="h-3 w-3" /> Odeme Bilgileri
                                    </p>
                                    <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">Tutar</span>
                                        <span className="text-xs font-bold text-pink-500">{payout.amount.toLocaleString("tr-TR")} {payout.currency}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">Hesap Sahibi</span>
                                        <span className="text-xs font-medium">{payout.affiliateHolderName || "—"}</span>
                                      </div>
                                      <div className="flex justify-between items-start">
                                        <span className="text-xs text-zinc-500 shrink-0">IBAN</span>
                                        <span className={`text-xs font-mono text-right ml-2 break-all ${payout.iban ? "" : "text-pink-400"}`}>
                                          {payout.iban || "Eksik"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-xs text-zinc-500">Fatura</span>
                                        {payout.invoiceUrl ? (
                                          <a
                                            href={payout.invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition"
                                          >
                                            <FileText className="h-3 w-3" />
                                            PDF Gor
                                          </a>
                                        ) : (
                                          <span className="text-xs text-pink-400">Yok</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Eksik Bilgi Uyarisi */}
                                {(!payout.tcKimlik || !payout.iban || !payout.address) && (
                                  <div className="flex items-start gap-2 bg-pink-500/10 border border-pink-500/20 rounded-lg p-2.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-pink-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-pink-300">
                                      Gider pusulasi/fatura icin eksik bilgiler var:
                                      {!payout.tcKimlik && " TC Kimlik"}
                                      {!payout.iban && " IBAN"}
                                      {!payout.address && " Adres"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sayfalama */}
                    {hasMorePayouts && (
                      <button
                        onClick={() => setPayoutsPage(p => p + 1)}
                        className="w-full mt-4 py-3 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Daha Fazla Goster ({payouts.length - paginatedPayouts.length} kaldi)
                      </button>
                    )}
                    {payoutsPage > 1 && !hasMorePayouts && (
                      <button
                        onClick={() => setPayoutsPage(1)}
                        className="w-full mt-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3" />
                        Basa Don
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
