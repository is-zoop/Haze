import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Cpu,
  ChevronRight,
  TrendingUp,
  ClipboardList,
  Search
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchHomeOverview, HomeCapabilityItem, HomeOverview } from "@/lib/home";
import { getI18n } from "../../i18n";

interface HomeProps {
  userName: string;
  setActiveMenu: (menu: any) => void;
  searchQuery?: string;
  langCode?: string;
}

export function Home({
  userName,
  setActiveMenu,
  searchQuery = "",
  langCode = "ZH"
}: HomeProps) {
  const t = getI18n(langCode);
  // Local states for search input and tabs
  const [localSearch, setLocalSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"recommend" | "latest" | "popular">("recommend");
  const [overview, setOverview] = useState<HomeOverview | null>(null);

  useEffect(() => {
    let active = true;
    fetchHomeOverview().then((data) => { if (active) setOverview(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Sync parent search query
  React.useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  // Capabilities Mock datasets formatted beautifully to display in tabs list
  const tabCapabilities = useMemo(() => {
    const source = activeTab === "recommend" ? overview?.recommended : activeTab === "latest" ? overview?.latest : overview?.popular;
    const mapped = (source || []).map((item) => ({
      ...item,
      time: item.updated_at,
      calls: String(item.calls),
      iconColor: item.type === "MCP" ? "bg-violet-50 text-violet-600 border-violet-100" : "bg-blue-50 text-blue-600 border-blue-100",
      iconComponent: item.type === "MCP" ? Cpu : Sparkles,
    }));
    const query = localSearch.toLowerCase().trim();
    return query ? mapped.filter((item) => item.name.toLowerCase().includes(query) || (item.description || "").toLowerCase().includes(query)) : mapped;
  }, [activeTab, localSearch, overview]);

  return (
    <div className="dashboard-page-stack" id="haze-home-page-container">
      <motion.div
        key="workbench-content-optimized"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="grid h-full min-h-0 grid-rows-[minmax(160px,1.2fr)_minmax(88px,0.7fr)_minmax(0,3fr)] gap-4 overflow-hidden select-text"
      >

        {/* 1. Welcoming Hero Banner / Blue-White Tech Art Jumbotron */}
        <div className="relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-xs">
          {/* Abstract Vector Backdrop Layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl select-none z-0 bg-gradient-to-r from-blue-50/95 via-sky-100/70 to-indigo-50/95">
            {/* Modern ambient geometric shapes and gradient orbs */}
            <div className="absolute top-[-25%] left-[-10%] w-[45%] h-[85%] rounded-full bg-radial from-sky-400/25 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[75%] rounded-full bg-radial from-blue-400/20 to-transparent blur-3xl" />

            {/* Low opacity abstract rolling mountain curves (vector SVGs) */}
            <svg className="absolute bottom-0 left-0 w-full h-[60%] opacity-40" viewBox="0 0 1440 320" preserveAspectRatio="none">
              <path fill="#cbdff7" fillOpacity="0.5" d="M0,192L48,181.3C96,171,192,149,288,149.3C384,149,480,171,576,192C672,213,768,235,864,213.3C960,192,1056,128,1152,122.7C1248,117,1344,171,1392,197.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
              <path fill="#aacbf3" fillOpacity="0.4" d="M0,256L60,234.7C120,213,240,171,360,176C480,181,600,235,720,245.3C840,256,960,224,1080,186.7C1200,149,1320,107,1380,85.3L1440,64L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
            </svg>

            {/* Floating glassmorphic 3D Transparent Cube */}
            <div className="absolute right-[11%] top-[12%] w-32 h-32 hidden md:block">
              <div className="absolute inset-0 rounded-2xl bg-white/20 border border-white/40 backdrop-blur-md shadow-lg transform rotate-12 -translate-y-2 translate-x-2 flex items-center justify-center">
                {/* Cube inner details */}
                <div className="w-16 h-16 rounded-lg bg-sky-200/30 border border-sky-400/35 transform -rotate-6" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-sky-400/10 via-white/5 to-white/30 border border-sky-300/30 transform -rotate-12 translate-y-3 -translate-x-3 backdrop-blur-[2px]" />
              {/* Highlight reflection */}
              <div className="absolute top-2 left-6 w-2 h-2 rounded-full bg-white/60 blur-[1px]" />
              <div className="absolute bottom-4 right-8 w-1 h-1 rounded-full bg-white/40" />
            </div>

            {/* Float Bubbles */}
            <div className="absolute right-[28%] bottom-[25%] w-10 h-10 rounded-full bg-gradient-to-tr from-blue-300/30 to-sky-100/20 backdrop-blur-xs border border-white/40 shadow-sm animate-bounce hidden md:block" style={{ animationDuration: '4s' }} />
            <div className="absolute right-[5%] top-[55%] w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs border border-white/40 shadow-xs hidden md:block" />
          </div>

          {/* Actual Header Content Layer on top of background */}
          <div className="relative z-10 w-full flex flex-col justify-between gap-6">

            {/* Upper row: Greetings and Dropdown Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
              <div className="space-y-1 text-left">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5 leading-normal">
                  {t.welcomeBack}<span>{userName}</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600/90 leading-relaxed font-normal">
                  {t.homeDesc}
                </p>
              </div>

            </div>

            {/* Lower row: Elegant Search Bar & Search Tags */}
            <div className="w-full max-w-xl text-left">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 stroke-[2px]" size={16} />
                <Input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full bg-white/95 border border-sky-200/90 pl-10 pr-9 text-xs sm:text-sm h-10 rounded-xl shadow-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/80 transition-all font-sans"
                />
                {localSearch && (
                  <button
                    onClick={() => setLocalSearch("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-semibold uppercase tracking-tight"
                  >
                    {t.searchClear}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 2. Real overview metrics */}
        <div className="grid min-h-0 w-full grid-cols-1 gap-4 overflow-auto sm:grid-cols-2 lg:grid-cols-4">
          <HomeMetric title="已发布能力" value={overview?.published.total} detail={`Skill ${overview?.published.skill ?? 0} / MCP ${overview?.published.mcp ?? 0}`} icon={<Sparkles size={18} />} tone="blue" onClick={() => setActiveMenu("market")} />
          <HomeMetric title="本周新增" value={overview?.weekly_added.current} detail={(overview?.weekly_added.difference ?? 0) === 0 ? "较上周持平" : `较上周 ${(overview?.weekly_added.difference ?? 0) > 0 ? "+" : ""}${overview?.weekly_added.difference ?? 0}`} icon={<TrendingUp size={18} />} tone="purple" onClick={() => setActiveMenu("market")} />
          <HomeMetric title="我的能力" value={overview?.my_capabilities.total} detail={overview?.my_capabilities.available ? `已发布 ${overview.my_capabilities.published ?? 0}` : "无开发权限"} icon={<Cpu size={18} />} tone="emerald" onClick={overview?.my_capabilities.available ? () => setActiveMenu("developer") : undefined} />
          <HomeMetric title="待我审核" value={overview?.audit.pending} detail={!overview?.audit.available ? "无审核权限" : overview.audit.avg_review_hours == null ? "暂无审核记录" : `平均审核时间 ${overview.audit.avg_review_hours} 小时`} icon={<ClipboardList size={18} />} tone="amber" onClick={overview?.audit.available ? () => setActiveMenu("audit") : undefined} />
        </div>

        {/* 3. Split Layout: Recommended/Latest list (Left 2/3) vs. My Workbench (Right 1/3) */}
        <div className="grid min-h-0 w-full grid-cols-1 items-stretch gap-5 overflow-hidden lg:grid-cols-3">

          {/* LEFT 2/3 CAPABILITY PANELS */}
          <div className="flex h-full min-h-0 flex-col gap-3 lg:col-span-2">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)]">

              {/* List Section Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    {t.featuredCapabilities}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveMenu("market")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-black flex items-center gap-1 cursor-pointer hover:underline transition-all group"

                >
                  <span>{t.viewAll}</span>
                  <span className="font-bold font-mono transition-transform group-hover:translate-x-0.5">&gt;</span>
                </button>
              </div>

              {/* Selection Tabs Bar */}
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/15 flex items-center gap-4">
                <button
                  onClick={() => setActiveTab("recommend")}
                  className={`text-xs font-semibold pb-1.5 pt-0.5 relative transition-colors cursor-pointer ${activeTab === "recommend" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <span>{t.recommended}</span>
                  {activeTab === "recommend" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("latest")}
                  className={`text-xs font-semibold pb-1.5 pt-0.5 relative transition-colors cursor-pointer ${activeTab === "latest" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <span>{t.latest}</span>
                  {activeTab === "latest" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("popular")}
                  className={`text-xs font-semibold pb-1.5 pt-0.5 relative transition-colors cursor-pointer ${activeTab === "popular" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <span>{t.popular}</span>
                  {activeTab === "popular" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              </div>

              {/* Tabs Content - Capabilities rendering with flat list & dividers */}
              <div className="min-h-0 flex-1 overflow-auto p-1">
                {tabCapabilities.length === 0 ? (
                  <div className="text-center py-16 text-xs text-slate-400 font-normal">
                    {t.noMatchingCapabilities}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {tabCapabilities.map((item) => {
                      const IconComp = item.iconComponent;
                      return (
                        <div key={item.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left hover:bg-slate-50/20 transition-colors">

                          {/* Left: Icon container & Metadata details */}
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 border ${item.iconColor || "bg-blue-50 text-blue-600 border-blue-100/50"}`}>
                              {item.icon ? <img src={item.icon} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <IconComp size={18} className="stroke-[2.2px]" />}
                            </div>
                            <div className="space-y-1 min-w-0 flex-1">
                              {/* Title block with badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-800 tracking-tight block truncate" title={item.name}>
                                  {item.name}
                                </span>
                                <Badge variant="outline" className="text-xs font-semibold tracking-wide py-0 px-2 uppercase bg-slate-50 text-slate-500 border-slate-200">
                                  {item.type}
                                </Badge>
                              </div>
                              {/* Short Description */}
                              <p className="text-xs text-slate-500 font-normal leading-relaxed line-clamp-1">
                                {item.description}
                              </p>
                              {/* Metadata indicators below description */}
                              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-0.5 font-normal">
                                <span className="flex items-center gap-1">{t.uploader}: <b className="text-slate-600 font-medium">{item.author}</b></span>
                                <span className="text-slate-200">|</span>
                                <span>{t.updated}: {item.time}</span>
                                <span className="text-slate-200">|</span>
                                <span>{t.calls} {item.calls} {t.times}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions, status */}
                          <div className="flex items-center gap-3.5 self-end md:self-center flex-shrink-0 pl-14 md:pl-0">
                            {/* Interactive Buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveMenu("market")}
                                className="border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg h-8 px-3 text-xs font-medium cursor-pointer"
                              >
                                {t.viewDetail}
                              </Button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* RIGHT 1/3 RETURNING USER PANELS */}
          <div className="flex min-h-0 flex-col gap-4 h-full">
            <HomeSideList title="我的收藏" items={overview?.favorites || []} emptyText="前往能力市场收藏常用能力" onView={() => setActiveMenu("market")} />
            <HomeSideList title="常用能力" items={overview?.frequent || []} emptyText="使用能力后将在这里显示" onView={() => setActiveMenu("market")} usage />
          </div>

        </div>

      </motion.div>
    </div>
  );
}

function HomeMetric({ title, value, detail, icon, tone, onClick }: { title: string; value?: number | null; detail: string; icon: React.ReactNode; tone: string; onClick?: () => void }) {
  const colors: Record<string,string> = { blue: "bg-blue-50 text-blue-600", purple: "bg-purple-50 text-purple-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  return <button type="button" disabled={!onClick} onClick={onClick} className={`flex h-full min-h-20 items-center justify-between rounded-xl border border-slate-200/60 bg-white p-4 text-left transition-all ${onClick ? "hover:bg-slate-50/50 hover:shadow-xs cursor-pointer group" : "opacity-60 cursor-not-allowed"}`}><div className="flex items-center gap-3.5"><div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colors[tone]}`}>{icon}</div><div><p className="text-xs text-slate-400 font-medium">{title}</p><p className="text-2xl font-bold text-slate-800">{value ?? "–"}</p><p className="text-xs text-slate-400">{detail}</p></div></div>{onClick && <ChevronRight size={14} className="text-slate-400" />}</button>;
}

function HomeSideList({ title, items, emptyText, onView, usage = false }: { title: string; items: HomeCapabilityItem[]; emptyText: string; onView: () => void; usage?: boolean }) {
  return <div className="flex min-h-0 flex-1 flex-col bg-white border border-slate-200/60 rounded-xl overflow-hidden text-left"><div className="p-4 border-b border-slate-100 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800">{title}</h3><button onClick={onView} className="text-xs text-blue-600 font-semibold">查看全部 &gt;</button></div>{items.length === 0 ? <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-400">{emptyText}</div> : <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">{items.map((item) => <div key={item.id} className="p-3 flex items-center gap-3"><div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden ${item.type === "MCP" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}>{item.icon ? <img src={item.icon} alt="" className="h-9 w-9 object-cover" /> : item.type === "MCP" ? <Cpu size={16} /> : <Sparkles size={16} />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-800 truncate">{item.name}</span><Badge variant="secondary" className="h-5 px-1.5 text-xs">{item.type}</Badge></div><p className="text-xs text-slate-400">{usage ? `使用 ${item.use_count ?? 0} 次` : `调用 ${item.calls} 次`}</p></div><Button variant="outline" size="sm" onClick={onView} className="h-7 px-2 text-xs">查看详情</Button></div>)}</div>}</div>;
}
