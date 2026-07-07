import { Play, RotateCw, Terminal } from "lucide-react";
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

interface McpConnectionTestDialogProps {
  open: boolean;
  onClose: () => void;
  debugAsset: DeveloperAsset | null;
  langCode: string;
  debugStatus: "idle" | "testing" | "pass" | "fail";
  currentStepIndex: number;
  terminalLogs: Array<{ time: string; type: string; text: string }>;
  stepDurations?: Record<number, string>;
  stepStatuses?: Record<number, "pass" | "fail">;
  testStarted: boolean;
  onStartTest: () => void;
  onClearLogs: () => void;
  onTriggerAlert: (msg: string) => void;
  steps?: { name: string; desc: string }[];
}

export function McpConnectionTestDialog({
  open,
  onClose,
  debugAsset,
  langCode,
  debugStatus,
  currentStepIndex,
  terminalLogs,
  stepDurations = {},
  stepStatuses = {},
  testStarted,
  onStartTest,
  onClearLogs,
  onTriggerAlert,
  steps,
}: McpConnectionTestDialogProps) {
  if (!debugAsset) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[580px] w-full max-w-4xl flex-col gap-0 rounded-xl border-slate-200 bg-white p-5 shadow-xl">
        <DialogHeader className="shrink-0 border-b border-slate-100 pb-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-left text-sm font-bold text-slate-800">
            <Terminal size={14} className="text-blue-500" />
            <span>
              {langCode === "ZH"
                ? "MCP在线沙箱测试"
                : langCode === "JA"
                ? "MCP オンラインサンドボックスデバッグ"
                : langCode === "ES"
                ? "MCP Depuración en línea"
                : "MCP Live Sandbox Debug"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 py-4 lg:grid-cols-[250px_1fr]">
          <McpTestTimeline currentStepIndex={currentStepIndex} langCode={langCode} stepDurations={stepDurations} stepStatuses={stepStatuses} steps={steps} />
          <McpTerminalLog
            terminalLogs={terminalLogs}
            langCode={langCode}
            onClearLogs={onClearLogs}
            onTriggerAlert={onTriggerAlert}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-3.5 select-none">
          <Button
            variant="outline"
            size="sm"
            onClick={onStartTest}
            disabled={debugStatus === "testing"}
            className="h-9 px-3.5 text-xs font-semibold rounded-lg"
          >
            {testStarted ? (
              <>
                <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${debugStatus === "testing" ? "animate-spin" : ""}`} />
                <span>{langCode === "ZH" ? "重新测试" : "Retest"}</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <span>{langCode === "ZH" ? "开始测试" : "Start Test"}</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold rounded-lg bg-black text-white hover:bg-zinc-900 border-none select-none transition-all cursor-pointer"
            >
              {langCode === "ZH" ? "关闭测试" : "Close Test"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
