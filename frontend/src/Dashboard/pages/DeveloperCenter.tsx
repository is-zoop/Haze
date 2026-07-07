import {
  Plus,
  RotateCcw,
  Search,
  Code,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { UnifiedTabs, TabItem } from "@/components/UnifiedTabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FloatingAlert } from "@/components/ui/alert";

import { PageHeader } from "../../components/common/PageHeader";
import { DataTableFooter } from "../../components/common/DataTableFooter";
import { getI18n } from "../../i18n";
import { DeveloperAssetTable } from "../../components/developer-center/DeveloperAssetTable";
import { DeveloperAssetFormDialog } from "../../components/developer-center/DeveloperAssetFormDialog";
import { NewVersionDialog } from "../../components/developer-center/NewVersionDialog";
import { McpConnectionTestDialog } from "../../components/developer-center/McpConnectionTestDialog";
import { McpDeploymentProgressDialog } from "../../components/developer-center/McpDeploymentProgressDialog";
import { MCP_TEST_STEPS, STDIO_TEST_STEPS } from "../../components/developer-center/config";
import { AssetTypeFilter, useDeveloperCapabilities } from "../../components/developer-center/useDeveloperCapabilities";

interface PageProps {
  onBackToHome: () => void;
  langCode?: "ZH" | "EN" | "JA" | "ES";
}

export function DeveloperCenter({
  onBackToHome: _onBackToHome,
  langCode: _langCode = "ZH",
}: PageProps) {
  const t = getI18n(_langCode);
  const {
    assets, tabCounts, totalItems, totalPages, safeCurrentPage,
    searchQuery, setSearchQuery, activeTypeTab, setActiveTypeTab, statusFilter, setStatusFilter,
    pageSize, setPageSize, setCurrentPage, resetToFirstPage, handleResetFilters,
    showEditModal, setShowEditModal, isEditing, currentAsset, setCurrentAsset,
    tagsInputText, setTagsInputText, formErrors, setFormErrors,
    handleOpenAddAsset, handleOpenEditAsset, handleIconFileUploaded, handleZipFileUploaded, handleDocumentationUploaded, handleSaveAssetForm,
    showNewVersionModal, setShowNewVersionModal, newVersionAsset, newVersionNum, setNewVersionNum,
    newVersionDesc, setNewVersionDesc, newVersionZipName, setNewVersionZipName,
    newVersionZipSize, setNewVersionZipSize, newVersionZipFiles, setNewVersionZipFiles, setNewVersionPackageToken,
    newVersionErrors, handleIncrementVersion, handleNewVersionZipUploaded, handleSaveNewVersion,
    handleSubmitReview, handleDeployAsset, handleDebugComplete,
    handlePublishAsset, handleOfflineAsset, handleDeleteAsset, deleteTarget, setDeleteTarget,
    handleCopyAssetCode,
    showDebugModal, setShowDebugModal, debugAsset,
    debugStatus, currentStepIndex, terminalLogs, setTerminalLogs, stepDurations, stepStatuses,
    testStarted, setTestStarted, runRealTest,
    showDeployModal, setShowDeployModal, deployAsset, deployStatus, deployCurrentStepIndex,
    deployTerminalLogs, setDeployTerminalLogs, deployStepStatuses, deployErrorMessage,
    flashMessage, triggerFlashAlert,
  } = useDeveloperCapabilities(_langCode);

  const developerCenterTabs: TabItem[] = [
    {
      value: "all",
      label: (
        <span className="flex items-center gap-1">
          {_langCode === "ZH" ? "全部" : _langCode === "JA" ? "全て" : _langCode === "ES" ? "Todo" : "All"} <span className="font-normal opacity-80">{tabCounts.all}</span>
        </span>
      ),
    },
    {
      value: "Skill",
      label: <span className="flex items-center gap-1">Skill <span className="font-normal opacity-80">{tabCounts.skill}</span></span>,
    },
    {
      value: "MCP Server",
      label: <span className="flex items-center gap-1">MCP <span className="font-normal opacity-80">{tabCounts.mcp}</span></span>,
    },
  ];
  return (
    <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans flex flex-col gap-3 animate-in fade-in duration-300" id="haze-developer-center-container">
      {flashMessage && <FloatingAlert {...flashMessage} />}

      <PageHeader
        title={_langCode === "ZH" ? "开发者中心" : _langCode === "JA" ? "開発者センター" : _langCode === "ES" ? "Centro de Desarrolladores" : "Developer Center"}
        description={_langCode === "ZH" ? "在此登记或上传托管的 Skill 及受控 MCP 节点服务并执行全沙箱运行调试" : _langCode === "JA" ? "ホスト型 Skill および制御された MCP ノードの登録・公開とデバッグを実行" : _langCode === "ES" ? "Registre y cargue servicios de Skill y MCP para pruebas de depuración" : "Configure and spin up hosted Skill engines or custom controlled MCP server nodes"}
        breadcrumbs={[_langCode === "ZH" ? "首页" : _langCode === "JA" ? "ホーム" : _langCode === "ES" ? "Inicio" : "Home", _langCode === "ZH" ? "开发者中心" : _langCode === "JA" ? "開発者センター" : _langCode === "ES" ? "Centro de Desarrolladores" : "Developer Center"]}
        actions={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="default"
                className="w-full sm:w-auto"
              >
                <Plus size={16} />
                <span>{_langCode === "ZH" ? "注册能力" : _langCode === "JA" ? "新規追加" : _langCode === "ES" ? "Registrar" : "Add Capability"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs bg-white text-slate-700 border border-slate-100 shadow-md rounded-xl p-1 w-[140px] z-50 animate-none">
              <DropdownMenuItem
                onClick={() => handleOpenAddAsset("Skill")}
                className="cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center gap-1.5 animate-none"
              >
                <Code size={12} className="text-slate-400 animate-none" />
                <span>{t.developerUploadSkill}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleOpenAddAsset("MCP Server")}
                className="cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center gap-1.5 animate-none"
              >
                <Cpu size={12} className="text-slate-400 animate-none" />
                <span>{t.developerRegisterMcp}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/75 bg-white shadow-sm p-4 pt-2.5 pb-2.5 gap-3 overflow-hidden" id="haze-developer-page-overhaul">

        {/* Dynamic Type Filter Tabs */}
        <div id="haze-developer-tabs-container" className="shrink-0">
          <UnifiedTabs
            value={activeTypeTab}
            onValueChange={(value) => {
              setActiveTypeTab(value as AssetTypeFilter);
              resetToFirstPage();
            }}
            className="shrink-0 animate-fade-in"
            listClassName="h-9 rounded-lg bg-slate-100/80 p-1 border-none"
            triggerClassName="h-7 text-xs px-4 font-bold"
            tabs={developerCenterTabs}
          />
        </div>

        {/* Left Aligned Filters Toolbar - Heights of 40px */}
        <div className="flex flex-wrap items-center gap-3 shrink-0" id="haze-developer-filter-toolbar">
          <div className="relative w-full sm:w-[340px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
            <Input
              type="text"
              placeholder={
                _langCode === "ZH" ? "搜索资产名称、标识或工程..." 
                : _langCode === "JA" ? "名前、ID、またはプロジェクトで検索..." 
                : _langCode === "ES" ? "Buscar por nombre, ID o proyecto..." 
                : "Search asset name, code or project..."
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-10 pr-4 text-xs bg-background border border-border/70 rounded-lg focus-visible:ring-blue-500 text-foreground placeholder:text-muted-foreground font-semibold text-left"
            />
          </div>

          <Combobox
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val as any);
              setCurrentPage(1);
            }}
            items={[
              { value: "all", label: _langCode === "ZH" ? "全部状态" : _langCode === "JA" ? "全ステータス" : _langCode === "ES" ? "Todos estados" : "All Status" },
              { value: "published", label: _langCode === "ZH" ? "已发布" : _langCode === "JA" ? "公開済み" : _langCode === "ES" ? "Publicado" : "Published" },
              { value: "draft", label: _langCode === "ZH" ? "草稿" : _langCode === "JA" ? "下書き" : _langCode === "ES" ? "Borrador" : "Draft" },
              { value: "offline", label: _langCode === "ZH" ? "已下线" : _langCode === "JA" ? "オフライン" : _langCode === "ES" ? "Fuera de línea" : "Offline" },
              { value: "reviewing", label: _langCode === "ZH" ? "审核中" : _langCode === "JA" ? "審査中" : _langCode === "ES" ? "En revisión" : "Reviewing" }
            ]}
            className="w-[180px]"
          >
            <ComboboxInput className="h-10 w-[180px] bg-background border border-border/70 font-semibold text-xs rounded-lg text-foreground focus:outline-hidden" placeholder={_langCode === "ZH" ? "全部状态" : _langCode === "JA" ? "全ステータス" : _langCode === "ES" ? "Todos estados" : "All Status"} />
            <ComboboxContent className="w-[180px] bg-white">
              <ComboboxList>
                <ComboboxItem value="all">{_langCode === "ZH" ? "全部状态" : _langCode === "JA" ? "全ステータス" : _langCode === "ES" ? "Todos estados" : "All Status"}</ComboboxItem>
                <ComboboxItem value="published">{_langCode === "ZH" ? "已发布" : _langCode === "JA" ? "公开済み" : _langCode === "ES" ? "Publicado" : "Published"}</ComboboxItem>
                <ComboboxItem value="draft">{_langCode === "ZH" ? "草稿" : _langCode === "JA" ? "下書き" : _langCode === "ES" ? "Borrador" : "Draft"}</ComboboxItem>
                <ComboboxItem value="offline">{_langCode === "ZH" ? "已下线" : _langCode === "JA" ? "オフライン" : _langCode === "ES" ? "Fuera de línea" : "Offline"}</ComboboxItem>
                <ComboboxItem value="reviewing">{_langCode === "ZH" ? "审核中" : _langCode === "JA" ? "審査中" : _langCode === "ES" ? "En revisión" : "Reviewing"}</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Button
            variant="ghost"
            disabled={searchQuery === "" && statusFilter === "all" && activeTypeTab === "all"}
            onClick={handleResetFilters}
            className="h-10 px-4 text-xs font-semibold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <RotateCcw size={13} />
            <span>{_langCode === "ZH" ? "重置" : _langCode === "JA" ? "リセット" : _langCode === "ES" ? "Reiniciar" : "Reset"}</span>
          </Button>
        </div>

        {/* Assets Main Table Content and Pagination Wrapper */}
        <div className="flex-grow flex-1 min-h-0 flex flex-col gap-2" id="haze-developer-table-wrapper">
          <DeveloperAssetTable
            paginatedAssets={assets}
            langCode={_langCode}
            onOpenEditAsset={handleOpenEditAsset}
            onIncrementVersion={handleIncrementVersion}
            onCopyAssetCode={handleCopyAssetCode}
            onSubmitReview={handleSubmitReview}
            onDeployAsset={handleDeployAsset}
            onDebugComplete={handleDebugComplete}
            onPublishAsset={handlePublishAsset}
            onOfflineAsset={handleOfflineAsset}
            onSetDeleteTarget={setDeleteTarget}
          />

          <DataTableFooter
            totalItems={totalItems}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            langCode={_langCode}
          />
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm" className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-left">
              {_langCode === "ZH" ? "删除能力" : _langCode === "JA" ? "機能の削除" : _langCode === "ES" ? "Eliminar capacidad" : "Delete Capability"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-left">
              {_langCode === "ZH" ? `确认删除 ${deleteTarget?.name}？该操作会从当前工作区移除此能力。` 
               : _langCode === "JA" ? `本当に ${deleteTarget?.name} を削除しますか？この操作によりワークスペースからアセットがクリーアされます。` 
               : _langCode === "ES" ? `¿Está seguro de que desea eliminar ${deleteTarget?.name}? Esta acción eliminará esta capacidad de su espacio de trabajo.` 
               : `Are you sure you want to delete ${deleteTarget?.name}? This action will remove this capability from the active workspace.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="cursor-pointer">
              {_langCode === "ZH" ? "取消" : _langCode === "JA" ? "キャンセル" : _langCode === "ES" ? "Cancelar" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction size="sm" variant="destructive" className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer border-none" onClick={() => deleteTarget && handleDeleteAsset(deleteTarget)}>
              {_langCode === "ZH" ? "删除" : _langCode === "JA" ? "削除" : _langCode === "ES" ? "Eliminar" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modularized Configuration Modal for Adding/Editing */}
      <DeveloperAssetFormDialog
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        isEditing={isEditing}
        currentAsset={currentAsset}
        setCurrentAsset={setCurrentAsset}
        tagsInputText={tagsInputText}
        setTagsInputText={setTagsInputText}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        onSave={handleSaveAssetForm}
        onZipUploaded={handleZipFileUploaded}
        onDocumentationUploaded={handleDocumentationUploaded}
        onIconUploaded={handleIconFileUploaded}
        onClearZip={() => {
          setCurrentAsset(prev => ({ ...prev, packageUploadToken: undefined, zipName: undefined, zipSize: undefined, zipFiles: undefined }));
        }}
        onClearDocumentation={() => {
          setCurrentAsset(prev => ({ ...prev, documentationUploadToken: undefined, documentationSize: undefined, documentationFiles: undefined }));
        }}
      />

      {/* Modularized Versioning Dialogue */}
      <NewVersionDialog
        open={showNewVersionModal}
        onClose={() => setShowNewVersionModal(false)}
        newVersionAsset={newVersionAsset}
        newVersionNum={newVersionNum}
        setNewVersionNum={setNewVersionNum}
        newVersionDesc={newVersionDesc}
        setNewVersionDesc={setNewVersionDesc}
        newVersionZipName={newVersionZipName}
        newVersionZipSize={newVersionZipSize}
        newVersionZipFiles={newVersionZipFiles}
        onZipUploaded={handleNewVersionZipUploaded}
        onClearZip={() => {
          setNewVersionZipName("");
          setNewVersionZipSize("");
          setNewVersionZipFiles([]);
          setNewVersionPackageToken(undefined);
        }}
        newVersionErrors={newVersionErrors}
        onSave={handleSaveNewVersion}
      />

      <McpDeploymentProgressDialog
        open={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        asset={deployAsset}
        langCode={_langCode}
        deployStatus={deployStatus}
        currentStepIndex={deployCurrentStepIndex}
        terminalLogs={deployTerminalLogs}
        stepStatuses={deployStepStatuses}
        errorMessage={deployErrorMessage}
        onClearLogs={() => setDeployTerminalLogs([])}
        onTriggerAlert={triggerFlashAlert}
      />
      <McpConnectionTestDialog
        open={showDebugModal}
        onClose={() => { setShowDebugModal(false); setTestStarted(false); }}
        debugAsset={debugAsset}
        langCode={_langCode}
        debugStatus={debugStatus}
        currentStepIndex={currentStepIndex}
        terminalLogs={terminalLogs}
        stepDurations={stepDurations}
        stepStatuses={stepStatuses}
        testStarted={testStarted}
        onStartTest={() => { setTestStarted(true); runRealTest(); }}
        onClearLogs={() => setTerminalLogs([])}
        onTriggerAlert={triggerFlashAlert}
        steps={debugAsset?.transport === "HTTP" ? MCP_TEST_STEPS : STDIO_TEST_STEPS}
      />

    </div>
  );
}
