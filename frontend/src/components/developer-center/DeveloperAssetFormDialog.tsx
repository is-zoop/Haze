import { useEffect, useState } from "react";
import { File as FileIcon, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { DeveloperAsset } from "../../types/developer-center";
import { BusinessCategory, listBusinessCategories } from "../../lib/businessCategories";
import { FormField } from "./FormField";
import { ZipUploadField } from "./ZipUploadField";

const DefaultGridIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="#4f46e5" />
    <rect x="11" y="6.5" width="2.5" height="2.5" rx="0.5" transform="rotate(45 11 6.5)" fill="white" />
    <rect x="7.5" y="10" width="2.5" height="2.5" rx="0.5" transform="rotate(45 7.5 10)" fill="white" />
    <rect x="14.5" y="10" width="2.5" height="2.5" rx="0.5" transform="rotate(45 14.5 10)" fill="white" />
    <rect x="11" y="13.5" width="2.5" height="2.5" rx="0.5" transform="rotate(45 11 13.5)" fill="white" />
  </svg>
);

interface DeveloperAssetFormDialogProps {
  open: boolean;
  onClose: () => void;
  isEditing?: boolean;
  currentAsset: Partial<DeveloperAsset>;
  setCurrentAsset: React.Dispatch<React.SetStateAction<Partial<DeveloperAsset>>>;
  tagsInputText: string;
  setTagsInputText: (val: string) => void;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (event: React.FormEvent) => void;
  onZipUploaded: (file: File) => void;
  onDocumentationUploaded: (file: File) => void;
  onIconUploaded: (file: File, previewUrl: string) => void;
  onClearZip: () => void;
  onClearDocumentation: () => void;
}

const ZIP_LOCKED_STATUSES = new Set([
  "deployed", "debug_passed", "debug_failed", "published", "offline",
]);

