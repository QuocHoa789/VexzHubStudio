import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Coins,
  Command,
  ExternalLink,
  Gift,
  History,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Loader2,
  LogOut,
  Trophy,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { COIN_REWARD, LINK_WAIT_SECONDS, REWARD_TIERS } from "@/lib/rewards";
import type { RewardTier } from "@shared/rewards";
import { trpc } from "@/lib/trpc";

type MissionStatus = "ready" | "opened" | "claimed" | "locked";

type Mission = {
  id: string;
  tier: RewardTier;
  title: string;
  description: string;
  reward: number;
  icon: typeof ExternalLink;
  tone: "violet" | "cyan" | "amber";
  status: MissionStatus;
};

type Claim = {
  id: number;
  title: string;
  reward: number;
  time: string;
};

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Earn coins", icon: Coins },
  { label: "Missions", icon: Target },
  { label: "History", icon: History },
  { label: "Leaderboard", icon: Trophy },
];

const secondaryNavItems = [
  { label: "Rewards", icon: Gift },
  { label: "Settings", icon: Settings2 },
];

const missions: Mission[] = [
  {
    id: "link4sub-level1",
    tier: "level1",
    title: "Link4Sub · Cấp 1",
    description: "Nút link riêng 1 · hoàn tất trang đối tác rồi quay lại bằng redirect.",
    reward: REWARD_TIERS.level1.reward,
    icon: ExternalLink,
    tone: "violet",
    status: "ready",
  },
  {
    id: "link4sub-level2",
    tier: "level2",
    title: "Link4Sub · Cấp 2",
    description: "Nút link riêng 2 · hoàn tất trang đối tác rồi quay lại bằng redirect.",
    reward: REWARD_TIERS.level2.reward,
    icon: Target,
    tone: "cyan",
    status: "ready",
  },
  {
    id: "link4m",
    tier: "link4m",
    title: "Link4M · nhiệm vụ riêng",
    description: "Nút Link4M riêng · chỉ nhận coin sau callback quay lại hợp lệ.",
    reward: REWARD_TIERS.link4m.reward,
    icon: Gift,
    tone: "amber",
    status: "ready",
  },
  {
    id: "layma",
    tier: "layma",
    title: "Layma · nhiệm vụ riêng",
    description: "Hoàn tất nhiệm vụ Layma rồi quay lại để tự động cộng coin.",
    reward: REWARD_TIERS.layma.reward,
    icon: Gift,
    tone: "amber",
    status: "ready",
  },
];

