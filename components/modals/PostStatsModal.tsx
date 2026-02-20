"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye, Heart, MessageCircle, Bookmark,
  Activity, Clock, BarChart3, BookOpen, Percent,
} from "lucide-react";
import ShareIcon from "@/components/ShareIcon";
import Modal from "./Modal";
import { formatCount, formatRelativeDate } from "@/lib/utils";
import { StatsSkeleton } from "@/components/Skeletons";

interface PostStatsModalProps {
  open: boolean;
  onClose: () => void;
  postId: number;
}

interface Totals { views: number; likes: number; comments: number; saves: number; shares: number }
interface ReadStats { avgReadDuration: number; avgReadPercentage: number; qualifiedReads: number }
interface DayData { date: string; count: number }
interface HourData { hour: number; count: number }
interface CommentData { id: string; content: string; created_at: string; author: { username: string; full_name: string; avatar_url?: string } }

export default function PostStatsModal({ open, onClose, postId }: PostStatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [postTitle, setPostTitle] = useState("");
  const [totals, setTotals] = useState<Totals>({ views: 0, likes: 0, comments: 0, saves: 0, shares: 0 });
  const [engagementRate, setEngagementRate] = useState(0);
  const [readStats, setReadStats] = useState<ReadStats>({ avgReadDuration: 0, avgReadPercentage: 0, qualifiedReads: 0 });
  const [viewsByDay, setViewsByDay] = useState<DayData[]>([]);
  const [peakHours, setPeakHours] = useState<HourData[]>([]);
  const [recentComments, setRecentComments] = useState<CommentData[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/stats`);
      const data = await res.json();
      setPostTitle(data.post?.title || "");
      setTotals(data.totals || { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 });
      setEngagementRate(data.engagementRate || 0);
      setReadStats(data.readStats || { avgReadDuration: 0, avgReadPercentage: 0, qualifiedReads: 0 });
      setViewsByDay(data.viewsByDay || []);
      setPeakHours(data.peakHours || []);
      setRecentComments(data.recentComments || []);
    } catch {} finally { setLoading(false); }
  }, [postId]);

  useEffect(() => {
    if (open) loadStats();
  }, [open, loadStats]);

  return (
    <Modal open={open} onClose={onClose} size="md" title="İstatistikler">
      <div className="px-4 pb-6">
        {/* Post title */}
        {postTitle && (
          <p className="text-[0.82rem] font-semibold text-text-secondary truncate mb-4 mt-1">{postTitle}</p>
        )}

        {loading ? (
          <StatsSkeleton />
        ) : (
          <>
            {/* Views — big hero */}
            <div className="bg-gradient-to-br from-accent-main/12 via-accent-main/5 to-transparent rounded-xl p-4 mb-3 text-center">
              <Eye className="h-5 w-5 text-accent-main mx-auto mb-1" />
              <p className="text-[2rem] font-extrabold leading-none">{formatCount(totals.views)}</p>
              <p className="text-[0.68rem] text-text-muted mt-1">Toplam Görüntülenme</p>
            </div>

            {/* Interactions — 2 column grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatBox icon={Heart} label="Beğeni" value={totals.likes} />
              <StatBox icon={MessageCircle} label="Yorum" value={totals.comments} />
              <StatBox icon={Bookmark} label="Kaydetme" value={totals.saves} />
              <StatBox icon={ShareIcon} label="Paylaşım" value={totals.shares} />
            </div>

            {/* Engagement + Read Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-bg-secondary rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Activity className="h-3 w-3 text-text-muted" />
                  <span className="text-[0.62rem] text-text-muted">Etkileşim</span>
                </div>
                <p className="text-lg font-bold">%{Math.min(engagementRate, 99)}</p>
              </div>
              <div className="bg-bg-secondary rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Clock className="h-3 w-3 text-text-muted" />
                  <span className="text-[0.62rem] text-text-muted">Ort. Süre</span>
                </div>
                <p className="text-lg font-bold">{readStats.avgReadDuration > 60 ? `${Math.round(readStats.avgReadDuration / 60)}dk` : `${readStats.avgReadDuration}sn`}</p>
              </div>
              <div className="bg-bg-secondary rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <BookOpen className="h-3 w-3 text-text-muted" />
                  <span className="text-[0.62rem] text-text-muted">Ort. Okuma</span>
                </div>
                <p className="text-lg font-bold">%{readStats.avgReadPercentage}</p>
              </div>
            </div>

            {/* Mini chart */}
            {viewsByDay.length > 0 && viewsByDay.some(d => d.count > 0) && (
              <div className="bg-bg-secondary rounded-xl p-4 mb-3">
                <p className="text-[0.68rem] text-text-muted mb-3 font-medium uppercase tracking-wider flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Son 30 Gün
                </p>
                <MiniChart data={viewsByDay} />
              </div>
            )}

            {/* Peak Hours */}
            {peakHours.some(h => h.count > 0) && (
              <div className="bg-bg-secondary rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.68rem] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Aktif Saatler
                  </p>
                  <span className="text-[0.65rem] text-text-muted">
                    En yoğun: {String(peakHours.reduce((a, b) => a.count > b.count ? a : b).hour).padStart(2, "0")}:00
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-0.5">
                  {peakHours.slice(0, 24).map(h => {
                    const maxH = Math.max(...peakHours.map(x => x.count), 1);
                    const intensity = maxH > 0 ? h.count / maxH : 0;
                    return (
                      <div key={h.hour} className="flex flex-col items-center gap-0.5">
                        <div
                          className="w-full aspect-square rounded-[2px]"
                          style={{
                            backgroundColor: intensity === 0
                              ? "var(--bg-tertiary)"
                              : `color-mix(in srgb, var(--accent-main) ${Math.round(intensity * 100)}%, var(--bg-tertiary))`,
                          }}
                        />
                        {h.hour % 6 === 0 && (
                          <span className="text-[7px] text-text-muted leading-none">{String(h.hour).padStart(2, "0")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent comments */}
            {recentComments.length > 0 && (
              <div className="bg-bg-secondary rounded-xl p-4">
                <p className="text-[0.68rem] text-text-muted mb-3 font-medium uppercase tracking-wider flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> Son Yorumlar
                </p>
                <div className="space-y-2.5">
                  {recentComments.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      {c.author?.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <img className="default-avatar-auto w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[0.72rem] font-semibold">{c.author?.full_name || c.author?.username}</span>
                          <span className="text-[0.62rem] text-text-muted">{formatRelativeDate(c.created_at)}</span>
                        </div>
                        <p className="text-[0.72rem] text-text-secondary line-clamp-2 mt-0.5">{c.content?.replace(/<[^>]*>/g, "")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── StatBox (matches analytics MetricCard) ── */
function StatBox({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-bg-secondary rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-[0.72rem] text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold">{formatCount(value)}</p>
    </div>
  );
}

/* ── MiniChart ── */
function MiniChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <div className="flex items-end gap-[1px] h-20">
        {data.map((d, i) => {
          const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-text-primary text-bg-primary text-[9px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                {d.count}
              </div>
              <div
                className={`w-full rounded-t-[1.5px] transition-all ${isLast ? "bg-accent-main" : "bg-accent-main/50 group-hover:bg-accent-main/80"}`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-text-muted">{data.length > 0 && new Date(data[0].date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
        <span className="text-[9px] text-text-muted">{data.length > 0 && new Date(data[data.length - 1].date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}
