import { Fragment, useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Copy,
  Cpu,
  Eye,
  Rocket,
  Search,
  Sparkles,
  Star,
  X,
  LayoutGrid,
  List,
  MoreVertical,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UnifiedTabs, TabItem } from "@/components/UnifiedTabs";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getI18n } from "../../i18n";
import { BusinessCategory, listBusinessCategories } from "../../lib/businessCategories";
import { CapabilityItem, CapabilityVersionRecord } from "../../types/capability";
import { getMarketCapabilityAccessPrompt, getMarketCapabilityContent, getMarketCapabilityDocumentAsset, listMarketCapabilities, toggleMarketFavorite } from "../../lib/capabilities";
import { recordHomeCapabilityUsage } from "../../lib/home";
import { PageHeader } from "../../components/common/PageHeader";
import { DataTableFooter } from "../../components/common/DataTableFooter";
import { EmptyState } from "../../components/common/EmptyState";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("typescript", typescript);

interface MarketPageProps {
  onBackToHome: () => void;
  langCode?: "ZH" | "EN" | "JA" | "ES";
  setActiveMenu?: (menu: string) => void;
}

type TypeTab = "all" | "Skill" | "MCP";
type MarketItem = CapabilityItem & { isMcp: boolean };

const CATEGORY_LABELS: Record<string, string> = {
  all: "全部能力",
  analytics: "数据分析",
  dev: "软件开发",
  office: "企业办公",
  sales: "电商运营",
  finance: "财务",
  hr: "人力资源",
  knowledge: "知识检索",
  workflow: "流程协作",
};

const DISPLAY_COPY: Record<string, { name: string; description: string; author: string; department: string; tags: string[] }> = {
  sk_1: {
    name: "销售日报自动分析",
    description: "汇总全渠道销售数据，自动生成异动归因、趋势预测、高潜商品与运营建议。",
    author: "数据科学部",
    department: "数据科学部",
    tags: ["数据分析", "电商运营", "自动化"],
  },
  sk_2: {
    name: "企业知识检索助手",
    description: "快速检索制度、福利标准、技术白皮书，并输出带来源引用的可信答复。",
    author: "信息安全部",
    department: "行政与安全部",
    tags: ["知识检索", "企业办公", "制度问答"],
  },
  sk_3: {
    name: "行业研报深度分析",
    description: "解析长篇研报与多格式材料，提炼估值区间、竞争格局和投资判断。",
    author: "战略规划部",
    department: "战略规划部",
    tags: ["数据分析", "财务", "决策辅助"],
  },
  mcp_1: {
    name: "企业数据中心 MCP",
    description: "提供受控 SQL 查询、数据实体导出、Schema 元数据检索等企业数据访问能力。",
    author: "王磊 (Leo)",
    department: "企业架构部",
    tags: ["数据中心", "SQL", "安全连接"],
  },
  mcp_2: {
    name: "受控文件系统沙箱 MCP",
    description: "隔离本地文件夹结构，为模型提供安全文件读取、索引和全文检索能力。",
    author: "刘洋 (Alex)",
    department: "安全实验室",
    tags: ["文件系统", "沙箱", "本地驱动"],
  },
};

const getCopy = (item: MarketItem | CapabilityItem) => {
  return DISPLAY_COPY[item.id] || {
    name: item.name,
    description: item.description,
    author: item.author,
    department: item.department,
    tags: item.tags || [],
  };
};

const textContains = (text?: string, query?: string) => {
  if (!text || !query) return false;
  return text.toLowerCase().includes(query.toLowerCase());
};

const formatCalls = (calls: number) => {
  if (calls >= 1000) {
    return `${(calls / 1000).toFixed(1)}k`;
  }
  return String(calls);
};

const getCategoryLabel = (categoryId: string, langCode: string) => {
  const translations: Record<string, Record<string, string>> = {
    all: { ZH: "全部能力", JA: "すべての能力", ES: "Todas", EN: "All Capabilities" },
    analytics: { ZH: "数据分析", JA: "データ分析", ES: "Análisis de datos", EN: "Data Analytics" },
    dev: { ZH: "软件开发", JA: "ソフトウェア開発", ES: "Desarrollo de Software", EN: "Software Development" },
    office: { ZH: "企业办公", JA: "ビジネスオフィス", ES: "Oficina empresarial", EN: "Enterprise Office" },
    sales: { ZH: "电商运营", JA: "EC運営", ES: "Operaciones de comercio", EN: "E-Commerce" },
  };
  return translations[categoryId]?.[langCode] || CATEGORY_LABELS[categoryId] || categoryId;
};

type SheetMode = "details" | "quickStart" | "readme";

