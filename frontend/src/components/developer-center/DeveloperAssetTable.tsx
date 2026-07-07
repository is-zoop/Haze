import {
  ArrowUpCircle,
  Code,
  Copy,
  Cpu,
  Database,
  Edit3,
  FileCheck,
  Folder,
  MinusCircle,
  MoreHorizontal,
  Rocket,
  Send,
  Shield,
  Sparkles,
  TerminalSquare,
  Trash2,
  X,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSecondaryText,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeveloperAsset } from "../../types/developer-center";
import { StatusBadge } from "../common/StatusBadge";
import { getI18n } from "../../i18n";

const tableStatusClassName = "flex items-center gap-1.5 text-xs font-semibold";

function renderTestStatusBadge(asset: DeveloperAsset, lang: string = "ZH") {
  const t = getI18n(lang);
  // Skill 无需测试
  if (asset.type === "Skill") {
    return (
      <div className={`${tableStatusClassName} text-slate-400`}>
        <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
        <span>{t.statusNoTestRequired}</span>
      </div>
    );
  }
  // 从生命周期状态推导测试结果（MCP 到达 published/offline 必然经过 debug_passed）
  if (["debug_passed", "published", "offline"].includes(asset.status)) {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>{lang === "ZH" ? "测试通过" : lang === "JA" ? "テスト合格" : lang === "ES" ? "Prueba aprobada" : "Test Passed"}</span>
      </div>
    );
  }
  if (asset.status === "debug_failed") {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <X className="h-4 w-4 bg-rose-500 text-white rounded-full p-0.5 shrink-0" />
        <span>{lang === "ZH" ? "测试失败" : lang === "JA" ? "テスト失敗" : lang === "ES" ? "Prueba fallida" : "Test Failed"}</span>
      </div>
    );
  }
  const status = asset.recentTestStatus;
  if (status === "pass") {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>{t.statusPass}</span>
      </div>
    );
  }
  if (status === "fail") {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <X className="h-4 w-4 bg-rose-500 text-white rounded-full p-0.5 shrink-0" />
        <span>{t.statusFail}</span>
      </div>
    );
  }
  if (status === "testing") {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <span>{t.statusTesting}</span>
      </div>
    );
  }
  return (
    <div className={`${tableStatusClassName} text-slate-700`}>
      <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
      <span>{t.statusNotTested}</span>
    </div>
  );
}

// 将内部生命周期状态折叠为"状态列"显示状态
// deployed/deploy_failed/debug_passed/debug_failed 均属于审核通过后的中间环节，对用户显示为"审核通过"
function getDisplayStatus(asset: DeveloperAsset): DeveloperAsset["status"] {
  const intermediate = ["deployed", "deploy_failed", "debug_passed", "debug_failed"] as const;
  if ((intermediate as readonly string[]).includes(asset.status)) return "approved";
  return asset.status;
}

function renderDeployStatusBadge(asset: DeveloperAsset, lang: string = "ZH") {
  const isMcp = asset.type !== "Skill";
  const isHttp = isMcp && asset.transport !== "STDIO";
  // Skill 与 STDIO MCP 无需部署
  if (!isHttp) {
    return (
      <div className={`${tableStatusClassName} text-slate-400`}>
        <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
        <span>{lang === "ZH" ? "无需部署" : lang === "JA" ? "デプロイ不要" : lang === "ES" ? "Sin despliegue" : "No Deploy"}</span>
      </div>
    );
  }
  const s = asset.status;
  if (s === "deploy_failed") {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <X className="h-4 w-4 bg-rose-500 text-white rounded-full p-0.5 shrink-0" />
        <span>{lang === "ZH" ? "部署失败" : lang === "JA" ? "デプロイ失敗" : lang === "ES" ? "Despliegue fallido" : "Deploy Failed"}</span>
      </div>
    );
  }
  if (["deployed", "debug_passed", "debug_failed", "published", "offline"].includes(s)) {
    return (
      <div className={`${tableStatusClassName} text-slate-700`}>
        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>{lang === "ZH" ? "部署完成" : lang === "JA" ? "デプロイ完了" : lang === "ES" ? "Desplegado" : "Deployed"}</span>
      </div>
    );
  }
  return (
    <div className={`${tableStatusClassName} text-slate-700`}>
      <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
      <span>{lang === "ZH" ? "未部署" : lang === "JA" ? "未デプロイ" : lang === "ES" ? "Sin desplegar" : "Not Deployed"}</span>
    </div>
  );
}