export function DeveloperAssetFormDialog({
  open,
  onClose,
  isEditing = false,
  currentAsset,
  setCurrentAsset,
  tagsInputText,
  setTagsInputText,
  formErrors,
  setFormErrors,
  onSave,
  onZipUploaded,
  onDocumentationUploaded,
  onIconUploaded,
  onClearZip,
  onClearDocumentation,
}: DeveloperAssetFormDialogProps) {
  const isZipLocked = isEditing && ZIP_LOCKED_STATUSES.has(currentAsset.status ?? "");
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  useEffect(() => { if (open) void listBusinessCategories().then(setCategories); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl p-6 bg-white border-border shadow-xl rounded-xl">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-start gap-2.5 text-left">
            <div className="mt-1 text-blue-500 font-bold select-none">
              <Sparkles size={18} className="fill-blue-500/10 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-800 flex items-center leading-tight">
                {currentAsset.type === "MCP Server" ? "编辑 MCP 配置" : "编辑 Skill 配置"}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-6 py-4">
          {/* ROW 1: 名称 | Slug | 连接方式(仅MCP) */}
          <div className={`grid grid-cols-1 ${currentAsset.type === "MCP Server" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6`}>
            <FormField
              label={currentAsset.type === "MCP Server" ? "MCP 名称" : "Skill 名称"}
              required
              error={formErrors.name}
            >
              <div className="relative flex items-center">
                <Input
                  required
                  value={currentAsset.name || ""}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val.length <= 100) {
                      setCurrentAsset((prev) => ({ ...prev, name: val }));
                      if (formErrors.name) {
                        setFormErrors(prev => ({ ...prev, name: "" }));
                      }
                    }
                  }}
                  placeholder={currentAsset.type === "MCP Server" ? "请输入 MCP 连接服务器名称" : "财务报表摘要智能生成器"}
                  className={`h-9 pr-14 text-xs bg-white rounded-lg ${formErrors.name ? "border-destructive focus-visible:ring-destructive" : "border-slate-200"}`}
                />
                <span className="absolute right-3 text-xs select-none text-muted-foreground/60 font-mono">
                  {(currentAsset.name || "").length} / 100
                </span>
              </div>
            </FormField>

            <FormField
              label="Slug"
              required
              error={formErrors.code}
            >
              <Input
                required
                disabled={isEditing}
                value={currentAsset.code || ""}
                onChange={(event) => {
                  setCurrentAsset((prev) => ({ ...prev, code: event.target.value }));
                  if (formErrors.code) {
                    setFormErrors(prev => ({ ...prev, code: "" }));
                  }
                }}
                placeholder="支持小写字母、数字和中划线，3-50 个字符"
                className={`h-9 text-xs font-mono placeholder:text-slate-350 rounded-lg ${
                  isEditing
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                    : formErrors.code
                    ? "bg-white border-destructive focus-visible:ring-destructive"
                    : "bg-white border-slate-200"
                }`}
              />
            </FormField>

            {currentAsset.type === "MCP Server" && (
              <FormField label="连接方式">
                {isEditing ? (
                  <Input
                    disabled
                    value={currentAsset.transport || "HTTP"}
                    className="h-9 text-xs font-semibold bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200 rounded-lg"
                  />
                ) : (
                  <Combobox
                    value={currentAsset.transport || "HTTP"}
                    onValueChange={(value) => setCurrentAsset((prev) => ({ ...prev, transport: value as any }))}
                    items={[
                      { value: "HTTP", label: "HTTP" },
                      { value: "STDIO", label: "STDIO" }
                    ]}
                    className="w-full"
                  >
                    <ComboboxInput className="w-full h-9 font-semibold text-xs rounded-lg bg-white border-slate-200" placeholder="HTTP" />
                    <ComboboxContent className="w-full bg-white rounded-lg">
                      <ComboboxList>
                        <ComboboxItem value="HTTP">HTTP</ComboboxItem>
                        <ComboboxItem value="STDIO">STDIO</ComboboxItem>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
              </FormField>
            )}
          </div>

          {/* ROW 2: 图标 | 业务分类 | 标签 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* 图标 (Requirement 5 / Image 3) */}
            <FormField label="图标" error={formErrors.icon}>
              <div
                onClick={() => document.getElementById("asset-icon-upload-input2")?.click()}
                className="flex items-center gap-3 w-full border border-slate-200 rounded-lg bg-white px-3 py-2 h-9 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="h-6 w-6 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                  {currentAsset.icon ? (
                    <img src={currentAsset.icon} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <DefaultGridIcon />
                  )}
                </div>
                <span className="text-xs text-slate-700 font-medium select-none">已选择图标</span>
                <input
                  id="asset-icon-upload-input2"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        onIconUploaded(file, e.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </FormField>

            {/* 业务分类 (Requirement 6) */}
            <FormField
              label="业务分类"
              required
              error={formErrors.project}
            >
              <Combobox
                value={currentAsset.categoryId ? String(currentAsset.categoryId) : ""}
                onValueChange={(value) => {
                  const category = categories.find((item) => String(item.id) === String(value));
                  setCurrentAsset((prev) => ({ ...prev, categoryId: Number(value), project: category?.name ?? "" }));
                  if (formErrors.project) {
                    setFormErrors((prev) => ({ ...prev, project: "" }));
                  }
                }}
                items={categories.map((category) => ({
                  value: String(category.id),
                  label: category.name,
                }))}
                className="w-full"
              >
                <ComboboxInput
                  className={`h-9 w-full bg-white text-xs font-normal text-slate-800 ${
                    formErrors.project ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "border-slate-200"
                  }`}
                  placeholder="选择业务分类"
                />
                <ComboboxContent className="w-full bg-white">
                  <ComboboxList>
                    {categories.map((category) => (
                      <ComboboxItem key={category.id} value={String(category.id)} className="font-normal">
                        {category.name}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </FormField>

            {/* 能力标签 (Requirement 3) */}
            <FormField
              label="能力标签"
              description="输入时可以用逗号（英文 , 或者是中文 ，）隔开多个标签"
            >
              <Input
                type="text"
                value={tagsInputText}
                onChange={(e) => {
                  const typed = e.target.value;
                  setTagsInputText(typed);
                  
                  const tagsArray = typed
                    .split(/[,，]/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                  setCurrentAsset((prev) => ({
                    ...prev,
                    tags: tagsArray,
                  }));
                }}
                placeholder="例如：数据分析，电商运营，自动化"
                className="h-9 text-xs placeholder:text-slate-350 bg-white rounded-lg border-slate-200"
              />
            </FormField>
          </div>

          {/* ROW 3: Skill / MCP 文件 */}
          {(currentAsset.type === "Skill" || currentAsset.type === "MCP Server") && (
            <Tabs defaultValue="package" className="space-y-3">
              <TabsList className="h-9 w-fit rounded-lg bg-slate-100 p-1">
                <TabsTrigger value="package" className="h-7 px-4 text-xs">
                  {currentAsset.type === "MCP Server" ? "MCP 文件" : "Skill 文件"}
                </TabsTrigger>
                <TabsTrigger value="documentation" className="h-7 px-4 text-xs">说明文档</TabsTrigger>
              </TabsList>
              <TabsContent value="package" className="mt-0">
                <FormField
              label={currentAsset.type === "MCP Server" ? "MCP 文件" : "Skill 文件"}
              required={!isZipLocked}
              error={formErrors.zipName}
            >
              {isZipLocked ? (
                <div className="flex h-64 flex-col rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">
                      {currentAsset.zipFiles && currentAsset.zipFiles.length > 0
                        ? `已选择 ${currentAsset.zipFiles.length} 个文件，总大小 ${currentAsset.zipSize}`
                        : "当前版本文件"}
                    </span>
                    <span className="text-xs text-amber-600 font-medium">如需更新文件，请新建版本</span>
                  </div>
                  {currentAsset.zipFiles && currentAsset.zipFiles.length > 0 ? (
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 pr-1">
                      {currentAsset.zipFiles.map((f) => (
                        <div key={f.name} className="flex items-center justify-between py-1.5 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileIcon size={13} className="text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 truncate">{f.name}</span>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{f.size}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">文件信息不可用，如需更新请新建版本</span>
                  )}
                </div>
              ) : (
                <ZipUploadField
                  zipName={currentAsset.zipName}
                  zipSize={currentAsset.zipSize}
                  zipFiles={currentAsset.zipFiles}
                  onUploaded={onZipUploaded}
                  onClear={onClearZip}
                  error={formErrors.zipName}
                  placeholderDesc={
                    currentAsset.type === "MCP Server"
                      ? "支持 zip 文件需包含 MCP 逻辑或配置文件，大小不超过 10MB"
                      : "支持 zip 文件需包含 SKILL.md，大小不超过 10MB"
                  }
                  inputId="skill-zip-file-input2"
                />
              )}
                </FormField>
              </TabsContent>
              <TabsContent value="documentation" className="mt-0">
                <FormField label="说明文档" error={formErrors.documentation}>
                  <ZipUploadField
                    zipName={currentAsset.documentationFiles?.length ? "documentation.zip" : undefined}
                    zipSize={currentAsset.documentationSize}
                    zipFiles={currentAsset.documentationFiles}
                    onUploaded={onDocumentationUploaded}
                    onClear={onClearDocumentation}
                    error={formErrors.documentation}
                    placeholderDesc="支持 zip 文件，可包含 quick_start.md、README.md、图片及其他说明文档，大小不超过 10MB"
                    inputId="documentation-zip-file-input"
                  />
                </FormField>
              </TabsContent>
            </Tabs>
          )}

          {/* ROW 4: Skill 描述 / MCP 描述 (Requirement 6) */}
          <FormField
            label={currentAsset.type === "MCP Server" ? "MCP 描述" : "Skill 描述"}
            required
            error={formErrors.description}
          >
            <div className="relative">
              <Textarea
                value={currentAsset.description || ""}
                onChange={(event) => {
                  const val = event.target.value;
                  setCurrentAsset((prev) => ({ ...prev, description: val }));
                  if (formErrors.description) {
                    setFormErrors(prev => ({ ...prev, description: "" }));
                  }
                }}
                placeholder={currentAsset.type === "MCP Server" 
                  ? "通过提供专用的 MCP 数据源或特定服务连接器，功能赋能大语言模型执行高级数据检索、SQL安全执行等扩展操作的 MCP 服务配置。"
                  : "通过读取 PDF 或 Excel 报表，对企业的季度、年度财报进行核心指标提取与分析，并产出标准化文档生成的 AI Skill。"}
                className={`min-h-[110px] text-xs bg-white rounded-lg border-slate-200 leading-relaxed resize-none pr-16 ${
                  formErrors.description ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              <div className={`absolute right-3 bottom-2 text-xs font-mono select-none ${
                  (currentAsset.description || "").length > 300 ? "text-rose-500 font-bold" : "text-muted-foreground/60"
                }`}
              >
                {(currentAsset.description || "").length} / 300
              </div>
            </div>
          </FormField>
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
            onClick={onSave} 
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer text-xs rounded-lg"
          >
            保存草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