export function Market({
  onBackToHome: _onBackToHome,
  langCode: _langCode = "ZH",
  setActiveMenu: _setActiveMenu,
}: MarketPageProps) {
  const t = getI18n(_langCode);
  const [skills, setSkills] = useState<CapabilityItem[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [mcps, setMcps] = useState<CapabilityItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [activeTypeTab, setActiveTypeTab] = useState<TypeTab>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  useEffect(() => { void listBusinessCategories().then(setCategories); }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showRecentlyUsedOnly, setShowRecentlyUsedOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("details");
  const [copiedText, setCopiedText] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Read preferred view mode from localStorage
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    const saved = localStorage.getItem("haze_market_view_mode");
    return saved === "table" ? "table" : "card";
  });

  // Sort parameter state
  const [sortBy, setSortBy] = useState<string>("recommend");

  const marketTabs: TabItem[] = [
    {
      value: "all",
      label: t.all,
    },
    {
      value: "Skill",
      label: "Skill",
    },
    {
      value: "MCP",
      label: "MCP",
    },
  ];

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const type = activeTypeTab === "Skill" ? "skill" : activeTypeTab === "MCP" ? "mcp" : undefined;
    listMarketCapabilities({
      page: currentPage,
      pageSize,
      search: searchQuery.trim() || undefined,
      type,
      categoryId: selectedCategory === "all" ? undefined : Number(selectedCategory),
      favoriteOnly: showFavoritesOnly || undefined,
    }).then(({ items, total }) => {
      const toItem = (raw: typeof items[0]): CapabilityItem => {
        const versionHistory = raw.version_history ?? raw.versions ?? [];
        return {
          id: raw.id,
          name: raw.name,
          type: raw.type === "MCP" ? "MCP" : "Skill",
          description: raw.description ?? "",
          calls: raw.calls,
          status: "active",
          author: raw.author,
          version: raw.version.startsWith("v") ? raw.version : `v${raw.version}`,
          updateTime: raw.updated_at,
          permissionsStatus: "direct",
          riskLevel: "low",
          department: raw.department ?? "",
          categoryId: raw.category_id ?? undefined,
          category: raw.category ?? "",
          tags: raw.tags,
          connectType: raw.connect_type ?? undefined,
          serverUrl: raw.server_url ?? undefined,
          versionHistory: versionHistory.map((record) => ({
            version: record.version.startsWith("v") ? record.version : `v${record.version}`,
            updatedAt: record.updated_at ?? record.created_at ?? "",
            content: record.changelog ?? record.content ?? null,
          })),
          isFavorite: raw.is_favorite,
          icon: raw.icon,
        };
      };
      setSkills(items.filter((i) => i.type === "Skill").map(toItem));
      setMcps(items.filter((i) => i.type === "MCP").map(toItem));
      setTotalItems(total);
    }).catch(() => {});
  }, [currentPage, pageSize, searchQuery, activeTypeTab, selectedCategory, showFavoritesOnly]);

  const allItems = useMemo<MarketItem[]>(() => {
    return [
      ...skills.map((item) => ({ ...item, isMcp: false })),
      ...mcps.map((item) => ({ ...item, isMcp: true })),
    ];
  }, [skills, mcps]);

  const categoryMatches = (item: MarketItem, categoryId: string) => {
    if (categoryId === "all") return true;
    return item.categoryId === Number(categoryId);
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allItems.filter((item) => {
      const display = getCopy(item);

      if (activeTypeTab === "Skill" && item.isMcp) return false;
      if (activeTypeTab === "MCP" && !item.isMcp) return false;
      if (showFavoritesOnly && !item.isFavorite) return false;
      if (showRecentlyUsedOnly && item.calls < 1000) return false;
      if (!categoryMatches(item, selectedCategory)) return false;

      if (!query) return true;

      return [
        item.name,
        item.description,
        item.author,
        item.department,
        display.name,
        display.description,
        display.author,
        display.department,
        ...(item.tags ?? []),
        ...display.tags,
      ].some((value) => textContains(value, query));
    });
  }, [allItems, activeTypeTab, selectedCategory, searchQuery, showFavoritesOnly, showRecentlyUsedOnly]);

  // Sort logic applied on filtered items
  const sortedAndFilteredItems = useMemo(() => {
    const items = [...filteredItems];
    if (sortBy === "calls") {
      items.sort((a, b) => b.calls - a.calls);
    } else if (sortBy === "updated") {
      items.sort((a, b) => b.updateTime.localeCompare(a.updateTime));
    } else if (sortBy === "newest") {
      items.sort((a, b) => b.id.localeCompare(a.id));
    }
    return items;
  }, [filteredItems, sortBy]);

  const paginatedItems = sortedAndFilteredItems;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  // Resets the current page back to 1 if filter arguments change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, activeTypeTab, showFavoritesOnly, showRecentlyUsedOnly, sortBy]);

  const marketStats = useMemo(() => {
    const favoriteCount = allItems.filter((item) => item.isFavorite).length;
    return { favoriteCount };
  }, [allItems, categories]);

  const categoryCounts = useMemo(() => {
    return [{ id: "all" }, ...categories.map((category) => ({ id: String(category.id) }))].reduce<Record<string, number>>((acc, category) => {
      acc[category.id] = allItems.filter((item) => categoryMatches(item, category.id)).length;
      return acc;
    }, {});
  }, [allItems, categories]);

  const activeFilterCount = [
    selectedCategory !== "all",
    showFavoritesOnly,
    showRecentlyUsedOnly,
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  const toggleFavorite = (itemId: string, isMcp: boolean) => {
    toggleMarketFavorite(itemId).then((isFavorite) => {
      const update = (item: CapabilityItem) => item.id === itemId ? { ...item, isFavorite } : item;
      if (isMcp) setMcps((prev) => prev.map(update));
      else setSkills((prev) => prev.map(update));
      setSelectedItem((prev) => prev?.id === itemId ? { ...prev, isFavorite } : prev);
    }).catch(() => {});
  };

  const clearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setShowRecentlyUsedOnly(false);
  };

  const handleCopyConfig = async (item: MarketItem) => {
    setCopiedText(false);
    setCopyFailed(false);

    try {
      const { prompt } = await getMarketCapabilityAccessPrompt(item.id);
      await navigator.clipboard.writeText(prompt);
      recordHomeCapabilityUsage(item.id).catch(() => {});
      setCopiedText(true);
    } catch {
      setCopyFailed(true);
    }
    window.setTimeout(() => {
      setCopiedText(false);
      setCopyFailed(false);
    }, 1500);
  };

  const openCapabilitySheet = (item: MarketItem, mode: SheetMode) => {
    setCopiedText(false);
    setCopyFailed(false);
    setSheetMode(mode);
    setSelectedItem(item);
  };

  const handleViewModeChange = (mode: "card" | "table") => {
    setViewMode(mode);
    localStorage.setItem("haze_market_view_mode", mode);
  };

  return (
    <div className="dashboard-page-stack h-full overflow-hidden animate-in fade-in duration-300 flex flex-col gap-3" id="haze-market-page-container">
      <PageHeader
        title={t.marketTitle}
        description={t.marketDesc}
        breadcrumbs={[_langCode === "ZH" ? "首页" : _langCode === "JA" ? "ホーム" : _langCode === "ES" ? "Inicio" : "Home", t.marketTitle]}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-slate-55">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr]">
          <aside className="hidden min-h-0 border-r border-slate-100 bg-white p-4 lg:flex lg:flex-col w-[240px] shrink-0">
            <div className="mb-4 flex items-center justify-between px-1 shrink-0">
              <div>
                <p className="text-sm font-black text-slate-900">
                  {_langCode === "ZH" ? "快速定位" : _langCode === "JA" ? "クイック移動" : _langCode === "ES" ? "Navegación" : "Quick Navigator"}
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 font-extrabold hover:text-slate-800 hover:bg-slate-100" onClick={clearFilters}>
                  {t.reset}
                </Button>
              )}
            </div>

            <div className="space-y-1 shrink-0">
              <button
                onClick={() => {
                  setShowFavoritesOnly((prev) => !prev);
                  setShowRecentlyUsedOnly(false);
                  setSelectedCategory("all");
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-xs transition-colors cursor-pointer",
                  showFavoritesOnly
                    ? "bg-blue-50 text-blue-600 font-black"
                    : "text-slate-600 hover:bg-slate-50 font-semibold"
                )}
                style={showFavoritesOnly ? { fontWeight: "900" } : undefined}
              >
                <span className="flex items-center gap-2">
                  <Star className={cn("h-3.5 w-3.5", showFavoritesOnly && "fill-blue-500 text-blue-500")} />
                  {_langCode === "ZH" ? "我的收藏" : _langCode === "JA" ? "お気に入り" : _langCode === "ES" ? "Mis favoritos" : "My Favorites"}
                </span>
                <span className={cn(
                  "rounded-full px-1.5 py-0 text-xs",
                  showFavoritesOnly ? "bg-blue-100 text-blue-600 font-black" : "bg-slate-100/60 text-slate-500"
                )}>
                  {marketStats.favoriteCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setShowRecentlyUsedOnly((prev) => !prev);
                  setShowFavoritesOnly(false);
                  setSelectedCategory("all");
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-xs transition-colors cursor-pointer",
                  showRecentlyUsedOnly
                    ? "bg-blue-50 text-blue-600 font-black"
                    : "text-slate-600 hover:bg-slate-50 font-semibold"
                )}
                style={showRecentlyUsedOnly ? { fontWeight: "900" } : undefined}
              >
                <span className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  {_langCode === "ZH" ? "高频使用" : _langCode === "JA" ? "高頻度使用" : _langCode === "ES" ? "Frecuentes" : "Frequently Used"}
                </span>
                <span className={cn(
                  "rounded-full px-1.5 py-0 text-xs",
                  showRecentlyUsedOnly ? "bg-blue-100 text-blue-600 font-black" : "bg-slate-100/60 text-slate-500"
                )}>
                  {allItems.filter((item) => item.calls >= 1000).length}
                </span>
              </button>
            </div>

            <p className="px-2.5 pt-6 pb-2 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
              {_langCode === "ZH" ? "业务分类" : _langCode === "JA" ? "業務カテゴリ" : _langCode === "ES" ? "Categorías" : "Categories"}
            </p>


            <ScrollArea className="min-h-0 flex-1 pr-1">
              <div className="space-y-1">
                {[{ id: "all", name: "全部能力" }, ...categories.map((category) => ({ id: String(category.id), name: category.name }))].map((category) => {
                  const isSelected = selectedCategory === category.id && !showFavoritesOnly && !showRecentlyUsedOnly;
                  return (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setShowFavoritesOnly(false);
                        setShowRecentlyUsedOnly(false);
                      }}
                      className={cn(
                        "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-blue-50 text-blue-600 font-black"
                          : "text-slate-600 hover:bg-slate-50 font-semibold"
                      )}
                      style={isSelected ? { fontWeight: "900" } : undefined}
                    >
                      <span className="truncate">{category.name}</span>
                      <span className={cn(
                        "ml-2 rounded-full px-1.5 py-0 text-xs",
                        isSelected ? "bg-blue-100 text-blue-600 font-black" : "bg-slate-100/60 text-slate-400"
                      )}>
                        {categoryCounts[category.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="border-b border-slate-100 bg-white p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <UnifiedTabs
                  value={activeTypeTab}
                  onValueChange={(value) => setActiveTypeTab(value as TypeTab)}
                  className="shrink-0"
                  listClassName="h-9 rounded-lg bg-slate-100/80 p-1"
                  triggerClassName="h-7 text-xs px-4"
                  tabs={marketTabs}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1 md:justify-end xl:max-w-[640px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={
                        _langCode === "ZH" ? "搜索能力、标签、作者或部门..."
                        : _langCode === "JA" ? "能力、タグ、開発者、部門で検索..."
                        : _langCode === "ES" ? "Buscar por capacidad, etiqueta, autor..."
                        : "Search capabilities, tags, author, department..."
                      }
                      className="h-9 rounded-lg border-slate-200 bg-white pl-9 pr-4 text-xs focus-visible:ring-blue-500 w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 shrink-0 text-xs">
                      <span className="text-slate-400">
                        {_langCode === "ZH" ? "排序:" : _langCode === "JA" ? "ソート:" : _langCode === "ES" ? "Orden:" : "Sort:"}
                      </span>
                      <Combobox
                        value={sortBy}
                        onValueChange={(val) => setSortBy(val)}
                        items={[
                          { value: "recommend", label: _langCode === "ZH" ? "综合推荐" : _langCode === "JA" ? "おすすめ順" : _langCode === "ES" ? "Recomendado" : "Recommended" },
                          { value: "calls", label: _langCode === "ZH" ? "调用最多" : _langCode === "JA" ? "呼び出し最多" : _langCode === "ES" ? "Más llamados" : "Most Calls" },
                          { value: "updated", label: _langCode === "ZH" ? "最近更新" : _langCode === "JA" ? "最新更新" : _langCode === "ES" ? "Última act." : "Last Updated" },
                          { value: "newest", label: _langCode === "ZH" ? "最新发布" : _langCode === "JA" ? "最新リリース" : _langCode === "ES" ? "Más recientes" : "Newest" }
                        ]}
                        className="w-[110px]"
                      >
                        <ComboboxInput
                          className="h-9 w-[110px] text-xs bg-white border-slate-200"
                          placeholder={_langCode === "ZH" ? "排序方式" : _langCode === "JA" ? "ソート" : _langCode === "ES" ? "Criterio" : "Sort By"}
                        />
                        <ComboboxContent className="w-[110px]">
                          <ComboboxList>
                            <ComboboxItem value="recommend">{_langCode === "ZH" ? "综合推荐" : _langCode === "JA" ? "おすすめ順" : _langCode === "ES" ? "Recomendado" : "Recommended"}</ComboboxItem>
                            <ComboboxItem value="calls">{_langCode === "ZH" ? "调用最多" : _langCode === "JA" ? "呼び出し最多" : _langCode === "ES" ? "Más llamados" : "Most Calls"}</ComboboxItem>
                            <ComboboxItem value="updated">{_langCode === "ZH" ? "最近更新" : _langCode === "JA" ? "最新更新" : _langCode === "ES" ? "Última act." : "Last Updated"}</ComboboxItem>
                            <ComboboxItem value="newest">{_langCode === "ZH" ? "最新发布" : _langCode === "JA" ? "最新リリース" : _langCode === "ES" ? "Más recientes" : "Newest"}</ComboboxItem>
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>

                    <div className="flex items-center border border-slate-200 bg-slate-100/55 rounded-lg p-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-md p-0 cursor-pointer",
                          viewMode === "card"
                            ? "bg-white text-blue-600 shadow-3xs"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                        onClick={() => handleViewModeChange("card")}
                        title="卡片视图"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-md p-0 cursor-pointer",
                          viewMode === "table"
                            ? "bg-white text-blue-600 shadow-3xs"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                        onClick={() => handleViewModeChange("table")}
                        title="表格视图"
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 self-start">
                  <span className="text-xs font-black text-slate-400">
                    {_langCode === "ZH" ? "当前条件" : _langCode === "JA" ? "検索条件" : _langCode === "ES" ? "Filtros aplicados" : "Active Filters"}
                  </span>
                  {selectedCategory !== "all" && (
                    <FilterPill
                      label={
                        _langCode === "ZH" ? `分类: ${getCategoryLabel(selectedCategory, _langCode)}`
                        : _langCode === "JA" ? `カテゴリ: ${getCategoryLabel(selectedCategory, _langCode)}`
                        : _langCode === "ES" ? `Categoría: ${getCategoryLabel(selectedCategory, _langCode)}`
                        : `Category: ${getCategoryLabel(selectedCategory, _langCode)}`
                      }
                      onClear={() => setSelectedCategory("all")}
                    />
                  )}
                  {showFavoritesOnly && (
                    <FilterPill
                      label={_langCode === "ZH" ? "只看收藏" : _langCode === "JA" ? "お気に入りのみ" : _langCode === "ES" ? "Favoritos" : "Favorites Only"}
                      onClear={() => setShowFavoritesOnly(false)}
                    />
                  )}
                  {showRecentlyUsedOnly && (
                    <FilterPill
                      label={_langCode === "ZH" ? "高频使用" : _langCode === "JA" ? "高頻度使用" : _langCode === "ES" ? "Frecuentes" : "Frequently Used"}
                      onClear={() => setShowRecentlyUsedOnly(false)}
                    />
                  )}
                  {searchQuery && (
                    <FilterPill
                      label={
                        _langCode === "ZH" ? `搜索: ${searchQuery}`
                        : _langCode === "JA" ? `検索: ${searchQuery}`
                        : _langCode === "ES" ? `Buscar: ${searchQuery}`
                        : `Search: ${searchQuery}`
                      }
                      onClear={() => setSearchQuery("")}
                    />
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1 bg-slate-50/50">
              {sortedAndFilteredItems.length === 0 ? (
                <EmptyState
                  title={t.noMatches}
                  description={t.noMatchesSub}
                  resetLabel={t.clearFilters}
                  onReset={clearFilters}
                />
              ) : viewMode === "card" ? (
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedItems.map((item) => {
                    const display = getCopy(item);

                    return (
                      <Card
                        key={item.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-3xs hover:border-slate-300 hover:shadow-2xs transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-3xs overflow-hidden",
                              item.isMcp ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"
                            )}>
                              {item.icon
                                ? <img src={item.icon} alt={item.name} className="h-10 w-10 object-cover" />
                                : item.isMcp ? <Cpu className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-extrabold text-slate-800 text-sm truncate max-w-[130px]">{display.name}</h4>
                                <button
                                  className="h-6 w-6 shrink-0 text-slate-400 hover:text-amber-500 transition-colors flex items-center justify-center cursor-pointer"
                                  onClick={() => toggleFavorite(item.id, item.isMcp)}
                                  aria-label={item.isFavorite
                                    ? (_langCode === "ZH" ? "取消收藏" : _langCode === "JA" ? "お気に入り解除" : _langCode === "ES" ? "Quitar de favoritos" : "Remove from Favorites")
                                    : (_langCode === "ZH" ? "收藏" : _langCode === "JA" ? "お気に入り登録" : _langCode === "ES" ? "Añadir a favoritos" : "Add to Favorites")
                                  }
                                >
                                  <Star className={cn("h-3.5 w-3.5", item.isFavorite && "fill-amber-400 text-amber-500")} />
                                </button>
                              </div>
                              <div className="mt-1">
                                <Badge variant="outline" className={cn("inline-flex h-4 items-center rounded-md px-1.5 text-xs font-black border-none shrink-0",
                                  item.isMcp ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"
                                )}>
                                  {item.isMcp ? "MCP" : "Skill"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 h-[34px] mb-3 text-left">
                          {display.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {display.tags.slice(0, 2).map((tag) => (
                            <Fragment key={tag}>
                              <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-xs text-slate-500 bg-slate-50/80 font-bold border-none">
                                {tag}
                              </Badge>
                            </Fragment>
                          ))}
                          {display.tags.length > 2 && (
                            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-xs text-slate-500 bg-slate-50/80 font-bold border-none">
                              +{display.tags.length - 2}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="truncate text-xs text-slate-500">
                            {[display.author, display.department, `${formatCalls(item.calls)} 次调用`].filter(Boolean).join(" · ")}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 rounded-md border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openCapabilitySheet(item, "details")}>
                              <Eye className="h-3.5 w-3.5" />
                              查看详情
                            </Button>
                            <Button size="sm" className="h-7 rounded-md bg-slate-900 px-2.5 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => openCapabilitySheet(item, "quickStart")}>
                              <Rocket className="h-3.5 w-3.5" />
                              快速开始
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden border border-slate-100 rounded-xl bg-white shadow-3xs">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>名称</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>描述</TableHead>
                            <TableHead>标签</TableHead>
                            <TableHead>开发者</TableHead>
                            <TableHead>调用次数</TableHead>
                            <TableHead>版本</TableHead>
                            <TableHead data-table-action="true">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedItems.map((item) => {
                            const display = getCopy(item);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="min-w-[200px] whitespace-nowrap px-4 py-2.5 text-left">
                                  <div className="flex items-center gap-2">
                                    <button className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-amber-500" onClick={() => toggleFavorite(item.id, item.isMcp)} aria-label={item.isFavorite ? "取消收藏" : "收藏"}>
                                      <Star className={cn("h-3.5 w-3.5", item.isFavorite && "fill-amber-400 text-amber-500")} />
                                    </button>
                                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", item.isMcp ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700")}>
                                      {item.isMcp ? <Cpu className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="max-w-[160px] truncate text-xs font-semibold text-slate-800" title={display.name}>{display.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-2.5">
                                  <Badge variant="secondary" className="h-5 rounded-md border-none px-1.5 text-xs">{item.isMcp ? "MCP" : "Skill"}</Badge>
                                </TableCell>
                                <TableCell className="min-w-[220px] max-w-[320px] px-4 py-2.5 text-left">
                                  <p className="line-clamp-1 text-xs text-slate-500" title={display.description}>{display.description}</p>
                                </TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-2.5">
                                  <div className="flex items-center gap-1">
                                    {display.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="secondary" className="h-5 rounded-md border-none bg-slate-50 px-1.5 text-xs text-slate-500">{tag}</Badge>)}
                                    {display.tags.length > 2 && <Badge variant="secondary" className="h-5 rounded-md border-none bg-slate-50 px-1.5 text-xs text-slate-500">+{display.tags.length - 2}</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-2.5 text-left text-xs text-slate-600">{display.author}</TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-slate-600">{formatCalls(item.calls)}</TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">{item.version}</TableCell>
                                <TableCell className="whitespace-nowrap text-right" data-table-action="true">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openCapabilitySheet(item, "details")}><Eye className="h-3.5 w-3.5" />查看详情</Button>
                                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openCapabilitySheet(item, "quickStart")}><Rocket className="h-3.5 w-3.5" />快速开始</Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="text-xs">
                                        <DropdownMenuItem onClick={() => handleCopyConfig(item)}>复制接入 Prompt</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleFavorite(item.id, item.isMcp)}>{item.isFavorite ? "取消收藏" : "移入收藏"}</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Pagination controls bar */}
            <DataTableFooter
              totalItems={totalItems}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              langCode={_langCode}
            />
          </main>
        </div>
      </div>

      <Sheet open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {selectedItem && (
            <CapabilitySheet
              item={selectedItem}
              mode={sheetMode}
              onModeChange={setSheetMode}
              copiedText={copiedText}
              copyFailed={copyFailed}
              onCopy={() => handleCopyConfig(selectedItem)}
              onFavorite={() => toggleFavorite(selectedItem.id, selectedItem.isMcp)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="outline" className="gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold border-slate-200">
      {label}
      <button type="button" onClick={onClear} className="rounded-full text-muted-foreground hover:text-rose-600 cursor-pointer">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function CapabilitySheet({
  item,
  mode,
  onModeChange,
  copiedText,
  copyFailed,
  onCopy,
  onFavorite,
}: {
  item: MarketItem;
  mode: SheetMode;
  onModeChange: (mode: SheetMode) => void;
  copiedText: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  onFavorite: () => void;
}) {
  const display = getCopy(item);
  const contentFile = mode === "quickStart" ? "quick_start.md" : mode === "readme" ? "README.md" : null;
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [documentBasePath, setDocumentBasePath] = useState("");
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);

  useEffect(() => {
    if (!contentFile) return;
    let active = true;
    setIsDocumentLoading(true);
    setDocumentContent(null);
    setDocumentBasePath("");
    getMarketCapabilityContent(item.id, contentFile)
      .then(({ content, basePath }) => {
        if (active) {
          setDocumentContent(content);
          setDocumentBasePath(basePath);
        }
      })
      .catch(() => {
        if (active) setDocumentContent(null);
      })
      .finally(() => {
        if (active) setIsDocumentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contentFile, item.id]);

  return (
    <>
      <SheetHeader className="border-b border-border bg-white p-5 pr-12 text-left">
        <div className="flex items-start gap-3">
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            item.isMcp ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700",
          )}>
            {item.icon ? (
              <img src={item.icon} alt="" className="h-full w-full rounded-lg object-cover" />
            ) : item.isMcp ? (
              <Cpu className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-sm font-semibold normal-case tracking-tight text-slate-950">
                {display.name}
              </SheetTitle>
              <Badge variant="secondary" className="h-5 rounded-md border-none px-1.5 text-xs">
                {item.isMcp ? "MCP" : "Skill"}
              </Badge>
            </div>
          </div>
          {mode === "details" && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-slate-500"
              onClick={onFavorite}
              aria-label={item.isFavorite ? "取消收藏" : "收藏"}
              title={item.isFavorite ? "取消收藏" : "收藏"}
            >
              <Star className={cn("h-4 w-4", item.isFavorite && "fill-amber-400 text-amber-500")} />
            </Button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <Button type="button" size="sm" variant={mode === "details" ? "secondary" : "ghost"} className="h-7 flex-1 text-xs" onClick={() => onModeChange("details")}>
            <Eye className="h-3.5 w-3.5" />
            查看详情
          </Button>
          <Button type="button" size="sm" variant={mode === "quickStart" ? "secondary" : "ghost"} className="h-7 flex-1 text-xs" onClick={() => onModeChange("quickStart")}>
            <Rocket className="h-3.5 w-3.5" />
            快速开始
          </Button>
          <Button type="button" size="sm" variant={mode === "readme" ? "secondary" : "ghost"} className="h-7 flex-1 text-xs" onClick={() => onModeChange("readme")}>
            <BookOpen className="h-3.5 w-3.5" />
            查看文档
          </Button>
        </div>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1 bg-slate-50/70">
        {mode === "details" ? (
          <CapabilityDetails item={item} display={display} />
        ) : (
          <MarketDocument capabilityId={item.id} basePath={documentBasePath} content={documentContent} loading={isDocumentLoading} />
        )}
      </ScrollArea>

      <SheetFooter className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-white p-4">
        <Button variant="outline" onClick={onFavorite} className="w-full sm:w-auto">
          <Star className={cn("mr-1 h-3.5 w-3.5", item.isFavorite && "fill-amber-400 text-amber-500")} />
          <span>{item.isFavorite ? "取消收藏" : "收藏"}</span>
        </Button>
        <Button onClick={onCopy} className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
          {copiedText ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          <span>{copiedText ? "已复制" : copyFailed ? "复制失败" : "复制接入 Prompt"}</span>
        </Button>
      </SheetFooter>
    </>
  );
}

function formatDetailDate(value?: string) {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}

function getVersionContent(content?: string | string[] | null) {
  if (Array.isArray(content)) return content.map((item) => item.trim()).filter(Boolean);
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex min-h-5 items-center gap-1.5 text-xs font-semibold text-slate-800">{children}</div>
    </div>
  );
}

function CapabilityDetails({
  item,
  display,
}: {
  item: MarketItem;
  display: ReturnType<typeof getCopy>;
}) {
  const versions = [...(item.versionHistory ?? [])].sort((left, right) => (
    (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0)
  ));

  return (
    <div className="space-y-3 p-4">
      <Card className="rounded-lg border-slate-200 bg-white shadow-none">
        <CardHeader className="p-4 pb-3 text-left">
          <CardTitle className="text-xs font-semibold text-slate-800">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 pt-0 sm:grid-cols-3">
          <DetailField label="版本号">
            <span>{item.version || "-"}</span>
          </DetailField>
          {item.isMcp && (
            <DetailField label="连接方式">
              {item.connectType ? <Badge variant="outline" className="h-5 rounded-md px-1.5 text-xs uppercase">{item.connectType}</Badge> : "-"}
            </DetailField>
          )}
          <DetailField label="调用次数">{Number.isFinite(item.calls) ? `${item.calls} 次` : "-"}</DetailField>
          <DetailField label="开发者">{display.author || "-"}</DetailField>
          <DetailField label="归属部门">{display.department || "-"}</DetailField>
          <DetailField label="更新时间">{formatDetailDate(item.updateTime)}</DetailField>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-none">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800">业务分类</p>
            <div className="mt-2">
              {item.category ? <Badge variant="outline" className="rounded-md text-xs">{item.category}</Badge> : <span className="text-xs text-slate-400">-</span>}
            </div>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800">能力标签</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {display.tags.length > 0 ? display.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-md border-none text-xs font-medium">{tag}</Badge>
              )) : <span className="text-xs text-slate-400">暂无标签</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-none">
        <CardHeader className="p-4 pb-2 text-left">
          <CardTitle className="text-xs font-semibold text-slate-800">能力描述</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-left">
          <p className="whitespace-pre-wrap text-xs leading-6 text-slate-600">
            {display.description || "暂无能力描述"}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-none">
        <CardHeader className="p-4 pb-2 text-left">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Clock3 className="h-3.5 w-3.5 text-slate-500" />
            版本更新记录
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 text-left">
          {versions.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂无版本更新记录</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {versions.map((record: CapabilityVersionRecord, index) => {
                const normalizedVersion = record.version.startsWith("v") ? record.version : `v${record.version}`;
                const contents = getVersionContent(record.content);
                return (
                  <div key={`${normalizedVersion}-${record.updatedAt}-${index}`} className="relative py-3 pl-5 first:pt-1 last:pb-1">
                    <span className="absolute left-0 top-4 h-2 w-2 rounded-full bg-slate-300 first:top-2" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">{normalizedVersion || "-"}</span>
                      <span className="text-xs text-slate-400">{formatDetailDate(record.updatedAt)}</span>
                    </div>
                    {contents.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                        {contents.map((content, contentIndex) => <li key={`${content}-${contentIndex}`}>{content}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">暂无更新说明</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MarketDocument({ capabilityId, basePath, content, loading }: { capabilityId: string; basePath: string; content: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="m-4 rounded-lg border border-slate-200 bg-white px-5 py-10 text-center text-xs text-slate-400">
        正在加载...
      </div>
    );
  }
  if (!content?.trim()) {
    return (
      <div className="m-4 rounded-lg border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-xs text-slate-400">
        没有可以展示的内容
      </div>
    );
  }
  return <ReadmeDocument capabilityId={capabilityId} basePath={basePath} content={content} />;
}

function DocumentationImage({ capabilityId, basePath, src, alt }: { capabilityId: string; basePath: string; src?: string; alt?: string }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setResolvedSrc(null);
    setPreviewOpen(false);
    if (!src) return;
    if (/^(?:https?:|data:|blob:)/i.test(src)) {
      setResolvedSrc(src);
      return;
    }
    const parts = `${basePath}/${src.split(/[?#]/, 1)[0]}`.split("/").filter(Boolean);
    const normalized: string[] = [];
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") normalized.pop();
      else normalized.push(part);
    }
    let active = true;
    let objectUrl = "";
    getMarketCapabilityDocumentAsset(capabilityId, normalized.join("/"))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      })
      .catch(() => active && setResolvedSrc(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [basePath, capabilityId, src]);

  if (!resolvedSrc) return null;
  const imageAlt = alt || "文档图片";
  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="group my-4 block max-w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        aria-label={`放大查看：${imageAlt}`}
      >
        <img
          src={resolvedSrc}
          alt={imageAlt}
          onError={() => setResolvedSrc(null)}
          className="max-h-96 max-w-full object-contain transition duration-200 group-hover:scale-[1.01]"
        />
      </button>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-auto max-w-[95vw] border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{imageAlt}</DialogTitle>
          <img
            src={resolvedSrc}
            alt={imageAlt}
            className="max-h-[90vh] max-w-[92vw] rounded-lg bg-white object-contain shadow-2xl"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
};
const SUPPORTED_CODE_LANGUAGES = new Set(["bash", "javascript", "json", "python", "typescript"]);

function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }) {
  const rawCode = String(children ?? "");
  const languageMatch = /language-([\w-]+)/.exec(className || "");
  const isBlock = Boolean(languageMatch) || rawCode.includes("\n");

  if (!isBlock) {
    return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-800">{children}</code>;
  }

  const requestedLanguage = languageMatch?.[1]?.toLowerCase() || "text";
  const normalizedLanguage = CODE_LANGUAGE_ALIASES[requestedLanguage] || requestedLanguage;
  const language = SUPPORTED_CODE_LANGUAGES.has(normalizedLanguage) ? normalizedLanguage : "text";
  return <MarkdownCodeBlock code={rawCode.replace(/\n$/, "")} language={language} />;
}

function MarkdownCodeBlock({ code, language }: { code: string; language: string }) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const languageLabel = language === "text" ? "TEXT" : language.toUpperCase();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <div className="mb-5 mt-3 overflow-hidden rounded-xl border border-slate-800 bg-[#101827] shadow-sm">
      <div className="flex h-10 items-center justify-between border-b border-white/10 bg-white/5 px-3.5">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300">{languageLabel}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-hidden focus:ring-1 focus:ring-slate-400"
          aria-label="复制代码"
        >
          {copyState === "success" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          maxHeight: "32rem",
          overflow: "auto",
          padding: "0.9rem 1rem 1rem",
          background: "#101827",
          fontSize: "12px",
          lineHeight: "1.65",
        }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" } }}
        lineNumberStyle={{ minWidth: "2.25em", paddingRight: "1em", color: "#64748b", userSelect: "none" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ReadmeDocument({ capabilityId, basePath, content }: { capabilityId: string; basePath: string; content: string }) {
  return (
    <article className="m-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-left shadow-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-5 border-b border-slate-200 pb-3 text-lg font-semibold tracking-tight text-slate-950">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2.5 mt-7 text-[15px] font-semibold tracking-tight text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-900">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 text-xs font-semibold text-slate-800">{children}</h4>,
          p: ({ children }) => <p className="mb-3.5 text-[13px] leading-6 text-slate-600">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-slate-600 marker:text-slate-400">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-[13px] leading-6 text-slate-600 marker:font-medium marker:text-slate-500">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="mb-4 border-l-2 border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-600 [&>p:last-child]:mb-0">{children}</blockquote>,
          a: ({ children, href }) => <a href={href} className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 transition hover:text-sky-800 hover:decoration-sky-500">{children}</a>,
          hr: () => <hr className="my-6 border-slate-200" />,
          table: ({ children }) => <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-slate-50 text-slate-700">{children}</thead>,
          th: ({ children }) => <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2.5 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2.5 align-top leading-5 text-slate-600 last:[tr:last-child_&]:border-b-0">{children}</td>,
          code: ({ className, children }) => <MarkdownCode className={className}>{children}</MarkdownCode>,
          pre: ({ children }) => <>{children}</>,
          img: ({ src, alt }) => <DocumentationImage capabilityId={capabilityId} basePath={basePath} src={src} alt={alt} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
