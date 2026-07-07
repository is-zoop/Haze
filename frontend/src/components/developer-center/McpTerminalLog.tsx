import { Copy, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface McpTerminalLogProps {
  terminalLogs: Array<{ time: string; type: string; text: string }>;
  langCode: string;
  onClearLogs: () => void;
  onTriggerAlert: (msg: string) => void;
}

export function McpTerminalLog({
  terminalLogs,
  langCode,
  onClearLogs,
  onTriggerAlert,
}: McpTerminalLogProps) {
  const handleCopyLogs = () => {
    const plainText = terminalLogs
      .map((log) => `[${log.time}] [${log.type}] ${log.text}`)
      .join("\n");
    navigator.clipboard.writeText(plainText);
    onTriggerAlert(
      langCode === "ZH" ? "日志已成功复制到剪贴板" : "Logs copied to clipboard!"
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-100 bg-white">
      {/* Logger Operations Bar */}
      <div className="flex px-4 py-2.5 items-center justify-between border-b border-slate-100 shrink-0 select-none">
        <span className="text-xs font-bold text-slate-800">
          {langCode === "ZH"
            ? "调试测试日志"
            : langCode === "JA"
            ? "テストデバッグログ"
            : langCode === "ES"
            ? "Registro de depuración"
            : "Debug Test Logs"}
        </span>

        {/* Clear logs operations */}
        <Button
          variant="outline"
          size="sm"
          onClick={onClearLogs}
          className="h-7 px-2.5 text-xs bg-white border-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer select-none"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1 text-slate-400 inline" />
          {langCode === "ZH" ? "清空日志" : "Clear Logs"}
        </Button>
      </div>

      {/* Dark Monospace Terminal Logs Frame */}
      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-b-xl bg-slate-950 p-4 text-code select-text">
        {/* Floating Action: Copy Log content */}
        {terminalLogs.length > 0 && (
          <button
            onClick={handleCopyLogs}
            title={langCode === "ZH" ? "复制日志" : "Copy Logs"}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-900 rounded-md border border-slate-900/60 cursor-pointer"
          >
            <Copy size={13} />
          </button>
        )}

        {/* Lines mapping */}
        <div className="h-full space-y-1.5">
          {terminalLogs.length > 0 ? (
            terminalLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 leading-5"
              >
                {/* Log hours stamp */}
                <span className="text-slate-500 shrink-0 font-normal tabular-nums select-none">
                  [{log.time}]
                </span>

                {/* Log custom typed badges */}
                <span
                  className={`shrink-0 font-semibold select-none ${
                    log.type === "START"
                      ? "text-sky-400"
                      : log.type === "HTTP"
                      ? "text-blue-400 animate-pulse"
                      : log.type === "AUTH"
                      ? "text-amber-400"
                      : log.type === "MCP"
                      ? "text-violet-400"
                      : log.type === "TOOLS"
                      ? "text-cyan-400"
                      : log.type === "CALL"
                      ? "text-indigo-400"
                      : log.type === "SUCCESS"
                      ? "text-emerald-400 font-extrabold"
                      : "text-slate-350"
                  }`}
                >
                  [{log.type}]
                </span>

                {/* Line statement */}
                <span
                  className={`flex-grow break-all font-normal ${
                    log.type === "SUCCESS"
                      ? "text-emerald-400 font-semibold shadow-emerald-500/10"
                      : "text-slate-100"
                  }`}
                >
                  {log.text}
                </span>
              </div>
            ))
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center text-slate-500 text-xs select-none text-center">
              <div>
                <Terminal className="h-6 w-6 mx-auto mb-2 opacity-35" />
                <span>
                  {langCode === "ZH"
                    ? "等待在线调试启动..."
                    : "Waiting for debug sessions..."}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
