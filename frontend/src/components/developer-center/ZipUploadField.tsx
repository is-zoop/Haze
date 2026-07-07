import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZipUploadFieldProps {
  zipName?: string;
  zipSize?: string;
  zipFiles?: { name: string; size: string }[];
  onUploaded: (file: File) => void;
  onClear: () => void;
  error?: string;
  placeholderDesc?: string;
  inputId: string;
}

export function ZipUploadField({
  zipName,
  zipSize,
  zipFiles,
  onUploaded,
  onClear,
  error,
  placeholderDesc,
  inputId,
}: ZipUploadFieldProps) {
  return (
    <div className="h-64 w-full">
      {zipName ? (
        /* Uploaded File List View (Requirement 7 / Image 4) */
        <div className="flex h-full w-full flex-col gap-2 animate-fade-in text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium select-none">
              已选择 {zipFiles?.length || 0} 个文件，总大小 {zipSize || "0 B"}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-blue-500 hover:text-blue-600 font-medium bg-transparent border-none cursor-pointer text-xs"
            >
              重新上传（清空）
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs">
            {(zipFiles || []).map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{file.name}</span>
                </div>
                <span className="text-slate-400 font-mono text-xs pr-1">{file.size}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Centered Upload Drop Area (Requirement 4 / Image 2) */
        <div 
          className={`border border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center text-center gap-3 relative cursor-pointer group h-full ${
            error 
              ? "border-destructive/60 bg-rose-50/10 hover:bg-rose-50/20" 
              : "border-blue-200 bg-white hover:bg-slate-50/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              if (file.name.endsWith(".zip")) {
                onUploaded(file);
              }
            }
          }}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <div className="h-10 w-10 shrink-0 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shadow-xs">
            <Upload className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">拖拽 zip 文件到此处，或点击选择</p>
            <p className="text-xs text-slate-400 leading-normal">
              {placeholderDesc || "支持 zip 文件需包含 SKILL.md，大小不超过 10MB"}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-8 px-4 text-xs font-bold rounded-lg bg-black text-white hover:bg-slate-800 border-none shadow-xs mt-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById(inputId)?.click();
            }}
          >
            选择 zip 文件
          </Button>

          <input
            id={inputId}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploaded(file);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