interface DeveloperAssetTableProps {
  paginatedAssets: DeveloperAsset[];
  langCode: string;
  onOpenEditAsset: (asset: DeveloperAsset) => void;
  onIncrementVersion: (asset: DeveloperAsset) => void;
  onCopyAssetCode: (asset: DeveloperAsset) => void;
  onSubmitReview: (asset: DeveloperAsset) => void;
  onDeployAsset: (asset: DeveloperAsset) => void;
  onDebugComplete: (asset: DeveloperAsset) => void;
  onPublishAsset: (asset: DeveloperAsset) => void;
  onOfflineAsset: (asset: DeveloperAsset) => void;
  onSetDeleteTarget: (asset: DeveloperAsset) => void;
}

// 依据 (status, type, transport) 推导出当前能力允许的流程动作，集中体现状态机
function getFlowActions(asset: DeveloperAsset) {
  const isMcp = asset.type !== "Skill";
  const isHttp = isMcp && asset.transport !== "STDIO"; // transport 缺省按 HTTP
  const s = asset.status;
  return {
    canSubmitReview: s === "draft" || s === "rejected",
    canNewVersion: s === "published" || s === "debug_passed" || s === "offline" || s === "deploy_failed",
    showDeploy: isHttp,
    canDeploy: isHttp && (s === "approved" || s === "deploy_failed"),
    canDebug: isMcp && (isHttp ? s === "deployed" || s === "debug_failed" : s === "approved" || s === "debug_failed"),
    canPublish: isMcp ? (s === "debug_passed" || s === "offline") : (s === "approved" || s === "offline"),
    isPublished: s === "published",
  };
}

