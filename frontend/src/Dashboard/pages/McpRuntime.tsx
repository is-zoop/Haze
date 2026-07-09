import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { Play, Square, RotateCcw, Copy, Activity, ClipboardList, MoreHorizontal, Cpu } from "lucide-react";
import { FloatingAlert, type FlashMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSecondaryText,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { getI18n } from "@/i18n";
import {
  McpDeployment, McpDeployTask, McpCallLog, McpCallLogListData,
  listMcpDeployments, listMcpDeployTasks, listMcpCallLogs,
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 flex flex-col gap-1 shadow-xs">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground leading-tight">{value}</span>
    </div>
  );
}

export function McpRuntime({ langCode = "ZH" }: PageProps) {
  const t = getI18n(langCode);
  const [deployments, setDeployments] = useState<McpDeployment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [callLogs, setCallLogs] = useState<McpCallLog[]>([]);
  const [callStats, setCallStats] = useState<Pick<McpCallLogListData, "today_total" | "today_errors" | "success_rate" | "avg_duration_ms">>({ today_total: 0, today_errors: 0, success_rate: null, avg_duration_ms: null });
  const [tasks, setTasks] = useState<McpDeployTask[]>([]);
  const [activeTab, setActiveTab] = useState("instances");
  const [loading, setLoading] = useState(false);
  const [opLoading, setOpLoading] = useState<number | null>(null);
  const [copyTip, setCopyTip] = useState<number | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const lastK8sSyncRef = useRef<number>(0);

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadDeployments = useCallback(async () => {
    setLoading(true);
    try {
      setDeployments(await listMcpDeployments());
    } catch { /* 静默 */ }
    finally { setLoading(false); }
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

  async function selectCalls(id: number) {
    setSelectedId(id);
    setActiveTab("calls");
    try {
      const data = await listMcpCallLogs(id);
      setCallLogs(data.items);
      setCallStats(data);
    } catch {
      setCallLogs([]);
      setCallStats({ today_total: 0, today_errors: 0, success_rate: null, avg_duration_ms: null });
    }
  }

  async function selectTasks(id: number) {
    setSelectedId(id);
    setActiveTab("tasks");
    try { setTasks(await listMcpDeployTasks(id)); } catch { setTasks([]); }
  }

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

  // 分页计算
  const total = deployments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = deployments.slice((safePage - 1) * pageSize, safePage * pageSize);

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
            <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
              <ScrollArea className="h-full w-full">
                <div className="min-w-[900px]">
                  <Table>
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
                      {paged.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-48 text-center p-0">
                            <EmptyState title="暂无运行实例"
                              description="完成 MCP HTTP 能力部署后，实例将在此显示。" />
                          </TableCell>
                        </TableRow>
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
                                {dep.capability_icon ? (
                                  <img
                                    src={dep.capability_icon}
                                    alt={dep.capability_name ?? dep.deployment_name}
                                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover shadow-xs"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-xs">
                                    <Cpu size={18} />
                                  </div>
                                )}
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
              </ScrollArea>
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
            {selectedId === null ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState title="请先选择运行实例"
                  description="在运行实例 Tab 中，点击「更多 → 查看调用记录」查看该实例的调用日志。" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                  <StatCard label="今日调用" value={callStats.today_total} />
                  <StatCard label="成功率" value={callStats.success_rate == null ? "—" : `${callStats.success_rate}%`} />
                  <StatCard label="平均耗时" value={callStats.avg_duration_ms == null ? "—" : `${callStats.avg_duration_ms} ms`} />
                  <StatCard label="今日错误" value={callStats.today_errors} />
                </div>
                <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
                  <ScrollArea className="h-full w-full">
                    <div className="min-w-[700px]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className="hover:bg-transparent">
                            {["时间", "调用人", "方法", "工具名", "状态码", "耗时(ms)", "结果", "来源 IP"].map(h => (
                              <TableHead key={h}>
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {callLogs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="h-40 text-center p-0">
                                <EmptyState title="暂无调用记录"
                                  description="通过 Gateway 发起 MCP 调用后，记录将在此显示。" />
                              </TableCell>
                            </TableRow>
                          ) : callLogs.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(log.created_at)}</TableCell>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{log.caller_name ?? "—"}</TableCell>
                              <TableCell className="px-4 py-3 text-xs font-semibold">{log.method ?? "—"}</TableCell>
                              <TableCell className="px-4 py-3 text-xs font-semibold">{log.tool_name ?? "—"}</TableCell>
                              <TableCell className="px-4 py-3 text-xs">{log.status_code ?? "—"}</TableCell>
                              <TableCell className="px-4 py-3 text-xs">{log.duration_ms ?? "—"}</TableCell>
                              <TableCell className="px-4 py-3">
                                <StatusBadge status={log.success ? "pass" : "fail"}
                                  labels={{ pass: "成功", fail: "失败" }} />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{log.client_ip ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Tab 3：部署记录 ─────────────────────────────────────────────── */}
          <TabsContent value="tasks"
            className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0">
            {selectedId === null ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState title="请先选择运行实例"
                  description="在运行实例 Tab 中，点击「更多 → 查看部署记录」查看该实例的任务历史。" />
              </div>
            ) : (
              <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white">
                <ScrollArea className="h-full w-full">
                  <div className="min-w-[700px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent">
                          {["任务类型", "版本号", "任务状态", "创建时间", "开始时间", "完成时间", "错误信息"].map(h => (
                            <TableHead key={h}>
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-40 text-center p-0">
                              <EmptyState title="暂无部署记录"
                                description="每次部署、启动、停止、重启都会生成一条任务记录。" />
                            </TableCell>
                          </TableRow>
                        ) : tasks.map(task => {
                          const tb = taskTypeBadge(task.task_type);
                          const sb = taskStatusBadge(task.task_status);
                          return (
                            <TableRow key={task.id}>
                              <TableCell className="px-4 py-3">
                                <StatusBadge status={tb.k} labels={{ [tb.k]: tb.l }} />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs font-semibold text-muted-foreground">{task.version ? `v${task.version.replace(/^v/, "")}` : "—"}</TableCell>
                              <TableCell className="px-4 py-3">
                                <StatusBadge status={sb.k} labels={{ [sb.k]: sb.l }} />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.created_at)}</TableCell>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.started_at)}</TableCell>
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(task.finished_at)}</TableCell>
                              <TableCell className="px-4 py-3 text-xs text-destructive max-w-[220px]">
                                {task.error_message ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="block max-w-[220px] cursor-help truncate">
                                        {task.error_message}
                                      </span>
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
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
