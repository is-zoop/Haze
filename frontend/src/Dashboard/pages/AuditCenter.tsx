import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Sparkles,
  Clock,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Percent,
  Timer,
  CheckCheck,
  Cpu,
  Calendar,
} from "lucide-react";
import { FloatingAlert, type FlashMessage } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSecondaryText
} from "@/components/ui/table";
import { getI18n } from "../../i18n";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UnifiedTabs, TabItem } from "@/components/UnifiedTabs";
import { PageHeader } from "../../components/common/PageHeader";
import { DataTableFooter } from "../../components/common/DataTableFooter";
import { StatusBadge } from "../../components/common/StatusBadge";
import {
  AuditCapabilityItem,
  AuditDetail,
  AuditStats,
  fetchAuditCapabilities,
  fetchAuditDetail,
  fetchAuditStats,
  reviewCapability,
} from "../../lib/audit";

interface PageProps {
  onBackToHome?: () => void;
  langCode?: "ZH" | "EN" | "JA" | "ES";
}

export function AuditCenter({ onBackToHome: _onBackToHome, langCode: _langCode = "ZH" }: PageProps) {
  const t = getI18n(_langCode);
  const statusLabels = {
    reviewing: _langCode === "ZH" ? "待审核" : "Reviewing",
    published: _langCode === "ZH" ? "已通过" : "Approved",
    rejected: t.statusRejected,
    draft: _langCode === "ZH" ? "草稿" : "Draft",
    offline: _langCode === "ZH" ? "已下线" : "Offline",
    pending: _langCode === "ZH" ? "待审核" : "Pending",
    approved: _langCode === "ZH" ? "已通过" : "Approved",
  };

  const [stats, setStats] = useState<AuditStats | null>(null);
  const [items, setItems] = useState<AuditCapabilityItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [dateRange, setDateRange] = useState("all");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [alertMsg, setAlertMsg] = useState<FlashMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerAlert = (message: FlashMessage) => {
    setAlertMsg(message);
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await fetchAuditStats();
      setStats(s);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === "pending" ? "reviewing" : activeTab === "approved" ? "approved" : activeTab;
      const result = await fetchAuditCapabilities({
        page: currentPage,
        pageSize,
        status: statusParam,
        search: searchQuery,
        type: typeFilter !== "all" ? (typeFilter === "Skill" ? "skill" : "mcp") : undefined,
      });
      setItems(result.items);
      setTotalItems(result.total);
    } catch {
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, pageSize, searchQuery, typeFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Unique departments from current loaded items for client-side dept filter
  const deptOptions = useMemo(() => {
    const depts = new Set<string>();
    items.forEach(item => { if (item.department) depts.add(item.department); });
    return Array.from(depts);
  }, [items]);

  // Client-side dept + date filter + sort
  const filteredItems = useMemo(() => {
    let list = deptFilter === "all" ? items : items.filter(item => item.department === deptFilter);
    if (dateRange !== "all") {
      const now = new Date();
      const cutoff = new Date(now);
      if (dateRange === "today") cutoff.setHours(0, 0, 0, 0);
      else if (dateRange === "recent_3") cutoff.setDate(now.getDate() - 3);
      else if (dateRange === "recent_7") cutoff.setDate(now.getDate() - 7);
      list = list.filter(item => {
        if (!item.submitted_at) return false;
        return new Date(item.submitted_at) >= cutoff;
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      const ta = a.submitted_at ?? "";
      const tb = b.submitted_at ?? "";
      return sortOrder === "newest" ? tb.localeCompare(ta) : ta.localeCompare(tb);
    });
    return sorted;
  }, [items, deptFilter, dateRange, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Tab counts from stats
  const countPending = stats?.pending ?? 0;
  const countAll = totalItems;

  const auditCenterTabs: TabItem[] = [
    {
      value: "pending",
      label: `${_langCode === "ZH" ? "待审核" : "Pending"} (${countPending})`,
    },
    {
      value: "approved",
      label: `${_langCode === "ZH" ? "已通过" : "Approved"}`,
    },
    {
      value: "rejected",
      label: `${_langCode === "ZH" ? "审核驳回" : "Rejected"}`,
    },
    {
      value: "all",
      label: `${_langCode === "ZH" ? "全部" : "All"} (${countAll})`,
    },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadStats(), loadItems()]);
    setIsRefreshing(false);
    triggerAlert({ type: "success", title: t.alertRefreshSuccessTitle, description: t.auditRefreshSuccess });
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setComment("");
    setDetailLoading(true);
    try {
      const d = await fetchAuditDetail(id);
      setDetail(d);
    } catch {
      triggerAlert({ type: "error", title: t.alertLoadFailedTitle, description: t.auditDetailLoadFailed });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmitReview = async (action: "approved" | "rejected") => {
    if (!selectedId) return;
    if (action === "rejected" && !comment.trim()) {
      triggerAlert({ type: "warning", title: t.alertActionRequiredTitle, description: t.auditRejectReasonRequired });
      return;
    }
    setSubmitting(true);
    try {
      await reviewCapability(selectedId, action, comment.trim() || undefined);
      const actionLabel = action === "approved"
        ? (_langCode === "ZH" ? "已通过" : "Approved")
        : (_langCode === "ZH" ? "已驳回" : "Rejected");
      triggerAlert({ type: "success", title: t.alertOperationSuccessTitle, description: `${actionLabel}: ${detail?.capability.name ?? ""}` });
      setSelectedId(null);
      setDetail(null);
      setComment("");
      await Promise.all([loadStats(), loadItems()]);
    } catch {
      triggerAlert({ type: "error", title: t.alertOperationFailedTitle, description: t.auditActionFailed });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const isPending = selectedItem?.status === "reviewing";

  return (
    <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans flex flex-col gap-3 animate-in fade-in duration-300" id="haze-publish-review-container">
      <PageHeader
        title={t.auditTitle}
        description={t.auditDesc}
        breadcrumbs={[_langCode === "ZH" ? "首页" : "Home", t.auditTitle]}
        actions={(
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 px-4 text-xs font-semibold border-border/70 bg-white hover:bg-slate-50 flex items-center gap-1.5 shadow-sm text-slate-700 cursor-pointer rounded-lg"
            >
              <RotateCw size={12} className={`text-slate-500 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{t.refresh}</span>
            </Button>
          </div>
        )}
      />

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/70 bg-white shadow-2xs p-4 pt-2.5 pb-2.5 gap-3 overflow-hidden">

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm h-[112px] flex items-center gap-4">
            <div className="size-11 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Clock size={20} className="stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-500 leading-none">
                {_langCode === "ZH" ? "待我审核" : "Pending Reviews"}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-slate-900 leading-none font-sans">
                  {statsLoading ? "—" : (stats?.pending ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm h-[112px] flex items-center gap-4">
            <div className="size-11 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCheck size={20} className="stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-500 leading-none">
                {_langCode === "ZH" ? "今日已审核" : "Reviewed Today"}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-slate-900 leading-none font-sans">
                  {statsLoading ? "—" : (stats?.today_reviewed ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm h-[112px] flex items-center gap-4">
            <div className="size-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <Percent size={20} className="stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-500 leading-none">
                {_langCode === "ZH" ? "本周通过率" : "Weekly Approval Rate"}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-slate-900 leading-none font-sans">
                  {statsLoading ? "—" : stats?.week_pass_rate != null ? `${stats.week_pass_rate}%` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm h-[112px] flex items-center gap-4">
            <div className="size-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Timer size={20} className="stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium text-slate-500 leading-none">
                {_langCode === "ZH" ? "平均审核时长" : "Avg Review Duration"}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-slate-900 leading-none font-sans">
                  {statsLoading ? "—" : stats?.avg_review_hours != null ? `${stats.avg_review_hours}h` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-none p-0 bg-transparent shrink-0">
          <UnifiedTabs
            value={activeTab}
            onValueChange={(val) => { setActiveTab(val as any); setCurrentPage(1); }}
            className="shrink-0"
            listClassName="h-9 rounded-lg bg-slate-100/80 p-1 border-none"
            triggerClassName="h-7 text-xs px-4 font-semibold"
            tabs={auditCenterTabs}
          />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-transparent shrink-0">
          <div className="relative w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} strokeWidth={2} />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={_langCode === "ZH" ? "搜索能力名称或编码..." : "Search capability name or code..."}
              className="pl-9 h-10 w-full text-sm bg-white border-slate-200 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          <Combobox
            value={typeFilter}
            onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}
            items={[
              { value: "all", label: _langCode === "ZH" ? "全部类型" : "All Types" },
              { value: "Skill", label: "Skill" },
              { value: "MCP", label: "MCP" },
            ]}
            className="w-[130px]"
          >
            <ComboboxInput className="h-10 w-[130px] text-sm bg-white border-slate-200 text-slate-700 rounded-lg shrink-0 justify-between" placeholder={_langCode === "ZH" ? "全部类型" : "All Types"} />
            <ComboboxContent className="w-[130px]">
              <ComboboxList>
                <ComboboxItem value="all">{_langCode === "ZH" ? "全部类型" : "All Types"}</ComboboxItem>
                <ComboboxItem value="Skill">Skill</ComboboxItem>
                <ComboboxItem value="MCP">MCP</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Combobox
            value={deptFilter}
            onValueChange={(val) => { setDeptFilter(val); setCurrentPage(1); }}
            items={[
              { value: "all", label: _langCode === "ZH" ? "全部部门" : "All Depts" },
              ...deptOptions.map(d => ({ value: d, label: d })),
            ]}
            className="w-[150px]"
          >
            <ComboboxInput className="h-10 w-[150px] text-sm bg-white border-slate-200 text-slate-700 rounded-lg shrink-0 justify-between" placeholder={_langCode === "ZH" ? "全部部门" : "All Depts"} />
            <ComboboxContent className="w-[150px]">
              <ComboboxList>
                <ComboboxItem value="all">{_langCode === "ZH" ? "全部部门" : "All Depts"}</ComboboxItem>
                {deptOptions.map(d => <ComboboxItem key={d} value={d}>{d}</ComboboxItem>)}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Combobox
            value={sortOrder}
            onValueChange={(val) => { setSortOrder(val as "newest" | "oldest"); setCurrentPage(1); }}
            items={[
              { value: "newest", label: _langCode === "ZH" ? "最新提交" : "Newest" },
              { value: "oldest", label: _langCode === "ZH" ? "最早提交" : "Oldest" },
            ]}
            className="w-[130px]"
          >
            <ComboboxInput className="h-10 w-[130px] text-sm bg-white border-slate-200 text-slate-700 rounded-lg shrink-0 justify-between" placeholder={_langCode === "ZH" ? "提交时间排序" : "Sort"} />
            <ComboboxContent className="w-[130px]">
              <ComboboxList>
                <ComboboxItem value="newest">{_langCode === "ZH" ? "最新提交" : "Newest"}</ComboboxItem>
                <ComboboxItem value="oldest">{_langCode === "ZH" ? "最早提交" : "Oldest"}</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Combobox
            value={dateRange}
            onValueChange={(val) => { setDateRange(val); setCurrentPage(1); }}
            items={[
              { value: "all", label: _langCode === "ZH" ? "全部时间" : "All Time" },
              { value: "today", label: _langCode === "ZH" ? "今天" : "Today" },
              { value: "recent_3", label: _langCode === "ZH" ? "最近 3 天" : "Last 3 Days" },
              { value: "recent_7", label: _langCode === "ZH" ? "最近 7 天" : "Last 7 Days" },
            ]}
            className="w-[150px]"
          >
            <ComboboxInput className="h-10 w-[150px] text-sm bg-white border-slate-200 text-slate-700 rounded-lg shrink-0 justify-between" placeholder={_langCode === "ZH" ? "选择日期范围" : "Date Range"}>
              <Calendar className="mr-1.5 h-4 w-4 text-slate-400 shrink-0" />
            </ComboboxInput>
            <ComboboxContent className="w-[150px]">
              <ComboboxList>
                <ComboboxItem value="all">{_langCode === "ZH" ? "全部时间" : "All Time"}</ComboboxItem>
                <ComboboxItem value="today">{_langCode === "ZH" ? "今天" : "Today"}</ComboboxItem>
                <ComboboxItem value="recent_3">{_langCode === "ZH" ? "最近 3 天" : "Last 3 Days"}</ComboboxItem>
                <ComboboxItem value="recent_7">{_langCode === "ZH" ? "最近 7 天" : "Last 7 Days"}</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Button
            variant="ghost"
            onClick={() => { setSearchQuery(""); setTypeFilter("all"); setDeptFilter("all"); setSortOrder("newest"); setDateRange("all"); setCurrentPage(1); }}
            className="h-10 text-sm font-semibold px-4 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer rounded-lg"
          >
            <RotateCw size={12} strokeWidth={2} />
            <span>{_langCode === "ZH" ? "重置" : "Reset"}</span>
          </Button>
        </div>

        {/* Alert toast */}
        {alertMsg && (
          <FloatingAlert {...alertMsg} />
        )}

        {/* Table */}
        <div className="flex-grow flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex-grow flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-white rounded-xl border border-border/70 shadow-2xs">
            <Table className="w-full min-w-[900px] table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead style={{ width: "28%" }}>{_langCode === "ZH" ? "能力信息" : "Capability Info"}</TableHead>
                  <TableHead style={{ width: "8%" }}>{_langCode === "ZH" ? "类型" : "Type"}</TableHead>
                  <TableHead style={{ width: "8%" }}>{_langCode === "ZH" ? "版本" : "Version"}</TableHead>
                  <TableHead style={{ width: "18%" }}>{_langCode === "ZH" ? "开发者 / 部门" : "Developer / Dept"}</TableHead>
                  <TableHead style={{ width: "16%" }}>{_langCode === "ZH" ? "提交审核时间" : "Submitted At"}</TableHead>
                  <TableHead style={{ width: "8%" }}>{_langCode === "ZH" ? "状态" : "Status"}</TableHead>
                  <TableHead style={{ width: "14%" }} data-table-action="true">{_langCode === "ZH" ? "操作" : "Action"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      {_langCode === "ZH" ? "加载中..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      {_langCode === "ZH" ? "暂无数据" : "No data"}
                    </TableCell>
                  </TableRow>
                ) : filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.icon ? (
                          <img src={item.icon} alt="" className="size-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className={`size-9 rounded-lg shrink-0 flex items-center justify-center ${item.type === "Skill" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>
                            {item.type === "Skill" ? <Sparkles size={16} className="stroke-[2]" /> : <Cpu size={16} className="stroke-[2]" />}
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className="font-semibold text-slate-900 leading-tight truncate">{item.name}</p>
                          <TableSecondaryText className="font-mono leading-none">{item.code}</TableSecondaryText>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${item.type === "Skill" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                        {item.type}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono text-slate-500">
                      {item.version}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <p className="font-semibold text-slate-800 leading-tight">{item.author || "—"}</p>
                        <TableSecondaryText className="leading-none">{item.department || "—"}</TableSecondaryText>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-slate-500">
                      {item.submitted_at ?? "—"}
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={item.status} labels={statusLabels} className="rounded px-2 py-0.5" />
                    </TableCell>

                    <TableCell className="text-right" data-table-action="true">
                      {item.status === "reviewing" ? (
                        <Button
                          onClick={() => openDetail(item.id)}
                          size="sm"
                          className="h-9 px-4 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer rounded-lg shadow-sm"
                        >
                          {_langCode === "ZH" ? "开始审核" : "Start Review"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => openDetail(item.id)}
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-xs font-semibold border-border bg-white hover:bg-slate-50 cursor-pointer rounded-lg text-slate-700"
                        >
                          {_langCode === "ZH" ? "查看结果" : "View Results"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataTableFooter
            totalItems={totalItems}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            langCode={_langCode}
          />
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDetail(null); } }}>
        {selectedId && (
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full max-w-lg h-full bg-white border-l border-border p-0 gap-0 flex flex-col shadow-2xl text-left sm:max-w-lg"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 p-5 border-b border-border/60 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {detail?.capability.icon ? (
                  <img src={detail.capability.icon} alt="" className="size-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className={`p-2 rounded-lg shrink-0 ${detail?.capability.type === "Skill" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>
                    {detail?.capability.type === "Skill" ? <Sparkles size={16} /> : <Cpu size={16} />}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {detail?.capability.name ?? selectedItem?.name ?? ""}
                    {_langCode === "ZH" ? " 审核详情" : " Audit Detail"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {detail?.capability.code ?? selectedItem?.code} · v{detail?.capability.version ?? selectedItem?.version}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedItem && <StatusBadge status={selectedItem.status} labels={statusLabels} className="rounded px-2 py-0.5" />}
                <button onClick={() => { setSelectedId(null); setDetail(null); }} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0 bg-slate-50/20">
              <div className="p-5 space-y-4">
                {detailLoading ? (
                  <div className="text-center py-12 text-slate-400 text-sm">{_langCode === "ZH" ? "加载中..." : "Loading..."}</div>
                ) : detail ? (
                  <>
                    {/* Section 1: Capability Info */}
                    <Card className="border border-border/70 rounded-xl bg-white p-4 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 block mb-3 tracking-wider">
                        {_langCode === "ZH" ? "能力信息" : "Capability Info"}
                      </span>
                      <div className="space-y-2 text-sm">
                        {detail.capability.category && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">{_langCode === "ZH" ? "业务分类" : "Category"}</span>
                            <span className="font-medium text-slate-800">{detail.capability.category}</span>
                          </div>
                        )}
                        {detail.capability.type === "MCP" && detail.capability.connect_type && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">{_langCode === "ZH" ? "连接方式" : "Connect Type"}</span>
                            <span className="font-mono font-bold text-slate-800 text-xs">{detail.capability.connect_type}</span>
                          </div>
                        )}
                        {detail.capability.description && (
                          <div>
                            <p className="text-slate-400 mb-1">{_langCode === "ZH" ? "描述" : "Description"}</p>
                            <p className="text-slate-700 leading-relaxed">{detail.capability.description}</p>
                          </div>
                        )}
                        {detail.capability.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {detail.capability.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span className="text-slate-400">{_langCode === "ZH" ? "测试结果" : "Test Result"}</span>
                          <span className={`font-semibold text-xs ${
                            detail.capability.recent_test_status === "pass" ? "text-emerald-600" :
                            detail.capability.recent_test_status === "fail" ? "text-red-500" : "text-slate-400"
                          }`}>
                            {detail.capability.type === "Skill"
                              ? (_langCode === "ZH" ? "无需测试" : "N/A")
                              : detail.capability.recent_test_status === "pass"
                              ? "Pass"
                              : detail.capability.recent_test_status === "fail"
                              ? "Fail"
                              : (_langCode === "ZH" ? "未测试" : "Not tested")}
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Section 2: Developer Info */}
                    <Card className="border border-border/70 rounded-xl bg-white p-4 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 block mb-3 tracking-wider">
                        {_langCode === "ZH" ? "开发者信息" : "Developer Info"}
                      </span>
                      <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">{_langCode === "ZH" ? "开发者姓名" : "Developer"}</p>
                          <p className="font-semibold text-slate-800">{detail.developer.name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">{_langCode === "ZH" ? "所属部门" : "Department"}</p>
                          <p className="font-semibold text-slate-800">{detail.developer.department || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-400 mb-1">{_langCode === "ZH" ? "提交审核时间" : "Submitted At"}</p>
                          <p className="font-mono text-slate-700">{detail.developer.submitted_at || "—"}</p>
                        </div>
                      </div>
                    </Card>

                    {/* Section 3: Version Info */}
                    <Card className="border border-border/70 rounded-xl bg-white p-4 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 block mb-2 tracking-wider">
                        {_langCode === "ZH" ? "版本说明" : "Version Notes"}
                      </span>
                      {detail.version_info.is_first_publish || !detail.version_info.changelog ? (
                        <p className="text-sm text-slate-400 italic">
                          {detail.version_info.is_first_publish
                            ? (_langCode === "ZH" ? "首次发布，暂无版本说明" : "First publish, no release notes")
                            : (_langCode === "ZH" ? "暂无版本说明" : "No release notes")}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{detail.version_info.changelog}</p>
                      )}
                    </Card>

                    {/* Section 4: Review Result (reviewed only, not shown while pending) */}
                    {detail.review && !isPending && (
                      <Card className={`border rounded-xl p-4 shadow-sm ${detail.review.status === "approved" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                        <span className={`text-xs font-bold block mb-2 tracking-wider ${detail.review.status === "approved" ? "text-emerald-600" : "text-rose-500"}`}>
                          {_langCode === "ZH" ? "审核评价" : "Review Feedback"}
                        </span>
                        <p className={`text-sm font-medium leading-relaxed ${detail.review.status === "approved" ? "text-emerald-800" : "text-rose-800"}`}>
                          {detail.review.comment || (_langCode === "ZH" ? "（无备注）" : "(No comment)")}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {detail.review.reviewer_name} · {detail.review.reviewed_at}
                        </p>
                      </Card>
                    )}

                  </>
                ) : null}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="sticky bottom-0 z-10 border-t border-border bg-white shrink-0">
              {isPending ? (
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                      {_langCode === "ZH" ? "评价 / 驳回原因" : "Comment / Rejection Reason"}
                    </p>
                    <Textarea
                      rows={5}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={_langCode === "ZH" ? "输入审核评价或驳回原因..." : "Enter review comment or rejection reason..."}
                      className="w-full text-sm bg-slate-50 border border-border rounded-lg resize-none focus:border-blue-400 focus:bg-white transition-all"
                      disabled={submitting}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => handleSubmitReview("rejected")}
                      disabled={submitting}
                      className="h-9 px-4 text-xs font-semibold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer rounded-lg shadow-sm"
                    >
                      <ThumbsDown size={13} className="mr-1" />
                      <span>{submitting ? "..." : (_langCode === "ZH" ? "驳回" : "Reject")}</span>
                    </Button>
                    <Button
                      onClick={() => handleSubmitReview("approved")}
                      disabled={submitting}
                      className="h-9 px-4 text-xs font-semibold cursor-pointer rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                    >
                      <ThumbsUp size={13} className="mr-1" />
                      <span>{submitting ? "..." : (_langCode === "ZH" ? "通过发布" : "Approve & Publish")}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-center justify-end">
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedId(null); setDetail(null); }}
                    className="h-9 px-4 text-sm font-semibold rounded-lg cursor-pointer text-slate-700 border-border hover:bg-slate-50 bg-white"
                  >
                    {_langCode === "ZH" ? "关闭详情" : "Close"}
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