function formatCoins(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const displayName = user?.name || "Lumen member";
  const firstName = displayName.split(" ")[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  const utils = trpc.useUtils();
  const leaderboardInput = useMemo(() => ({ limit: 50 }), []);
  const rewardsQuery = trpc.rewards.dashboard.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const leaderboardQuery = trpc.rewards.leaderboard.useQuery(leaderboardInput, { enabled: Boolean(user), retry: false });
  const startAttemptMutation = trpc.rewards.startAttempt.useMutation();
  const markReturnedMutation = trpc.rewards.markReturned.useMutation();
  const cancelAttemptMutation = trpc.rewards.cancelAttempt.useMutation();
  const completeAttemptMutation = trpc.rewards.completeAttempt.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [coins, setCoins] = useState(() => {
    return 0;
  });
  const [missionState, setMissionState] = useState<Record<string, MissionStatus>>(() => {
    return {};
  });
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [hasReturned, setHasReturned] = useState(false);
  const leftPageRef = useRef(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<RewardTier>("level1");
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [coinPopup, setCoinPopup] = useState<{ amount: number; label: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    const username = authUsername.trim();
    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setAuthError("Tên đăng nhập cần ít nhất 3 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthError(`Mật khẩu hiện có ${authPassword.length} ký tự; cần ít nhất 8 ký tự.`);
      return;
    }
    const mutation = authMode === "signup" ? signupMutation : loginMutation;
    const input = authMode === "signup"
      ? { name: authName.trim(), username, password: authPassword }
      : { username, password: authPassword };
    mutation.mutate(input as never, {
      onSuccess: (result: any) => {
        if (result.ok) window.location.reload();
        else if (result.reason === "username_exists") setAuthError("Tên đăng nhập đã tồn tại.");
        else if (result.reason === "database_unavailable") setAuthError("Server chưa kết nối database hoặc chưa chạy migration username.");
        else setAuthError("Tên đăng nhập hoặc mật khẩu không đúng.");
      },
      onError: (error) => setAuthError(error.message || "Không thể kết nối máy chủ. Vui lòng thử lại.")
    });
  };
  const [cooldowns, setCooldowns] = useState<Record<RewardTier, number>>({ level1: 0, level2: 0, link4m: 0, layma: 0 });

  useEffect(() => {
    if (!user?.id) return;
    const queryToken = new URLSearchParams(window.location.search).get("reward_token");
    let saved: { token: string; tier: RewardTier; startedAt: number } | null = null;
    const stored = window.sessionStorage.getItem(`lumen:reward-attempt:${user.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string; tier: RewardTier; startedAt: number };
        if (parsed.token && REWARD_TIERS[parsed.tier]) saved = parsed;
      } catch {
        window.sessionStorage.removeItem(`lumen:reward-attempt:${user.id}`);
      }
    }
    // Chỉ token do đối tác redirect về trên URL mới được coi là callback hợp lệ.
    // Không dùng token trong sessionStorage làm fallback vì như vậy chỉ cần quay lại tab
    // cũng có thể bị ghi nhận nhầm là đã vượt link.
    const returnedToken = queryToken;
    if (!returnedToken) return;
    const returnedTier = saved?.tier ?? selectedTier;
    markReturnedMutation.mutate({ token: returnedToken }, {
      onSuccess: (result) => {
        if (!result.returned) {
          setClaimError("Chưa có xác nhận thành công từ đối tác. Coin chỉ được cộng khi Link4Sub/Link4M/Layma gửi callback hợp lệ.");
          return;
        }
        if (result.returned) {
          setHasReturned(true);
          setSelectedTier(returnedTier);
          if ("accepted" in result && result.accepted) {
            setCoins(result.balance);
            if (result.claimed) setClaims((current) => [{ id: Date.now(), title: REWARD_TIERS[returnedTier].label, reward: result.reward ?? REWARD_TIERS[returnedTier].reward, time: "Just now" }, ...current]);
            if (result.claimed) {
              setCoinPopup({ amount: result.reward ?? REWARD_TIERS[returnedTier].reward, label: REWARD_TIERS[returnedTier].label });
              window.setTimeout(() => setCoinPopup(null), 4500);
            }
            setMissionState((current) => ({ ...current, [returnedTier === "link4m" ? "link4m" : `link4sub-${returnedTier}`]: "claimed" }));
            setActiveMissionId(null);
            setAttemptToken(null);
            window.sessionStorage.removeItem(`lumen:reward-attempt:${user.id}`);
            void Promise.all([utils.rewards.dashboard.invalidate(), utils.rewards.leaderboard.invalidate()]);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      },
    });
  }, [markReturnedMutation, selectedTier, user, utils]);

  useEffect(() => {
    if (!rewardsQuery.data) return;
    setCoins(rewardsQuery.data.balance);
    setClaims(rewardsQuery.data.transactions.map((transaction) => ({
      id: transaction.id,
      title: transaction.source === "link4m" ? "Link4M · nhiệm vụ riêng" : `Link4Sub · ${transaction.source}`,
      reward: transaction.amount,
      time: new Date(transaction.createdAt).toLocaleString(),
    })));
    setMissionState((current) => Object.fromEntries(missions.map((mission) => [mission.id, rewardsQuery.data.todayClaimedByTier[mission.tier] ? "claimed" : (current[mission.id] === "opened" ? "opened" : "ready")])) as Record<string, MissionStatus>);
  }, [rewardsQuery.data, selectedTier]);

  useEffect(() => {
    if (!activeMissionId || countdown <= 0) return;
    const timerId = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timerId);
  }, [activeMissionId, countdown]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCooldowns((current) => {
        const now = Date.now();
        let changed = false;
        const next = { ...current } as Record<RewardTier, number>;
        (Object.keys(next) as RewardTier[]).forEach((tier) => {
          if (next[tier] > 0 && next[tier] <= now) {
            next[tier] = 0;
            changed = true;
          }
        });
        return changed ? next : current;
      });
    }, 500);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const stored = window.sessionStorage.getItem(`lumen:reward-attempt:${user.id}`);
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as { token: string; tier: RewardTier; startedAt: number };
      if (!saved.token || !REWARD_TIERS[saved.tier]) return;
      const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
      setSelectedTier(saved.tier);
      setAttemptToken(saved.token);
      setActiveMissionId(saved.tier === "link4m" ? "link4m" : `link4sub-${saved.tier}`);
      setMissionState((current) => ({ ...current, [saved.tier === "link4m" ? "link4m" : `link4sub-${saved.tier}`]: "opened" }));
      setHasReturned(false);
      setCountdown(Math.max(0, REWARD_TIERS[saved.tier].waitSeconds - elapsed));
    } catch {
      window.sessionStorage.removeItem(`lumen:reward-attempt:${user.id}`);
    }
  }, [user?.id]);

  const availableCoins = (Object.keys(REWARD_TIERS) as RewardTier[]).reduce((total, tier) => total + Math.max(0, 4 - (rewardsQuery.data?.todayClaimsByTier[tier] ?? 0)) * REWARD_TIERS[tier].reward, 0);
  const claimedCount = rewardsQuery.data?.totalClaims ?? 0;
  const totalEarned = rewardsQuery.data?.totalEarned ?? 0;

  const selectNav = (label: string) => {
    setActiveNav(label);
    setMobileNavOpen(false);
    if (label === "Leaderboard") {
      window.setTimeout(() => document.getElementById("leaderboard-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  const completeAttempt = useCallback(() => {
    if (!attemptToken || !activeMissionId) return;
    setClaimError(null);
    completeAttemptMutation.mutate({ token: attemptToken }, {
      onSuccess: async (result) => {
        if (result.reason === "too_early") {
          setCountdown(result.retryAfterSeconds ?? 1);
          setClaimError("Chưa đủ thời gian tối thiểu. Hãy chờ hết bộ đếm rồi bấm Claim reward.");
          return;
        }
        if (result.reason === "not_returned") {
          setClaimError("Bạn chưa hoàn tất link và quay lại từ trang đối tác. Hãy mở đúng nút link này rồi thử lại.");
          return;
        }
        if (!result.accepted) {
          setClaimError("Không thể xác minh attempt này. Hãy mở đúng nút link và quay lại sau khi hoàn thành.");
          return;
        }
        setCoins(result.balance);
        setMissionState((current) => ({ ...current, [activeMissionId]: "claimed" }));
        if (result.claimed) setClaims((current) => [{ id: Date.now(), title: REWARD_TIERS[selectedTier].label, reward: result.reward ?? REWARD_TIERS[selectedTier].reward, time: "Just now" }, ...current]);
        if (result.claimed) {
          setCoinPopup({ amount: result.reward ?? REWARD_TIERS[selectedTier].reward, label: REWARD_TIERS[selectedTier].label });
          window.setTimeout(() => setCoinPopup(null), 4500);
        }
        setActiveMissionId(null);
        setAttemptToken(null);
        window.sessionStorage.removeItem(`lumen:reward-attempt:${user?.id}`);
        await Promise.all([utils.rewards.dashboard.invalidate(), utils.rewards.leaderboard.invalidate()]);
      },
      onError: () => setClaimError("Không thể xác minh kết nối. Hãy thử lại sau.") ,
    });
  }, [activeMissionId, attemptToken, completeAttemptMutation, hasReturned, selectedTier, user?.id, utils]);

  useEffect(() => {
    const markAway = () => {
      if (activeMissionId) leftPageRef.current = true;
    };
    const markReturned = () => {
      if (!document.hidden && leftPageRef.current) setHasReturned(true);
      if (!document.hidden && activeMissionId) void rewardsQuery.refetch();
    };
    window.addEventListener("blur", markAway);
    window.addEventListener("focus", markReturned);
    document.addEventListener("visibilitychange", markReturned);
    return () => {
      window.removeEventListener("blur", markAway);
      window.removeEventListener("focus", markReturned);
      document.removeEventListener("visibilitychange", markReturned);
    };
  }, [activeMissionId, rewardsQuery]);

  useEffect(() => {
    const preventInspectorShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === "F12" || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) || (event.ctrlKey && key === "u")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("keydown", preventInspectorShortcuts, true);
    document.addEventListener("contextmenu", preventContextMenu, true);
    return () => {
      document.removeEventListener("keydown", preventInspectorShortcuts, true);
      document.removeEventListener("contextmenu", preventContextMenu, true);
    };
  }, []);

  const cooldownSeconds = (tier: RewardTier) => Math.ceil(Math.max(0, (cooldowns[tier] ?? 0) - Date.now()) / 1000);

  const handleStartMission = (mission: Mission) => {
    if (rewardsQuery.data?.todayClaimedByTier[mission.tier] || startAttemptMutation.isPending || activeMissionId || cooldownSeconds(mission.tier) > 0) return;
    setClaimError(null);
    setHasReturned(false);
    leftPageRef.current = false;
    startAttemptMutation.mutate({ tier: mission.tier }, {
      onSuccess: (attempt) => {
        setAttemptToken(attempt.token);
        setMissionState((current) => ({ ...current, [mission.id]: "opened" }));
        setSelectedTier(attempt.tier);
        setActiveMissionId(mission.id);
        setCountdown(REWARD_TIERS[attempt.tier].waitSeconds);
        window.sessionStorage.setItem(`lumen:reward-attempt:${user?.id}`, JSON.stringify({ token: attempt.token, tier: attempt.tier, startedAt: Date.now() }));
        window.location.assign(attempt.url);
      },
      onError: () => {
        setClaimError("Không thể tạo attempt. Hãy thử lại sau.");
      },
    });
  };

  const handleClaimMission = (mission: Mission) => {
    if (missionState[mission.id] !== "opened" || countdown > 0) return;
    completeAttempt();
  };

  const handleFailedMission = () => {
    if (!activeMissionId || !selectedTier) return;
    if (attemptToken) void cancelAttemptMutation.mutateAsync({ token: attemptToken });
    setCooldowns((current) => ({ ...current, [selectedTier]: Date.now() + 10_000 }));
    setClaimError("Link này chưa vượt thành công. Đã cooldown 10 giây; bạn có thể tiếp tục 2 link còn lại.");
    setMissionState((current) => ({ ...current, [activeMissionId]: "ready" }));
    setActiveMissionId(null);
    setAttemptToken(null);
    window.sessionStorage.removeItem(`lumen:reward-attempt:${user?.id}`);
  };


  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08090d] text-violet-200"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!user) {
    return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08090d] px-5 text-slate-100"><div className="pointer-events-none absolute inset-0"><div className="aurora aurora-violet" /><div className="aurora aurora-cyan" /><div className="grid-noise absolute inset-0 opacity-[0.025]" /></div><div className="relative w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#111219]/90 p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-9"><div className="flex items-center gap-3"><div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-[#0b0c11]"><Sparkles className="h-5 w-5 fill-current" /></div><div><p className="font-display text-base font-bold text-white">lumen</p><p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">rewards system</p></div></div><div className="mt-10"><p className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Private rewards workspace</p><h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Make every action count<span className="text-violet-300">.</span></h1><p className="mt-3 text-sm leading-relaxed text-slate-500">Đăng nhập để nhận coin và theo dõi lịch sử nhiệm vụ.</p></div><div className="mt-8 space-y-3"><div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1"><button onClick={() => setAuthMode("login")} className={`flex-1 rounded-lg py-2 text-[11px] font-semibold ${authMode === "login" ? "bg-violet-300 text-[#14111e]" : "text-slate-500"}`}>Đăng nhập</button><button onClick={() => setAuthMode("signup")} className={`flex-1 rounded-lg py-2 text-[11px] font-semibold ${authMode === "signup" ? "bg-violet-300 text-[#14111e]" : "text-slate-500"}`}>Đăng ký</button></div><form onSubmit={handleAuth} className="space-y-2">{authMode === "signup" && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Họ tên" required className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600" />}<input type="text" value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} placeholder="Tên đăng nhập" minLength={3} pattern="[A-Za-z0-9_]+" required className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600" /><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Mật khẩu (tối thiểu 8 ký tự)" minLength={8} required className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600" />{authError && <p className="text-[10px] text-rose-300">{authError}</p>}<button type="submit" className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-300 text-[12px] font-bold text-[#14111e] hover:bg-violet-200">{authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button></form></div><p className="mt-6 text-center text-[10px] leading-relaxed text-slate-600">Tài khoản local: tên đăng nhập và mật khẩu được hash bảo mật trên máy chủ.</p></div></div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08090d] text-slate-100 selection:bg-violet-400/30">
      {coinPopup && <div className="fixed right-5 top-5 z-[80] flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#10251f] px-4 py-3 shadow-2xl shadow-emerald-950/40"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300 text-[#07130f]"><Coins className="h-4 w-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Coin added</p><p className="mt-0.5 text-sm font-bold text-white">+{coinPopup.amount} coins · {coinPopup.label}</p></div><button onClick={() => setCoinPopup(null)} className="ml-2 text-slate-500 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button></div>}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="aurora aurora-violet" />
        <div className="aurora aurora-cyan" />
        <div className="grid-noise absolute inset-0 opacity-[0.025]" />
      </div>

      {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[256px] flex-col border-r border-white/[0.07] bg-[#0b0c11]/95 px-4 py-5 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#0b0c11] shadow-[0_8px_22px_rgba(255,255,255,0.14)]"><Sparkles className="h-[18px] w-[18px] fill-current" strokeWidth={1.8} /></div>
            <div><p className="font-display text-[15px] font-bold tracking-[-0.03em] text-white">lumen</p><p className="mt-[-2px] text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">rewards system</p></div>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;
            return <button key={item.label} onClick={() => selectNav(item.label)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 ${isActive ? "nav-active text-white" : "text-slate-500 hover:bg-white/[0.045] hover:text-slate-200"}`}><Icon className={`h-[17px] w-[17px] transition-colors ${isActive ? "text-violet-300" : "text-slate-600 group-hover:text-slate-300"}`} strokeWidth={1.8} /><span className="truncate">{item.label}</span>{item.label === "Earn coins" && <span className="ml-auto rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">+{availableCoins}</span>}</button>;
          })}
        </nav>

          <div className="mt-9 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Manage</div>
        <nav className="mt-3 space-y-1">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;
            return <button key={item.label} onClick={() => selectNav(item.label)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 ${isActive ? "nav-active text-white" : "text-slate-500 hover:bg-white/[0.045] hover:text-slate-200"}`}><Icon className={`h-[17px] w-[17px] ${isActive ? "text-violet-300" : "text-slate-600 group-hover:text-slate-300"}`} strokeWidth={1.8} /><span>{item.label}</span></button>;
          })}
          </nav>
          {user.role === "admin" && <a href="/admin" className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 transition-all hover:bg-white/[0.045] hover:text-slate-200"><ShieldCheck className="h-[17px] w-[17px] text-slate-600" strokeWidth={1.8} /><span>Admin control</span></a>}

        <div className="mt-auto">
          <div className="mb-5 rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.14] to-cyan-400/[0.05] p-4">
            <div className="mb-3 flex items-center justify-between"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/15 text-violet-300"><Coins className="h-3.5 w-3.5" /></div><span className="text-[10px] font-semibold text-violet-200/60">YOUR BALANCE</span></div>
            <p className="text-[12px] font-semibold text-white">{formatCoins(coins)} coins</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Balance from verified server claims.</p><span className="mt-3 block text-[11px] font-semibold text-violet-200/70">Synced from database</span>
          </div>
          <div className="flex items-center gap-3 border-t border-white/[0.07] px-2 pt-4"><div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-cyan-300 text-[11px] font-bold text-[#0c0c11]">{initials}<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0b0c11] bg-emerald-400" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-slate-200">{displayName}</p><p className="truncate text-[11px] text-slate-600">Member · Lumen Labs</p></div><MoreHorizontal className="h-4 w-4 text-slate-600" /></div>
        </div>
      </aside>

      <main className="relative z-10 min-h-screen lg:pl-[256px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08090d]/75 backdrop-blur-2xl">
          <div className="flex h-[72px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-10">
            <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-slate-400 hover:bg-white/[0.07] hover:text-white lg:hidden" aria-label="Open navigation"><Menu className="h-4 w-4" /></button><div className="hidden items-center gap-2 text-[12px] text-slate-600 sm:flex"><span>Workspace</span><span className="text-slate-700">/</span><span className="text-slate-300">{activeNav}</span></div><div className="sm:hidden"><p className="font-display text-sm font-semibold text-white">{activeNav}</p></div></div>
            <div className="flex items-center gap-2 sm:gap-3">
              <label className={`h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-slate-500 transition-colors focus-within:border-violet-400/40 focus-within:bg-white/[0.05] ${searchOpen ? "flex w-[180px]" : "hidden md:flex md:w-[220px]"}`}><Search className="h-3.5 w-3.5" /><input className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600" placeholder="Search missions..." /><span className="hidden items-center gap-0.5 text-[9px] text-slate-600 lg:flex"><Command className="h-3 w-3" />K</span></label>
              <button onClick={() => setSearchOpen((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 transition-all hover:bg-white/[0.07] hover:text-white md:hidden" aria-label="Search"><Search className="h-4 w-4" /></button>
              <div className="relative"><button onClick={() => setNotificationsOpen((value) => !value)} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 transition-all hover:bg-white/[0.07] hover:text-white" aria-label="Notifications"><Bell className="h-4 w-4" strokeWidth={1.8} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" /></button>{notificationsOpen && <div className="absolute right-0 top-12 w-72 rounded-2xl border border-white/[0.1] bg-[#13141b] p-4 shadow-2xl shadow-black/30"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Rewards inbox</p><span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">2 new</span></div><p className="mt-3 text-[11px] leading-relaxed text-slate-500">Your daily bonus is waiting. Keep your streak going to unlock a multiplier.</p><button onClick={() => setNotificationsOpen(false)} className="mt-3 text-[11px] font-semibold text-violet-300 hover:text-white">Mark as read</button></div>}</div>
              <div className="hidden h-7 w-px bg-white/[0.08] sm:block" /><button onClick={() => logout()} className="hidden items-center gap-2 text-left sm:flex" title="Log out"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-cyan-300 text-[10px] font-bold text-[#0c0c11]">{initials}</div><ChevronDown className="h-3.5 w-3.5 text-slate-600" /></button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 xl:px-10">
          <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Rewards system online <span className="text-slate-700">·</span> Synced just now</div><h1 className="font-display text-[29px] font-semibold tracking-[-0.045em] text-white sm:text-[34px]">Good afternoon, {firstName}<span className="text-violet-300">.</span></h1><p className="mt-2 text-[13px] text-slate-500">Turn small actions into momentum.</p></div><div className="flex items-center gap-2"><span className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3.5 py-2.5 text-[11px] font-semibold text-emerald-200">Live account data</span></div></section>

          <section className="mt-8 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
            <div className="relative overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.16] via-white/[0.04] to-cyan-300/[0.05] p-6 sm:p-7"><div className="coin-halo" /><div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-[11px] font-semibold text-violet-200"><Coins className="h-3.5 w-3.5" /> Available balance</div><div className="mt-3 flex items-baseline gap-3"><span className="font-display text-[42px] font-semibold tracking-[-0.06em] text-white sm:text-[48px]">{formatCoins(coins)}</span><span className="text-sm font-semibold text-violet-200/70">coins</span></div><p className="mt-2 text-[11px] text-slate-500">Keep collecting to unlock your next reward.</p></div><span className="rounded-xl border border-white/[0.1] bg-white/[0.035] px-3.5 py-2.5 text-[11px] font-semibold text-slate-400">Persistent balance</span></div></div>
            <div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-6"><div className="flex items-start justify-between"><div><p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">Your progress</p><p className="mt-1.5 text-[11px] text-slate-600">A little every day adds up.</p></div><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-200"><Zap className="h-4 w-4 fill-current" /></div></div><div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.07]"><div className="pr-3"><p className="font-display text-xl font-semibold text-white">{formatCoins(totalEarned)}</p><p className="mt-1 text-[10px] text-slate-600">total earned</p></div><div className="px-3"><p className="font-display text-xl font-semibold text-white">{claimedCount}</p><p className="mt-1 text-[10px] text-slate-600">total claims</p></div><div className="pl-3"><p className="font-display text-xl font-semibold text-white">+{formatCoins(availableCoins)}</p><p className="mt-1 text-[10px] text-slate-600">up for grabs</p></div></div><div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[10px] text-slate-500"><span>Live database metrics</span><span className="font-semibold text-violet-200">{formatCoins(coins)} balance</span></div></div>
          </section>

          <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
            <div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">Today’s missions</p><span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{missions.length} available</span></div><p className="mt-1.5 text-[11px] text-slate-600">Complete simple actions and collect coins automatically.</p></div><button onClick={() => setActivityExpanded((value) => !value)} className="text-[11px] font-semibold text-violet-300 transition-colors hover:text-white">{activityExpanded ? "Show less" : "View rules"}</button></div>{activityExpanded && <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-300/[0.04] p-3 text-[11px] leading-relaxed text-slate-400"><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-violet-300" /> Open the partner link, complete the short step, return here, and coins will be added automatically.</div>}{claimError && <p className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-2 text-[10px] text-rose-200">{claimError}</p>}{activeMissionId && countdown === 0 && <button onClick={handleFailedMission} className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2 text-[10px] font-semibold text-amber-200 hover:bg-amber-300/[0.1]">Link không thành công? Bỏ qua link này trong 10 giây</button>}<div className="mt-5 space-y-2">{missions.map((mission) => {const Icon = mission.icon; const status = missionState[mission.id] ?? mission.status; const isActive = mission.id === activeMissionId; const isWaiting = status === "opened" && isActive && countdown > 0; return <div key={mission.id} className={`group flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-200 sm:flex-row sm:items-center ${status === "claimed" ? "border-emerald-300/10 bg-emerald-300/[0.025]" : isActive ? "border-white/[0.1] bg-white/[0.035]" : "border-white/[0.06] bg-white/[0.018]"}`}><div className={`mission-icon mission-${mission.tone}`}><Icon className="h-4 w-4" strokeWidth={1.8} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[12px] font-semibold text-white">{mission.title}</p>{status === "claimed" && <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">DONE</span>}</div><p className="mt-1 text-[10px] text-slate-600">{mission.description}</p></div><div className="flex flex-wrap items-center gap-2 sm:ml-auto"><span className="whitespace-nowrap text-[11px] font-bold text-violet-200">+{mission.reward} <span className="font-medium text-slate-600">coins</span><span className="ml-2 rounded-md bg-cyan-300/10 px-1.5 py-1 text-[9px] font-semibold text-cyan-200">Còn {Math.max(0, 4 - (rewardsQuery.data?.todayClaimsByTier[mission.tier] ?? 0))}/4 lượt</span></span>{status === "claimed" ? <span className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-400/10 px-3 text-[10px] font-bold text-emerald-300"><Check className="h-3.5 w-3.5" /> Auto credited</span> : status === "opened" && !isWaiting ? <span className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 text-[10px] font-semibold text-amber-200"><TimerReset className="h-3.5 w-3.5" /> Return to auto-credit</span> : <button onClick={() => handleStartMission(mission)} disabled={Boolean(activeMissionId) || isWaiting} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-bold transition-all ${activeMissionId || isWaiting ? "border border-white/[0.08] bg-white/[0.03] text-slate-600" : "bg-white text-[#0c0d12] hover:bg-violet-100"}`}>{isWaiting ? <><TimerReset className="h-3.5 w-3.5 animate-pulse" /> Wait {countdown}s</> : <><ExternalLink className="h-3.5 w-3.5" /> Open link</>}</button>}</div></div>;})}</div></div>

            <div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">Claim history</p><p className="mt-1.5 text-[11px] text-slate-600">Your latest coin activity</p></div><History className="h-4 w-4 text-slate-600" /></div><div className="mt-5 divide-y divide-white/[0.055]">{claims.slice(0, 4).map((claim) => <div key={claim.id} className="flex items-center gap-3 py-3 first:pt-0"><div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-violet-400/10 text-violet-300"><Coins className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-300">{claim.title}</p><p className="mt-1 text-[10px] text-slate-600">{claim.time}</p></div><span className="text-[11px] font-bold text-emerald-300">+{claim.reward}</span></div>)}</div><button onClick={() => selectNav("History")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-2.5 text-[10px] font-semibold text-slate-500 transition-all hover:border-violet-300/25 hover:bg-violet-300/[0.04] hover:text-violet-200"><History className="h-3 w-3" /> View full history</button></div>
          </section>

          <section className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5"><div className="flex items-start justify-between"><div><p className="font-display text-[14px] font-semibold text-white">Total earned</p><p className="mt-1.5 text-[11px] text-slate-600">All verified rewards for this account.</p></div><Coins className="h-4 w-4 text-violet-300" /></div><p className="mt-6 font-display text-[28px] font-semibold tracking-[-0.05em] text-white">{formatCoins(totalEarned)} <span className="text-sm font-medium text-slate-600">coins</span></p></div><div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5"><div className="flex items-start justify-between"><div><p className="font-display text-[14px] font-semibold text-white">Total claims</p><p className="mt-1.5 text-[11px] text-slate-600">Successful claims recorded server-side.</p></div><History className="h-4 w-4 text-cyan-300" /></div><p className="mt-6 font-display text-[28px] font-semibold tracking-[-0.05em] text-white">{formatCoins(claimedCount)}</p></div><div className="rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5"><div className="flex items-start justify-between"><div><p className="font-display text-[14px] font-semibold text-white">Account status</p><p className="mt-1.5 text-[11px] text-slate-600">Current authenticated workspace.</p></div><ShieldCheck className="h-4 w-4 text-emerald-300" /></div><div className="mt-6 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><Check className="h-4 w-4" /></div><div><p className="text-[12px] font-semibold text-white">Verified account</p><p className="mt-1 truncate text-[10px] text-slate-600">{user.email || "Authenticated with Manus"}</p></div></div></div></section>

          <section id="leaderboard-section" className="mt-3 scroll-mt-24 rounded-2xl border border-white/[0.075] bg-white/[0.032] p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">Leaderboard</p><span className="rounded-md bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">Verified coins</span></div><p className="mt-1.5 text-[11px] text-slate-600">See who is building the most momentum this month.</p></div><Trophy className="h-4 w-4 text-amber-300" /></div><div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06]">{leaderboardQuery.isLoading ? <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading rankings...</div> : leaderboardQuery.data?.length ? leaderboardQuery.data.map((entry) => <div key={entry.id} className={`flex items-center gap-3 border-b border-white/[0.055] px-4 py-3 last:border-0 ${entry.id === user?.id ? "bg-violet-300/[0.07]" : "bg-transparent"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${entry.rank === 1 ? "bg-amber-300/15 text-amber-200" : entry.rank === 2 ? "bg-slate-300/15 text-slate-200" : entry.rank === 3 ? "bg-orange-300/15 text-orange-200" : "bg-white/[0.05] text-slate-500"}`}>{entry.rank}</span><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-300/80 to-cyan-300/80 text-[10px] font-bold text-[#0c0d12]">{entry.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-200">{entry.name}{entry.id === user?.id && <span className="ml-2 rounded-md bg-violet-300/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">YOU</span>}</p><p className="mt-1 text-[10px] text-slate-600">Momentum member</p></div><span className="text-[12px] font-bold text-violet-200">{formatCoins(entry.coinBalance)} <span className="text-[10px] font-medium text-slate-600">coins</span></span></div>) : <div className="flex flex-col items-center justify-center gap-2 py-10 text-center"><Trophy className="h-5 w-5 text-slate-600" /><p className="text-[11px] font-semibold text-slate-400">No rankings yet</p><p className="text-[10px] text-slate-600">Be the first to earn verified coins.</p></div>}</div></section>

          <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] py-5 text-[10px] text-slate-700 sm:flex-row"><span>© 2024 Lumen Labs · Make progress count</span><div className="flex items-center gap-4"><button className="flex items-center gap-1.5 hover:text-slate-400"><CircleHelp className="h-3.5 w-3.5" /> Help center</button><button className="flex items-center gap-1.5 hover:text-slate-400"><Inbox className="h-3.5 w-3.5" /> Feedback</button><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Secure rewards</span></div></footer>
        </div>
      </main>
    </div>
  );
}