export function DeveloperAssetTable({
  paginatedAssets,
  langCode,
  onOpenEditAsset,
  onIncrementVersion,
  onCopyAssetCode,
  onSubmitReview,
  onDeployAsset,
  onDebugComplete,
  onPublishAsset,
  onOfflineAsset,
  onSetDeleteTarget,
}: DeveloperAssetTableProps) {
  const t = getI18n(langCode);
  const assetStatusLabels = {
    published: t.statusPublished,
    draft: t.statusDraft,
    reviewing: t.statusReviewing,
    approved: t.statusReviewApproved,
    rejected: t.statusRejected,
    deployed: t.statusDeployed,
    deploy_failed: t.statusDeployFailed,
    debug_passed: t.statusDebugPassed,
    debug_failed: t.statusDebugFailed,
    offline: t.statusOffline,
  };

  // Helper to get styled asset icon
  const getAssetIcon = (code: string, type: "Skill" | "MCP Server" | string, customIcon?: string) => {
    if (customIcon) {
      return (
        <img
          src={customIcon}
          alt="Icon"
          referrerPolicy="no-referrer"
          className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200 shadow-xs"
        />
      );
    }
    if (code === "fin_statement_summary") {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100/50 shadow-xs">
          <Code size={18} />
        </div>
      );
    }
    if (code === "contract_legal_auditor") {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100/50 shadow-xs">
          <Shield size={18} />
        </div>
      );
    }
    if (code === "enterprise_db_connector") {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-105/50 shadow-xs">
          <Database size={18} />
        </div>
      );
    }
    if (code === "filesystem_guard") {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center border border-purple-100/50 shadow-xs">
          <Folder size={18} />
        </div>
      );
    }

    if (type === "Skill") {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-105/50 shadow-xs">
          <Sparkles size={18} />
        </div>
      );
    } else {
      return (
        <div className="h-10 w-10 shrink-0 font-bold bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-105/50 shadow-xs">
          <Cpu size={18} />
        </div>
      );
    }
  };

  // Helper to format calls compactly
  const formatCalls = (calls: number) => {
    if (calls === 0) return "0";
    if (calls >= 1000) {
      return (calls / 1000).toFixed(1) + "k";
    }
    return String(calls);
  };

  return (
    <div className="flex-grow flex-1 min-h-0 overflow-hidden rounded-xl border border-border/60 bg-white" id="haze-developer-table-container">
      <ScrollArea className="h-full w-full">
        <div className="min-w-[1640px]">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[240px]">{langCode === "ZH" ? "能力名称" : langCode === "JA" ? "機能名" : langCode === "ES" ? "Nombre de Capacidad" : "Capability Name"}</TableHead>
                <TableHead className="w-[140px]">{langCode === "ZH" ? "业务分类" : langCode === "JA" ? "カテゴリ" : langCode === "ES" ? "Categoría" : "Category"}</TableHead>
                <TableHead className="w-[120px]">{langCode === "ZH" ? "创建人" : langCode === "JA" ? "作成者" : langCode === "ES" ? "Creador" : "Creator"}</TableHead>
                <TableHead className="w-[100px]">{langCode === "ZH" ? "类型" : langCode === "JA" ? "种类" : langCode === "ES" ? "Tipo" : "Type"}</TableHead>
                <TableHead className="w-[100px]">{langCode === "ZH" ? "版本" : langCode === "JA" ? "バージョン" : langCode === "ES" ? "Versión" : "Version"}</TableHead>
                <TableHead className="w-[130px]">{langCode === "ZH" ? "状态" : langCode === "JA" ? "ステータス" : langCode === "ES" ? "Estado" : "Status"}</TableHead>
                <TableHead className="w-[130px]">{langCode === "ZH" ? "部署状态" : langCode === "JA" ? "デプロイ状態" : langCode === "ES" ? "Despliegue" : "Deploy"}</TableHead>
                <TableHead className="w-[150px]">{langCode === "ZH" ? "测试状态" : langCode === "JA" ? "テスト状態" : langCode === "ES" ? "Estado de prueba" : "Test Status"}</TableHead>
                <TableHead className="w-[110px] text-right">{langCode === "ZH" ? "调用" : langCode === "JA" ? "呼び出し" : langCode === "ES" ? "Llamadas" : "Calls"}</TableHead>
                <TableHead className="w-[420px]" data-table-action="true">{langCode === "ZH" ? "操作" : langCode === "JA" ? "操作" : langCode === "ES" ? "Acciones" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAssets.map((asset) => {
                const cleanProject = asset.project.split(" (")[0];
                const flow = getFlowActions(asset);
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="w-[240px] text-left">
                      <div className="flex items-center gap-3 text-left">
                        {getAssetIcon(asset.code, asset.type, asset.icon)}
                        <div className="space-y-0.5 text-left">
                          <p className="font-semibold text-foreground text-left">{asset.name}</p>
                          <TableSecondaryText className="flex items-center gap-1 text-left">
                            <span className="font-mono text-left">{asset.code}</span>
                          </TableSecondaryText>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs font-semibold text-slate-600 text-left">
                      {cleanProject}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground text-left">
                      {asset.creator || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-left">
                      {asset.type === "Skill" ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                          Skill
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                          MCP
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground text-left">{asset.version || "v1.0.0"}</TableCell>
                    <TableCell className="px-4 py-3 text-left"><StatusBadge status={getDisplayStatus(asset)} labels={assetStatusLabels} /></TableCell>
                    <TableCell className="px-4 py-3 text-left">{renderDeployStatusBadge(asset, langCode)}</TableCell>
                    <TableCell className="px-4 py-3 text-left">{renderTestStatusBadge(asset, langCode)}</TableCell>
                    <TableCell className="px-4 py-3 font-mono font-bold text-right text-foreground tabular-nums pr-6">
                      {formatCalls(asset.calls)}
                    </TableCell>
                    <TableCell className="text-right" data-table-action="true">
                      <ButtonGroup>
                         <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenEditAsset(asset)}
                        >
                          <Edit3 />
                          <span>{t.edit}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!flow.showDeploy || !flow.canDeploy}
                          onClick={() => onDeployAsset(asset)}
                        >
                          <Rocket />
                          <span>{langCode === "ZH" ? "服务部署" : langCode === "JA" ? "サービスデプロイ" : langCode === "ES" ? "Desplegar servicio" : "Deploy Service"}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={asset.type === "Skill" || !flow.canDebug}
                          onClick={() => onDebugComplete(asset)}
                        >
                          <TerminalSquare />
                          <span>{langCode === "ZH" ? "连接测试" : langCode === "JA" ? "接続テスト" : langCode === "ES" ? "Prueba de conexión" : "Connection Test"}</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={langCode === "ZH" ? "更多操作" : "More actions"}
                            >
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            collisionPadding={12}
                            className="z-50 w-auto min-w-40 rounded-xl border border-slate-100 bg-white p-1 text-xs text-slate-700 shadow-md"
                          >
                            <DropdownMenuItem
                              disabled={!flow.canNewVersion}
                              onClick={() => onIncrementVersion(asset)}
                              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold hover:bg-slate-50 focus:bg-slate-50"
                            >
                              <ArrowUpCircle size={12} className="text-slate-400" />
                              <span>{langCode === "ZH" ? "新建版本" : langCode === "JA" ? "新バージョン" : langCode === "ES" ? "Nueva versión" : "New Version"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onCopyAssetCode(asset)}
                              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold hover:bg-slate-50 focus:bg-slate-50"
                            >
                              <Copy size={12} className="text-slate-400" />
                              <span>{langCode === "ZH" ? "复制 Prompt" : langCode === "JA" ? "Promptをコピー" : langCode === "ES" ? "Copiar Prompt" : "Copy Prompt"}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {flow.canSubmitReview && (
                              <DropdownMenuItem
                                onClick={() => onSubmitReview(asset)}
                                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold hover:bg-slate-50 focus:bg-slate-50"
                              >
                                <FileCheck size={12} className="text-slate-400" />
                                <span>{t.developerSubmitReview}</span>
                              </DropdownMenuItem>
                            )}

                            {flow.isPublished ? (
                              <DropdownMenuItem
                                onClick={() => onOfflineAsset(asset)}
                                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50"
                              >
                                <MinusCircle size={12} className="text-rose-500" />
                                <span>{langCode === "ZH" ? "下线" : langCode === "JA" ? "非公開" : langCode === "ES" ? "Fuera de línea" : "Offline"}</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={!flow.canPublish}
                                onClick={() => onPublishAsset(asset)}
                                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold hover:bg-slate-50 focus:bg-slate-50"
                              >
                                <Send size={12} className="text-slate-400" />
                                <span>{langCode === "ZH" ? "发布" : langCode === "JA" ? "公開する" : langCode === "ES" ? "Publicar" : "Publish"}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={(event) => { event.preventDefault(); onSetDeleteTarget(asset); }}
                              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg p-2 font-bold text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                            >
                              <Trash2 size={12} />
                              <span>{langCode === "ZH" ? "删除" : langCode === "JA" ? "削除" : langCode === "ES" ? "Eliminar" : "Delete"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedAssets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center font-normal text-muted-foreground bg-white text-left">
                    {langCode === "ZH" ? "暂无匹配的能力注册项" 
                     : langCode === "JA" ? "該当する機能登録が見得つかりません" 
                     : langCode === "ES" ? "No se encontraron capacidades registradas coincidentes" 
                     : "No matching registered capabilities found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  );
}
