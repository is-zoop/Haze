import React from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DeveloperAsset } from "../../types/developer-center";
import { FormField } from "./FormField";
import { ZipUploadField } from "./ZipUploadField";

interface NewVersionDialogProps {
  open: boolean;
  onClose: () => void;
  newVersionAsset: DeveloperAsset | null;
  newVersionNum: string;
  setNewVersionNum: (val: string) => void;
  newVersionDesc: string;
  setNewVersionDesc: (val: string) => void;
  newVersionZipName: string;
  newVersionZipSize: string;
  newVersionZipFiles: Array<{ name: string; size: string }>;
  onZipUploaded: (file: File) => void;
  onClearZip: () => void;
  newVersionErrors: Record<string, string>;
  onSave: (event: React.FormEvent) => void;
}

export function NewVersionDialog({
  open,
  onClose,
  newVersionAsset,
  newVersionNum,
  setNewVersionNum,
  newVersionDesc,
  setNewVersionDesc,
  newVersionZipName,
  newVersionZipSize,
  newVersionZipFiles,
  onZipUploaded,
  onClearZip,
  newVersionErrors,
  onSave,
}: NewVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl p-6 bg-white border-border shadow-xl rounded-xl">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-start gap-2.5 text-left">
            <div className="mt-1 text-amber-500 font-bold select-none">
              <Sparkles size={18} className="fill-amber-500/10 text-amber-500 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-800 flex items-center leading-tight">
                新建{newVersionAsset?.name}版本
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-6 py-4">
          {/* 1. Skill名称和版本号 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <FormField label="Skill 名称">
              <input
                disabled
                value={newVersionAsset?.name || ""}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs font-medium text-slate-500 shadow-xs cursor-not-allowed select-none outline-none"
              />
            </FormField>

            <FormField
              label="版本号"
              required
              error={newVersionErrors.version}
            >
              <div className={`flex h-9 w-full items-center rounded-lg border bg-white focus-within:ring-1 focus-within:ring-ring overflow-hidden ${
                newVersionErrors.version ? "border-destructive focus-within:ring-destructive" : "border-slate-200"
              }`}>
                <span className="flex items-center justify-center bg-slate-50 text-slate-500 font-bold px-3 py-1.5 border-r border-input h-full text-xs select-none">
                  v
                </span>
                <input
                  required
                  type="text"
                  value={newVersionNum}
                  onChange={(event) => {
                    const val = event.target.value.replace(/^v/i, "");
                    setNewVersionNum(val);
                  }}
                  placeholder="建议遵循语义化版本，输入其数字部分：如 1.3.0"
                  className="h-full min-w-0 flex-1 border-0 bg-white px-3 text-xs font-medium text-foreground outline-none font-mono"
                />
              </div>
            </FormField>
          </div>

          <FormField
            label="版本说明"
            required
            error={newVersionErrors.description}
          >
            <Textarea
              required
              rows={3}
              value={newVersionDesc}
              onChange={(event) => setNewVersionDesc(event.target.value)}
              placeholder="例如：补充核心运行参数验证，修复大文本截断逻辑，调优 prompt 模版。限制 300 字。"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring border-slate-200 min-h-[90px] leading-relaxed resize-none ${
                newVersionErrors.description ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
          </FormField>

          {/* 2. Upload Zip area custom binding */}
          {(newVersionAsset?.type === "Skill" || newVersionAsset?.type === "MCP Server") && (
            <FormField
              label={newVersionAsset.type === "MCP Server" ? "MCP 文件" : "Skill 文件"}
              required
              error={newVersionErrors.zipName}
            >
              <ZipUploadField
                zipName={newVersionZipName}
                zipSize={newVersionZipSize}
                zipFiles={newVersionZipFiles}
                onUploaded={onZipUploaded}
                onClear={onClearZip}
                error={newVersionErrors.zipName}
                placeholderDesc={
                  newVersionAsset.type === "MCP Server"
                    ? "支持 zip 文件需包含 server.py 及依赖，大小不超过 10MB"
                    : "支持 zip 文件需包含 SKILL.md，大小不超过 10MB"
                }
                inputId="new-version-zip-file-input"
              />
            </FormField>
          )}
        </form>

        <DialogFooter className="border-t border-border pt-4 flex shrink-0 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg cursor-pointer"
            onClick={onClose}
          >
            取消
          </Button>
          <Button 
            type="button" 
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onSave(e);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer text-xs rounded-lg"
          >
            创建新版本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
