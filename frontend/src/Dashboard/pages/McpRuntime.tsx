import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { Play, Square, RotateCcw, Copy, Activity, ClipboardList, MoreHorizontal, Cpu, Search } from "lucide-react";
import { FloatingAlert, type FlashMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { MultiSelectCombobox } from "@/components/common/MultiSelectCombobox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSecondaryText,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { CapabilityIcon } from "@/components/common/CapabilityIcon";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { TableEmptyState } from "@/components/common/TableEmptyState";
import { getI18n } from "@/i18n";
import {
  McpDeployment, McpDeployTask, McpCallLog, McpCallLogListData, McpRuntimeCapabilityOption,
  listMcpDeployments, listMcpRuntimeTasks, listMcpRuntimeCalls, listMcpRuntimeCapabilities,
  startMcpDeployment, stopMcpDeployment, restartMcpDeployment,
} from "@/lib/capabilities";

interface PageProps {
  langCode?: "ZH" | "EN" | "JA" | "ES";
}

// ── 状态 → StatusBadge key + 标签 ────────────────────────────────────────────

function deployBadge(s: string) {
  return (
    { running: { k: "active", l: "运行中" }, stopped: { k: "offline", l: "已停止" },
      failed: { k: "fail", l: "失败" }, building: { k: "processing", l: "构建中" },
      deploying: { k: "processing", l: "部署中" }, pending: { k: "pending", l: "等待中" },
    }[s] ?? { k: "withdrawn", l: s }
  );
}

function actualBadge(s: string) {
  return (
    { running: { k: "active", l: "运行中" }, stopped: { k: "offline", l: "已停止" },
      failed: { k: "fail", l: "失败" }, pending: { k: "pending", l: "等待中" },
    }[s] ?? { k: "withdrawn", l: s }
  );
}

function healthBadge(s: string) {
  return (
    { healthy: { k: "pass", l: "健康" }, unhealthy: { k: "fail", l: "异常" },
      unknown: { k: "withdrawn", l: "未知" },
    }[s] ?? { k: "withdrawn", l: s }
  );
}

function taskTypeBadge(s: string) {
  return (
    { deploy: { k: "deployed", l: "首次部署" }, start: { k: "active", l: "启动" },
      stop: { k: "offline", l: "停止" }, restart: { k: "processing", l: "重启" },
      redeploy: { k: "reviewing", l: "重新部署" }, rollback: { k: "withdrawn", l: "回滚" },
      delete: { k: "withdrawn", l: "删除" },
    }[s] ?? { k: "withdrawn", l: s }
  );
}

function taskStatusBadge(s: string) {
  return (
    { pending: { k: "pending", l: "等待中" }, running: { k: "processing", l: "执行中" },
      success: { k: "pass", l: "成功" }, failed: { k: "fail", l: "失败" },
    }[s] ?? { k: "withdrawn", l: s }
  );
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function toDateInput(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function getDateRange(preset: "yesterday" | "week" | "month") {
  const end = new Date();
  const start = new Date(end);
  if (preset === "yesterday") {
    start.setDate(end.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else {
    start.setDate(end.getDate() - (preset === "week" ? 6 : 29));
  }
  return { startAt: toDateInput(start), endAt: toDateInput(end) };
}

const defaultRecordRange = getDateRange("week");


function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 flex flex-col gap-1 shadow-xs">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground leading-tight">{value}</span>
    </div>
  );
}

type DatePreset = "yesterday" | "week" | "month" | "custom";

interface RecordFilterBarProps {
  t: ReturnType<typeof getI18n>;
  langCode: PageProps["langCode"];
  capabilities: McpRuntimeCapabilityOption[];
  capabilityIds: number[];
  methods?: string[];
  methodOptions?: string[];
  startAt: string;
  endAt: string;
  preset: DatePreset;
  onCapabilityIdsChange: (ids: number[]) => void;
  onMethodsChange?: (methods: string[]) => void;
  onRangeChange: (startAt: string, endAt: string) => void;
  onPresetChange: (preset: DatePreset) => void;
}

function RecordFilterBar({ t, langCode, capabilities, capabilityIds, methods, methodOptions = [], startAt, endAt, preset, onCapabilityIdsChange, onMethodsChange, onRangeChange, onPresetChange }: RecordFilterBarProps) {
  const capabilityOptions = capabilities.map((capability) => ({ value: String(capability.id), label: capability.name }));
  const range = { from: new Date(`${startAt}T00:00:00`), to: new Date(`${endAt}T00:00:00`) };
  return (
    <div className="relative z-20 flex flex-wrap items-center gap-2 shrink-0">
      <MultiSelectCombobox options={capabilityOptions} values={capabilityIds.map(String)} onChange={(values) => onCapabilityIdsChange(values.map(Number))} placeholder={t.mcpRuntimeSelectCapabilities} searchPlaceholder={t.mcpRuntimeSearchCapability} clearLabel={t.mcpRuntimeAllCapabilities} selectedLabel={(count, isAllSelected) => isAllSelected ? `${t.mcpRuntimeSelectCapabilities}(${t.mcpRuntimeAllCapabilities})` : t.mcpRuntimeSelectedCount.replace("{label}", t.mcpRuntimeSelectCapabilities).replace("{count}", String(count))} className="w-[240px]" />
      {onMethodsChange && <MultiSelectCombobox options={methodOptions.map((method) => ({ value: method, label: method }))} values={methods ?? []} onChange={onMethodsChange} placeholder={t.mcpRuntimeMethod} searchPlaceholder={t.mcpRuntimeSearchMethod} clearLabel={t.mcpRuntimeAllMethods} selectedLabel={(count, isAllSelected) => isAllSelected ? `${t.mcpRuntimeMethod}(${t.mcpRuntimeAllMethods})` : t.mcpRuntimeSelectedCount.replace("{label}", t.mcpRuntimeMethod).replace("{count}", String(count))} className="w-[180px]" />}
      <DateRangePicker value={range} onChange={({ from, to }) => onRangeChange(toDateInput(from), toDateInput(to))} placeholder={t.mcpRuntimeDateRange} langCode={langCode} />
      <Select value={preset} onValueChange={(value) => onPresetChange(value as DatePreset)}>
        <SelectTrigger aria-label={t.mcpRuntimeQuickRange} className="h-9 w-[112px] border-slate-200 text-xs shadow-xs hover:border-slate-300 focus-visible:!border-slate-400 focus-visible:!ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[70] rounded-lg border-slate-200 shadow-lg">
          <SelectItem value="yesterday">{t.mcpRuntimeYesterday}</SelectItem>
          <SelectItem value="week">{t.mcpRuntimeLast7Days}</SelectItem>
          <SelectItem value="month">{t.mcpRuntimeLastMonth}</SelectItem>
          <SelectItem value="custom">{t.mcpRuntimeCustomRange}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
export function McpRuntime({ langCode = "ZH" }: PageProps) {
  const t = getI18n(langCode);
  const [deployments, setDeployments] = useState<McpDeployment[]>([]);
  const [deploymentSearch, setDeploymentSearch] = useState("");
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<McpRuntimeCapabilityOption[]>([]);
  const [callCapabilityIds, setCallCapabilityIds] = useState<number[]>([]);
  const [taskCapabilityIds, setTaskCapabilityIds] = useState<number[]>([]);
  const [callStartAt, setCallStartAt] = useState(defaultRecordRange.startAt);
  const [callEndAt, setCallEndAt] = useState(defaultRecordRange.endAt);
  const [taskStartAt, setTaskStartAt] = useState(defaultRecordRange.startAt);
  const [taskEndAt, setTaskEndAt] = useState(defaultRecordRange.endAt);
  const [callMethods, setCallMethods] = useState<string[]>(["tools/call"]);
  const [callDatePreset, setCallDatePreset] = useState<DatePreset>("week");
  const [taskDatePreset, setTaskDatePreset] = useState<DatePreset>("week");
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [callLogs, setCallLogs] = useState<McpCallLog[]>([]);
  const [callStats, setCallStats] = useState<Pick<McpCallLogListData, "period_total" | "period_errors" | "success_rate" | "avg_duration_ms">>({ period_total: 0, period_errors: 0, success_rate: null, avg_duration_ms: null });
  const [callTotal, setCallTotal] = useState(0);
  const [tasks, setTasks] = useState<McpDeployTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [isCallLogsLoading, setIsCallLogsLoading] = useState(false);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("instances");
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [opLoading, setOpLoading] = useState<number | null>(null);
  const [copyTip, setCopyTip] = useState<number | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const lastK8sSyncRef = useRef<number>(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [callPage, setCallPage] = useState(1);
  const [callPageSize, setCallPageSize] = useState(20);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(20);
  const loadDeployments = useCallback(async () => {
    setLoading(true);
    try {
      setDeployments(await listMcpDeployments());
    } catch { /* 静默 */ }
    finally { setIsInitialLoading(false); setLoading(false); }
  }, []);

  const K8S_SYNC_COOLDOWN = 5000;

  async function handleRefresh() {
    setLoading(true);
    const now = Date.now();
    const doK8sSync = now - lastK8sSyncRef.current >= K8S_SYNC_COOLDOWN;
    let synced = false;
    try {
      if (doK8sSync) {
        try {
          await apiRequest<{ updated: number }>("/api/mcp-runtime/sync-status", { method: "POST" });
          lastK8sSyncRef.current = now;
          synced = true;
        } catch { /* K8s sync 失败时静默降级，仍刷新 DB 数据 */ }
      }
      setDeployments(await listMcpDeployments());
      showFlash({ type: "success", title: t.alertRefreshSuccessTitle, description: synced ? t.mcpRefreshSynced : t.mcpRefreshSuccess });
    } catch {
      showFlash({ type: "error", title: t.alertRefreshFailedTitle, description: t.mcpRefreshFailed });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDeployments(); }, [loadDeployments]);

  useEffect(() => {
    let cancelled = false;
    listMcpRuntimeCapabilities().then((items) => { if (!cancelled) setRuntimeCapabilities(items); }).catch(() => { if (!cancelled) setRuntimeCapabilities([]); });
    return () => { cancelled = true; };
  }, []);

  function selectCalls(id: number) {
    const deployment = deployments.find((item) => item.id === id);
    setCallCapabilityIds(deployment ? [deployment.capability_id] : []);
    setCallPage(1);
    setActiveTab("calls");
  }

  function selectTasks(id: number) {
    const deployment = deployments.find((item) => item.id === id);
    setTaskCapabilityIds(deployment ? [deployment.capability_id] : []);
    setTaskPage(1);
    setActiveTab("tasks");
  }

  function applyCallRange(preset: "yesterday" | "week" | "month") {
    const range = getDateRange(preset);
    setCallStartAt(range.startAt);
    setCallEndAt(range.endAt);
    setCallDatePreset(preset);
    setCallPage(1);
  }

  function applyTaskRange(preset: "yesterday" | "week" | "month") {
    const range = getDateRange(preset);
    setTaskStartAt(range.startAt);
    setTaskEndAt(range.endAt);
    setTaskDatePreset(preset);
    setTaskPage(1);
  }

  useEffect(() => {
    if (activeTab !== "calls") return;
    let cancelled = false;
    setIsCallLogsLoading(true);
    listMcpRuntimeCalls({
      capabilityIds: callCapabilityIds,
      startAt: callStartAt,
      endAt: callEndAt,
      methods: callMethods,
      page: callPage,
      pageSize: callPageSize,
    }).then((data) => {
      if (cancelled) return;
      setCallLogs(data.items);
      setCallTotal(data.total);
      setCallStats(data);
      setAvailableMethods(data.available_methods);
    }).catch(() => {
      if (cancelled) return;
      setCallLogs([]);
      setCallTotal(0);
      setCallStats({ period_total: 0, period_errors: 0, success_rate: null, avg_duration_ms: null });
      setAvailableMethods([]);
    }).finally(() => {
      if (!cancelled) setIsCallLogsLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, callCapabilityIds, callStartAt, callEndAt, callMethods, callPage, callPageSize]);

  useEffect(() => {
    if (activeTab !== "tasks") return;
    let cancelled = false;
    setIsTasksLoading(true);
    listMcpRuntimeTasks({
      capabilityIds: taskCapabilityIds,
      startAt: taskStartAt,
      endAt: taskEndAt,
      page: taskPage,
      pageSize: taskPageSize,
    }).then((data) => {
      if (cancelled) return;
      setTasks(data.items);
      setTaskTotal(data.total);
    }).catch(() => {
      if (cancelled) return;
      setTasks([]);
      setTaskTotal(0);
    }).finally(() => {
      if (!cancelled) setIsTasksLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, taskCapabilityIds, taskStartAt, taskEndAt, taskPage, taskPageSize]);
  function showFlash(message: FlashMessage) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2800);
  }

  async function handleOp(
    id: number,
    op: (id: number) => Promise<void>,
    successMsg: string,
  ) {
    setOpLoading(id);
    try {
      await op(id);
      await loadDeployments();
      showFlash({ type: "success", title: t.alertOperationSuccessTitle, description: successMsg });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.mcpUnknownError;
      showFlash({ type: "error", title: t.alertOperationFailedTitle, description: t.mcpOperationFailed.replace("{message}", msg) });
    } finally {
      setOpLoading(null);
    }
  }

  async function handleCopy(dep: McpDeployment) {
    if (!dep.public_url) return;
    try {
      await navigator.clipboard.writeText(dep.public_url);
      setCopyTip(dep.id);
      setTimeout(() => setCopyTip(null), 1500);
    } catch { /* ignore */ }
  }

  const filteredDeployments = deployments.filter((deployment) => {
    const keyword = deploymentSearch.trim().toLocaleLowerCase();
    return !keyword || (deployment.capability_name ?? deployment.deployment_name).toLocaleLowerCase().includes(keyword);
  });
  const total = filteredDeployments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filteredDeployments.slice((safePage - 1) * pageSize, safePage * pageSize);
  const callTotalPages = Math.max(1, Math.ceil(callTotal / callPageSize));
  const taskTotalPages = Math.max(1, Math.ceil(taskTotal / taskPageSize));
  const methodOptions = [...new Set([...availableMethods, ...callMethods])];

  return (
    <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans flex flex-col gap-3 animate-in fade-in duration-300">
      {flash && <FloatingAlert {...flash} />}

      <PageHeader
        title="MCP 运行监控"
        description="查看 MCP Server 运行实例状态，执行启动 / 停止 / 重启，监控调用记录"
      />

      {/* 主内容白色卡片 */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/75 bg-white shadow-sm p-4 pt-2.5 pb-2.5 gap-3 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}
          className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">

          {/* TAB 列表 + 刷新按钮同行 */}
          <div className="flex items-center justify-between shrink-0">
            <TabsList className="h-9 rounded-lg bg-slate-100/80 p-1 border-none">
              <TabsTrigger value="instances"
                className="h-7 text-xs px-4 font-bold cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm">
                运行实例{total > 0 ? ` ${total}` : ""}
              </TabsTrigger>
              <TabsTrigger value="calls"
                className="h-7 text-xs px-4 font-bold cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm">
                调用监控
              </TabsTrigger>
              <TabsTrigger value="tasks"
                className="h-7 text-xs px-4 font-bold cursor-pointer data-[state=active]:bg-white data-[state=active]:shadow-sm">
                部署记录
              </TabsTrigger>
            </TabsList>

            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}
              className="h-8 text-xs gap-1.5 rounded-lg border-border/70 cursor-pointer font-semibold">
              <RotateCcw size={12} className={loading ? "animate-spin" : ""} />刷新
            </Button>
          </div>

          {/* ── Tab 1：运行实例 ──────────────────────────────────────────────── */}
          <TabsContent value="instances"
            className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 gap-2">
            <div className="relative w-[240px] shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={deploymentSearch}
                onChange={(event) => { setDeploymentSearch(event.target.value); setPage(1); }}
                placeholder={t.mcpRuntimeSearchCapability}
                className="h-9 pl-9"
              />
            </div>
            <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
              <Table className="min-w-[900px]">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent">
                        {["能力名称", "创建人", "部署状态", "运行状态", "健康", "副本", "更新时间", "操作"].map(h => (
                          <TableHead key={h} data-table-action={h === "操作" ? "true" : undefined}>
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isInitialLoading ? (
                        <TableSkeleton columnCount={8} leadingVisual actionColumn />
                      ) : paged.length === 0 ? (
                        <TableEmptyState
                          colSpan={8}
                          title="暂无运行实例"
                          description="完成 MCP HTTP 能力部署后，实例将在此显示。"
                        />
                      ) : paged.map(dep => {
                        const isRunning = dep.deploy_status === "running";
                        const isStopped = dep.deploy_status === "stopped";
                        const busy = opLoading === dep.id;
                        const db = deployBadge(dep.deploy_status);
                        const ab = actualBadge(dep.actual_status);
                        const hb = healthBadge(dep.health_status);
                        return (
                          <TableRow key={dep.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <CapabilityIcon
                                  src={dep.capability_icon}
                                  version={dep.updated_at}
                                  alt={dep.capability_name ?? dep.deployment_name}
                                  className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover shadow-xs"
                                  fallback={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-xs"><Cpu size={18} /></div>}
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground leading-tight">
                                    {dep.capability_name ?? dep.deployment_name}
                                  </div>
                                  {dep.capability_code && (
                                    <TableSecondaryText>
                                      {dep.capability_code}
                                    </TableSecondaryText>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs text-muted-foreground">{dep.creator_name ?? "—"}</TableCell>
                            <TableCell className="px-4 py-3">
                              <StatusBadge status={db.k} labels={{ [db.k]: db.l }} />
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <StatusBadge status={ab.k} labels={{ [ab.k]: ab.l }} />
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <StatusBadge status={hb.k} labels={{ [hb.k]: hb.l }} />
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                              {dep.ready_replicas}/{dep.replicas}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                              {fmtTime(dep.updated_at)}
                            </TableCell>
                            <TableCell data-table-action="true">
                              <ButtonGroup>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || (!isRunning && !isStopped)}
                                  onClick={() => handleOp(
                                      dep.id,
                                      isRunning ? restartMcpDeployment : startMcpDeployment,
                                      isRunning ? "重启指令已下发，Pod 滚动重启中" : "启动指令已下发，等待实例就绪",
                                    )}>
                                  {isRunning ? <RotateCcw size={11} /> : <Play size={11} />}
                                  {isRunning ? "重启" : "启动"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || !isRunning}
                                  onClick={() => handleOp(dep.id, stopMcpDeployment, "停止指令已下发，实例正在停止")}>
                                  <Square size={11} />停止
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label="更多操作"
                                    >
                                      <MoreHorizontal size={14} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end"
                                    className="w-36 rounded-xl border border-border p-1 bg-white">
                                    {dep.public_url && (
                                      <DropdownMenuItem onClick={() => handleCopy(dep)}
                                        className="text-xs rounded-lg cursor-pointer gap-2 font-semibold">
                                        <Copy size={12} />
                                        {copyTip === dep.id ? "已复制！" : "复制访问地址"}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => selectCalls(dep.id)}
                                      className="text-xs rounded-lg cursor-pointer gap-2 font-semibold">
                                      <Activity size={12} />查看调用记录
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => selectTasks(dep.id)}
                                      className="text-xs rounded-lg cursor-pointer gap-2 font-semibold">
                                      <ClipboardList size={12} />查看部署记录
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </ButtonGroup>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
              </Table>
            </div>

            {/* 分页（使用 DataTableFooter 默认选项：10/20/50/100 项/页） */}
            <DataTableFooter
              totalItems={total} currentPage={safePage} totalPages={totalPages}
              onPageChange={p => setPage(p)} pageSize={pageSize}
              onPageSizeChange={s => { setPageSize(s); setPage(1); }}
              langCode={langCode}
            />
          </TabsContent>

          {/* ── Tab 2：调用监控 ─────────────────────────────────────────────── */}
          <TabsContent value="calls"
            className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 gap-3">
            <RecordFilterBar
              t={t}
              langCode={langCode}
              capabilities={runtimeCapabilities}
              capabilityIds={callCapabilityIds}
              methods={callMethods}
              methodOptions={methodOptions}
              startAt={callStartAt}
              endAt={callEndAt}
              preset={callDatePreset}
              onCapabilityIdsChange={(ids) => { setCallCapabilityIds(ids); setCallPage(1); }}
              onMethodsChange={(methods) => { setCallMethods(methods); setCallPage(1); }}
              onRangeChange={(startAt, endAt) => { setCallStartAt(startAt); setCallEndAt(endAt); setCallDatePreset("custom"); setCallPage(1); }}
              onPresetChange={(preset) => { if (preset === "custom") setCallDatePreset("custom"); else applyCallRange(preset); }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <StatCard label={t.mcpRuntimeCurrentPeriodCalls} value={callStats.period_total} />
              <StatCard label="成功率" value={callStats.success_rate == null ? "—" : String(callStats.success_rate) + "%"} />
              <StatCard label="平均耗时" value={callStats.avg_duration_ms == null ? "—" : String(callStats.avg_duration_ms) + " ms"} />
              <StatCard label={t.mcpRuntimeCurrentPeriodErrors} value={callStats.period_errors} />
            </div>

            <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
              <Table className="min-w-[900px]">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    {[t.mcpRuntimeCapabilityName, "时间", "调用人", "方法", "工具名", "状态码", "耗时(ms)", "结果", "来源 IP"].map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isCallLogsLoading ? (
                    <TableSkeleton columnCount={9} />
                  ) : callLogs.length === 0 ? (
                    <TableEmptyState
                      colSpan={9}
                      title={t.mcpRuntimeCallRecords}
                      description="当前筛选条件下暂无调用记录。"
                    />
                  ) : callLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="px-4 py-3 text-xs font-semibold">{log.capability_name ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(log.created_at)}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">{log.caller_name ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-semibold">{log.method ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-semibold">{log.tool_name ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">{log.status_code ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">{log.duration_ms ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge status={log.success ? "pass" : "fail"} labels={{ pass: "成功", fail: "失败" }} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">{log.client_ip ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTableFooter
              totalItems={callTotal}
              currentPage={Math.min(callPage, callTotalPages)}
              totalPages={callTotalPages}
              onPageChange={setCallPage}
              pageSize={callPageSize}
              onPageSizeChange={(size) => { setCallPageSize(size); setCallPage(1); }}
              langCode={langCode}
            />
          </TabsContent>

          {/* ── Tab 3：部署记录 ─────────────────────────────────────────────── */}
          <TabsContent value="tasks"
            className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 gap-3">
            <RecordFilterBar
              t={t}
              langCode={langCode}
              capabilities={runtimeCapabilities}
              capabilityIds={taskCapabilityIds}
              startAt={taskStartAt}
              endAt={taskEndAt}
              preset={taskDatePreset}
              onCapabilityIdsChange={(ids) => { setTaskCapabilityIds(ids); setTaskPage(1); }}
              onRangeChange={(startAt, endAt) => { setTaskStartAt(startAt); setTaskEndAt(endAt); setTaskDatePreset("custom"); setTaskPage(1); }}
              onPresetChange={(preset) => { if (preset === "custom") setTaskDatePreset("custom"); else applyTaskRange(preset); }}
            />            <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
              <Table className="min-w-[900px]">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    {[t.mcpRuntimeCapabilityName, "任务类型", "版本号", "任务状态", "创建时间", "开始时间", "完成时间", "错误信息"].map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isTasksLoading ? (
                    <TableSkeleton columnCount={8} />
                  ) : tasks.length === 0 ? (
                    <TableEmptyState
                      colSpan={8}
                      title={t.mcpRuntimeDeployRecords}
                      description="当前筛选条件下暂无部署记录。"
                    />
                  ) : tasks.map((task) => {
                    const typeBadge = taskTypeBadge(task.task_type);
                    const statusBadge = taskStatusBadge(task.task_status);
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="px-4 py-3 text-xs font-semibold">{task.capability_name ?? "—"}</TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge status={typeBadge.k} labels={{ [typeBadge.k]: typeBadge.l }} />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs font-semibold text-muted-foreground">{task.version ? "v" + task.version.replace(/^v/, "") : "—"}</TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge status={statusBadge.k} labels={{ [statusBadge.k]: statusBadge.l }} />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.created_at)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.started_at)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.finished_at)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-destructive max-w-[220px]">
                          {task.error_message ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-[220px] cursor-help truncate">{task.error_message}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="end" className="max-w-md whitespace-pre-wrap break-words bg-neutral-900 text-white border-0 text-xs leading-relaxed">
                                {task.error_message}
                              </TooltipContent>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DataTableFooter
              totalItems={taskTotal}
              currentPage={Math.min(taskPage, taskTotalPages)}
              totalPages={taskTotalPages}
              onPageChange={setTaskPage}
              pageSize={taskPageSize}
              onPageSizeChange={(size) => { setTaskPageSize(size); setTaskPage(1); }}
              langCode={langCode}
            />
          </TabsContent>        </Tabs>
      </div>
    </div>
  );
}
