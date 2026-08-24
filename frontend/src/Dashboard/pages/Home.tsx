import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Cpu,
  ChevronRight,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHomeOverview, HomeCapabilityItem, HomeOverview } from "@/lib/home";
import { getI18n } from "../../i18n";
import { CapabilityIcon } from "@/components/common/CapabilityIcon";

const bannerImage = new URL("../../assets/images/banner.png", import.meta.url).href;
const publishedIcon = new URL("../../assets/images/magic_wand.png", import.meta.url).href;
const weeklyIncreaseIcon = new URL("../../assets/images/weekly_increase.png", import.meta.url).href;
const myCapabilityIcon = new URL("../../assets/images/my_capability.png", import.meta.url).href;
const auditIcon = new URL("../../assets/images/Audit.png", import.meta.url).href;

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchHomeOverview()
      .then((data) => { if (active) setOverview(data); })
      .catch(() => {})
      .finally(() => { if (active) setIsLoading(false); });
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
      <div
        className="grid h-full min-h-0 grid-rows-[minmax(160px,1.2fr)_minmax(88px,0.7fr)_minmax(0,3fr)] gap-4 overflow-hidden select-text"
      >

        {/* 1. Welcoming Hero Banner / Blue-White Tech Art Jumbotron */}
        <div className="relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-xs">
          <div className="absolute inset-0 overflow-hidden rounded-2xl bg-slate-100 select-none z-0">
            <img src={bannerImage} alt="" className="h-full w-full object-cover object-center" />

          </div>
          {/* Actual Header Content Layer on top of background */}
          <div className="relative z-10 w-full flex flex-col justify-between gap-6">

            {/* Upper row: Greetings and Dropdown Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
              <div className="space-y-1 text-left">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-normal">
                  {t.welcomeBack}<span>{userName}</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-900 leading-relaxed font-normal">
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
                  className="w-full bg-white/95 border border-slate-300 pl-10 pr-9 text-xs sm:text-sm h-10 rounded-xl shadow-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition-all font-sans"
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
          <HomeMetric title="已发布能力" value={overview?.published.total} detail={`Skill ${overview?.published.skill ?? 0} / MCP ${overview?.published.mcp ?? 0}`} icon={<img src={publishedIcon} alt="" className="h-14 w-14 object-contain" />} onClick={() => setActiveMenu("market")} />
          <HomeMetric title="本周新增" value={overview?.weekly_added.current} detail={(overview?.weekly_added.difference ?? 0) === 0 ? "较上周持平" : `较上周 ${(overview?.weekly_added.difference ?? 0) > 0 ? "+" : ""}${overview?.weekly_added.difference ?? 0}`} icon={<img src={weeklyIncreaseIcon} alt="" className="h-14 w-14 object-contain" />} onClick={() => setActiveMenu("market")} />
          <HomeMetric title="我的能力" value={overview?.my_capabilities.total} detail={overview?.my_capabilities.available ? `已发布 ${overview.my_capabilities.published ?? 0}` : "无开发权限"} icon={<img src={myCapabilityIcon} alt="" className="h-14 w-14 object-contain" />} onClick={overview?.my_capabilities.available ? () => setActiveMenu("developer") : undefined} />
          <HomeMetric title="待我审核" value={overview?.audit.pending} detail={!overview?.audit.available ? "无审核权限" : overview.audit.avg_review_hours == null ? "暂无审核记录" : `平均审核时间 ${overview.audit.avg_review_hours} 小时`} icon={<img src={auditIcon} alt="" className="h-14 w-14 object-contain" />} onClick={overview?.audit.available ? () => setActiveMenu("audit") : undefined} />
        </div>

        {/* 3. Split Layout: Recommended/Latest list (Left 2/3) vs. My Workbench (Right 1/3) */}
        <div className="grid min-h-0 w-full grid-cols-1 items-stretch gap-5 overflow-hidden lg:grid-cols-3">

          {/* LEFT 2/3 CAPABILITY PANELS */}
          <div className="flex h-full min-h-0 flex-col gap-3 lg:col-span-2">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center rounded-xl bg-slate-100/80 p-1">
                  <button
                    onClick={() => setActiveTab("recommend")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "recommend" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {t.recommended}
                  </button>
                  <button
                    onClick={() => setActiveTab("latest")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "latest" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {t.latest}
                  </button>
                  <button
                    onClick={() => setActiveTab("popular")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "popular" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {t.popular}
                  </button>
                </div>
                <button
                  onClick={() => setActiveMenu("market")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-black flex items-center gap-1 cursor-pointer hover:underline transition-all group"
                >
                  <span>{t.viewAll}</span>
                  <span className="font-bold font-mono transition-transform group-hover:translate-x-0.5">&gt;</span>
                </button>
              </div>

              {/* Tabs Content - Capabilities rendering with flat list & dividers */}
              <div className="min-h-0 flex-1 overflow-auto p-1">
                {isLoading ? (
                  <HomeListSkeleton />
                ) : tabCapabilities.length === 0 ? (
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
                              <CapabilityIcon
                                src={item.icon}
                                version={item.updated_at}
                                alt=""
                                className="h-11 w-11 rounded-lg object-cover"
                                fallback={<IconComp size={18} className="stroke-[2.2px]" />}
                              />
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
            <HomeSideTabs
              favorites={overview?.favorites || []}
              frequent={overview?.frequent || []}
              loading={isLoading}
              onView={() => setActiveMenu("market")}
            />
          </div>

        </div>

      </div>
    </div>
  );
}

function HomeMetric({ title, value, detail, icon, onClick }: { title: string; value?: number | null; detail: string; icon: React.ReactNode; onClick?: () => void }) {
  return <button type="button" disabled={!onClick} onClick={onClick} className={`flex h-full min-h-20 items-center justify-between rounded-xl border border-slate-200/60 bg-white p-4 text-left transition-all ${onClick ? "hover:bg-slate-50/50 hover:shadow-xs cursor-pointer group" : "opacity-60 cursor-not-allowed"}`}><div className="flex items-center gap-3.5"><div className="flex h-14 w-14 shrink-0 items-center justify-center">{icon}</div><div><p className="text-xs text-slate-400 font-medium">{title}</p><p className="text-2xl font-bold text-slate-800">{value ?? "–"}</p><p className="text-xs text-slate-400">{detail}</p></div></div>{onClick && <ChevronRight size={14} className="text-slate-400" />}</button>;
}

function HomeListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function HomeSideTabs({ favorites, frequent, loading, onView }: { favorites: HomeCapabilityItem[]; frequent: HomeCapabilityItem[]; loading: boolean; onView: () => void }) {
  const [activeTab, setActiveTab] = useState<"favorites" | "frequent">("favorites");
  const items = activeTab === "favorites" ? favorites : frequent;
  const emptyText = activeTab === "favorites" ? "前往能力市场收藏常用能力" : "使用能力后将在这里显示";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white text-left">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center rounded-xl bg-slate-100/80 p-1">
          <button onClick={() => setActiveTab("favorites")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "favorites" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}>
            我的收藏
          </button>
          <button onClick={() => setActiveTab("frequent")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "frequent" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}>
            常用能力
          </button>
        </div>
        <button onClick={onView} className="text-xs font-semibold text-blue-600">查看全部 &gt;</button>
      </div>
      {loading ? <HomeListSkeleton /> : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-400">{emptyText}</div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              <div className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg ${item.type === "MCP" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}>
                <CapabilityIcon src={item.icon} version={item.updated_at} alt="" className="h-9 w-9 object-cover" fallback={item.type === "MCP" ? <Cpu size={16} /> : <Sparkles size={16} />} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-800">{item.name}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">{item.type}</Badge>
                </div>
                <p className="text-xs text-slate-400">{activeTab === "frequent" ? `使用 ${item.use_count ?? 0} 次` : `调用 ${item.calls} 次`}</p>
              </div>
              <Button variant="outline" size="sm" onClick={onView} className="h-7 px-2 text-xs">查看详情</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
