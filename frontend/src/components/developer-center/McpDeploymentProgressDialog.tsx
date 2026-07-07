import { Rocket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeveloperAsset } from "../../types/developer-center";
import { McpTestTimeline } from "./McpTestTimeline";
import { McpTerminalLog } from "./McpTerminalLog";

interface McpDeploymentProgressDialogProps {
  open: boolean;
  onClose: () => void;
  asset: DeveloperAsset | null;
  langCode: string;
  deployStatus: "idle" | "creating" | "running" | "success" | "fail";
  currentStepIndex: number;
  terminalLogs: Array<{ time: string; type: string; text: string }>;
  stepStatuses?: Record<number, "pass" | "fail">;
  stepDurations?: Record<number, string>;
  errorMessage?: string | null;
  onClearLogs: () => void;
  onTriggerAlert: (msg: string) => void;
}

const DEPLOY_STEPS = [
  { name: "1. 创建部署任务", desc: "提交部署请求并生成任务" },
  { name: "2. 构建镜像", desc: "读取 MCP 配置并构建镜像" },
  { name: "3. 创建 K8s 资源", desc: "创建 Deployment / Service" },
  { name: "4. 等待 Pod Ready", desc: "等待运行实例就绪" },
  { name: "5. 同步 Gateway 路由", desc: "生成对外代理路由" },
  { name: "6. 部署完成", desc: "服务可通过 Gateway 调用" },
];

export function McpDeploymentProgressDialog({
  open,
  onClose,
  asset,
  langCode,
  deployStatus,
  currentStepIndex,
  terminalLogs,
  stepStatuses = {},
  stepDurations = {},
  errorMessage,
  onClearLogs,
  onTriggerAlert,
}: McpDeploymentProgressDialogProps) {
  if (!asset) return null;

  const statusText = deployStatus === "success"
    ? "部署完成"
    : deployStatus === "fail"
    ? "部署失败"
    : deployStatus === "creating"
    ? "创建部署任务中"
    : "部署进行中";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[580px] w-full max-w-4xl flex-col gap-0 rounded-xl border-slate-200 bg-white p-5 shadow-xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 pb-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-left text-sm font-bold text-slate-800">
            <Rocket size={14} className="text-blue-500" />
            <span>{langCode === "ZH" ? "MCP 服务部署进度" : "MCP Deployment Progress"}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {asset.name} · {statusText}
            </span>
          </DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div className="mt-3 flex shrink-0 items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{errorMessage}</span>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 py-4 lg:grid-cols-[250px_1fr]">
          <McpTestTimeline
            currentStepIndex={currentStepIndex}
            langCode={langCode}
            stepDurations={stepDurations}
            stepStatuses={stepStatuses}
            steps={DEPLOY_STEPS}
          />
          <McpTerminalLog
            terminalLogs={terminalLogs}
            langCode={langCode}
            onClearLogs={onClearLogs}
            onTriggerAlert={onTriggerAlert}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-500 select-none">
          <span>{deployStatus === "running" || deployStatus === "creating" ? "每 2 秒自动刷新部署状态" : "部署任务已结束"}</span>
          <Button
            size="sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold rounded-lg bg-black text-white hover:bg-zinc-900 border-none select-none transition-all cursor-pointer"
          >
            {langCode === "ZH" ? "关闭部署" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
