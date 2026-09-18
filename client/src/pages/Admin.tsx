import { AlertTriangle, ArrowLeft, BarChart3, Coins, ExternalLink, Loader2, ShieldCheck, Users, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatCoins(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filterDate, setFilterDate] = useState("");
  const [filterTier, setFilterTier] = useState<"" | "level1" | "level2" | "link4m" | "layma">("");
  const filterInput = useMemo(() => ({ date: filterDate || undefined, tier: filterTier || undefined }), [filterDate, filterTier]);
  const overviewQuery = trpc.admin.overview.useQuery(filterInput, { enabled: isAdmin, retry: false });

  if (loading || (isAdmin && overviewQuery.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08090d] text-violet-200"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!user || !isAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-slate-100"><div className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#111219] p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-rose-300" /><h1 className="mt-4 font-display text-xl font-semibold text-white">Admin access required</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Tài khoản này không có quyền xem dữ liệu quản trị.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#0c0d12]">Back to workspace</Link></div></div>;
  }

  const data = overviewQuery.data;
  const metrics = data?.metrics ?? { totalUsers: 0, totalCoins: 0, totalClaims: 0, openAttempts: 0, flaggedUsers: 0 };
  const attemptStats = data?.attemptStats ?? { success: 0, failed: 0, open: 0, successRate: 0 };
  const statCards = [
    { label: "Users", value: metrics.totalUsers, Icon: Users, color: "text-violet-200" },
    { label: "Coins in circulation", value: metrics.totalCoins, Icon: Coins, color: "text-cyan-200" },
    { label: "Verified claims", value: metrics.totalClaims, Icon: WalletCards, color: "text-emerald-200" },
    { label: "Open attempts", value: metrics.openAttempts, Icon: ExternalLink, color: "text-amber-200" },
    { label: "Flagged users", value: metrics.flaggedUsers, Icon: AlertTriangle, color: "text-rose-200" },
  ];
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08090d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><div className="aurora aurora-violet" /><div className="aurora aurora-cyan" /><div className="grid-noise absolute inset-0 opacity-[0.025]" /></div>
      <main className="relative z-10 mx-auto max-w-[1480px] px-5 py-7 sm:px-8 xl:px-10">
        <header className="flex flex-col justify-between gap-5 border-b border-white/[0.07] pb-7 sm:flex-row sm:items-center"><div><Link href="/" className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back to workspace</Link><div className="flex items-center gap-3"><div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-[#0b0c11]"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display text-xl font-bold tracking-[-0.04em] text-white">Admin control room</p><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Lumen rewards · live operations</p></div></div></div><span className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3.5 py-2.5 text-[11px] font-semibold text-emerald-200 sm:self-auto"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Admin verified</span></header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(({ label, value, Icon, color }) => <div key={label} className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-slate-500">{label}</p><Icon className={`h-4 w-4 ${color}`} /></div><p className="mt-5 font-display text-3xl font-semibold tracking-[-0.06em] text-white">{formatCoins(Number(value))}</p><p className="mt-1 text-[10px] text-slate-600">Live database value</p></div>)}
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.075] bg-white/[0.032] p-4 sm:flex-row sm:items-center"><div><p className="text-[11px] font-semibold text-slate-300">Bộ lọc thống kê</p><p className="mt-1 text-[10px] text-slate-600">Lọc biểu đồ, lịch sử coin và fraud watch.</p></div><div className="flex flex-1 flex-wrap gap-2 sm:justify-end"><input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-[11px] text-slate-300 outline-none" /><select value={filterTier} onChange={(event) => setFilterTier(event.target.value as typeof filterTier)} className="h-9 rounded-lg border border-white/[0.1] bg-[#15161e] px-3 text-[11px] text-slate-300 outline-none"><option value="">Tất cả link</option><option value="level1">Link4Sub cấp 1</option><option value="level2">Link4Sub cấp 2</option><option value="link4m">Link4M</option><option value="layma">Layma</option></select>{(filterDate || filterTier) && <button onClick={() => { setFilterDate(""); setFilterTier(""); }} className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-300/15 px-3 text-[11px] text-rose-200 hover:bg-rose-300/10"><X className="h-3 w-3" /> Xóa lọc</button>}</div></section>

        <section className="mt-5 rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="font-display text-base font-semibold text-white">Tỷ lệ vượt link</p><p className="mt-1 text-[11px] text-slate-600">Thống kê trên 150 attempt gần nhất.</p></div><BarChart3 className="h-4 w-4 text-cyan-200" /></div><div className="mt-6 grid gap-5 md:grid-cols-[1fr_180px]"><div className="space-y-4"><div><div className="mb-2 flex justify-between text-[11px]"><span className="text-emerald-200">Thành công</span><span className="font-bold text-white">{attemptStats.success}</span></div><div className="h-3 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${attemptStats.successRate}%` }} /></div></div><div><div className="mb-2 flex justify-between text-[11px]"><span className="text-rose-200">Thất bại / bỏ qua</span><span className="font-bold text-white">{attemptStats.failed}</span></div><div className="h-3 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-rose-300" style={{ width: `${attemptStats.success + attemptStats.failed ? Math.round((attemptStats.failed / (attemptStats.success + attemptStats.failed)) * 100) : 0}%` }} /></div></div></div><div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4 text-center"><p className="text-[10px] uppercase tracking-wider text-slate-500">Success rate</p><p className="mt-2 font-display text-4xl font-semibold text-cyan-200">{attemptStats.successRate}%</p><p className="mt-2 text-[10px] text-slate-600">{attemptStats.open} đang mở</p></div></div></section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
          <div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="font-display text-base font-semibold text-white">Coin claim history</p><p className="mt-1 text-[11px] text-slate-600">Latest server-recorded credits across all users.</p></div><Coins className="h-4 w-4 text-violet-200" /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[11px]"><thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="pb-3 font-semibold">User</th><th className="pb-3 font-semibold">Source</th><th className="pb-3 font-semibold">Claim key</th><th className="pb-3 text-right font-semibold">Amount</th><th className="pb-3 text-right font-semibold">Time</th></tr></thead><tbody>{data?.claims.length ? data.claims.map((claim) => <tr key={claim.id} className="border-b border-white/[0.045] last:border-0"><td className="py-3"><p className="font-semibold text-slate-200">{claim.userName || "Lumen member"}</p><p className="mt-1 text-[10px] text-slate-600">{claim.userEmail || `User #${claim.userId}`}</p></td><td className="py-3 text-slate-400">{claim.source}</td><td className="max-w-[180px] truncate py-3 font-mono text-[10px] text-slate-600">{claim.claimKey}</td><td className="py-3 text-right font-bold text-emerald-300">+{claim.amount}</td><td className="py-3 text-right text-slate-500">{formatDate(claim.createdAt)}</td></tr>) : <tr><td colSpan={5} className="py-12 text-center text-slate-600">Chưa có claim nào được ghi nhận.</td></tr>}</tbody></table></div></div>

          <div className="rounded-2xl border border-rose-300/10 bg-rose-300/[0.025] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="font-display text-base font-semibold text-white">Fraud watch</p><p className="mt-1 text-[11px] text-slate-600">Deterministic signals from reward attempts.</p></div><AlertTriangle className="h-4 w-4 text-rose-200" /></div><div className="mt-5 space-y-3">{data?.fraudSignals.length ? data.fraudSignals.map((signal) => <div key={`${signal.id}-${signal.userId}`} className="rounded-xl border border-rose-300/10 bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-200">{signal.userName}</p><p className="mt-1 truncate text-[10px] text-slate-600">{signal.userEmail || `User #${signal.userId}`}</p></div><span className={`rounded-md px-1.5 py-1 text-[9px] font-bold ${signal.completed ? "bg-amber-300/10 text-amber-200" : "bg-rose-300/10 text-rose-200"}`}>{signal.completed ? "REVIEW" : "OPEN"}</span></div><p className="mt-3 text-[10px] leading-relaxed text-rose-100/70">{signal.signal}</p><p className="mt-2 text-[10px] text-slate-600">{signal.tier} · {formatDate(signal.startedAt)}</p></div>) : <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.03] p-4 text-[11px] leading-relaxed text-emerald-100/70">No deterministic abuse signals in the recent attempt window.</div>}</div><p className="mt-5 text-[10px] leading-relaxed text-slate-600">Signals are review queues, not automatic bans. Confirm provider callbacks and account context before taking action.</p></div>
        </section>
      </main>
    </div>
  );
}
