import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  createCapability,
  createCapabilityVersion,
  deleteCapability,
  deployCapability,
  getMcpDeploymentLogs,
  listMcpDeployments,
  listMcpDeployTasks,
  type McpDeployTask,
  type McpDeployment,
  formatFileSize,
  listCapabilities,
  loadCapabilityIcon,
  offlineCapability,
  publishCapability,
  submitReviewCapability,
  updateCapability,
  uploadCapabilityDocumentation,
  uploadCapabilityFile,
  uploadCapabilityIcon,
} from "../../lib/capabilities";
import { getI18n } from "../../i18n";
import { AssetStatus, DeveloperAsset } from "../../types/developer-center";
import { DEFAULT_ASSET } from "./config";
import type { FlashMessage } from "../ui/alert";
import skillDefaultIcon from "../../assets/images/skill_icon.png";
import mcpDefaultIcon from "../../assets/images/mcp_icon.png";

const AUTH_TOKEN_KEY = "haze_access_token";

const HTTP_MCP_PACKAGE_EDIT_STATUSES = new Set(["approved", "deploy_failed", "deployed", "debug_failed", "debug_passed"]);

function isHttpMcp(asset: Partial<DeveloperAsset>) {
  return asset.type === "MCP Server" && asset.transport !== "STDIO";
}

function isHttpMcpPackageReplacement(asset: Partial<DeveloperAsset>) {
  return isHttpMcp(asset) && HTTP_MCP_PACKAGE_EDIT_STATUSES.has(asset.status ?? "") && Boolean(asset.packageUploadToken);
}

function isUploadTokenError(message: string) {
  return message.includes("Upload token") || message.includes("上传凭证") || message.includes("上传 token");
}

function isCapabilityCodeError(message: string) {
  return message.includes("Capability code") || message.includes("Slug") || message.includes("能力编码");
}

export type AssetTypeFilter = "all" | "Skill" | "MCP Server";

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "请求失败，请稍后重试";
}

async function uploadDefaultCapabilityIcon(type: "Skill" | "MCP Server"): Promise<string> {
  const iconUrl = type === "MCP Server" ? mcpDefaultIcon : skillDefaultIcon;
  const fileName = type === "MCP Server" ? "mcp_icon.png" : "skill_icon.png";
  const response = await fetch(iconUrl);
  if (!response.ok) throw new Error("默认图标读取失败");
  const blob = await response.blob();
  const upload = await uploadCapabilityIcon(new File([blob], fileName, { type: blob.type || "image/png" }));
  return upload.uploadToken;
}

function formatDeployLogTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function deploymentStepIndex(deployment: McpDeployment | null, task: McpDeployTask | null, logs: string): number {
  if (task?.task_status === "success" || deployment?.deploy_status === "running") return 5;
  if (task?.task_status === "failed" || deployment?.deploy_status === "failed") return 5;
  if (!deployment || deployment.deploy_status === "pending") return 0;
  if (deployment.deploy_status === "building") return 1;
  if (logs.includes("Pod Ready")) return 4;
  if (logs.includes("K8s Service") || logs.includes("K8s Deployment")) return 3;
  if (deployment.deploy_status === "deploying") return 2;
  return 0;
}

function deploymentStepStatuses(deployment: McpDeployment | null, task: McpDeployTask | null, currentStep: number): Record<number, "pass" | "fail"> {
  if (task?.task_status === "success" || deployment?.deploy_status === "running") return { 0: "pass", 1: "pass", 2: "pass", 3: "pass", 4: "pass", 5: "pass" };
  if (task?.task_status === "failed" || deployment?.deploy_status === "failed") {
    return Object.fromEntries(Array.from({ length: Math.max(currentStep, 0) }, (_, index) => [index, "pass"]).concat([[currentStep, "fail"]])) as Record<number, "pass" | "fail">;
  }
  return Object.fromEntries(Array.from({ length: Math.max(currentStep, 0) }, (_, index) => [index, "pass"])) as Record<number, "pass" | "fail">;
}

function deploymentLogsToTerminal(logs: string, task: McpDeployTask | null): Array<{ time: string; type: string; text: string }> {
  const lines = logs.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const time = formatDeployLogTime();
  const terminal = lines.map((line) => ({
    time,
    type: line.includes("镜像") ? "BUILD" : line.includes("K8s") ? "K8S" : line.includes("Pod") ? "READY" : line.includes("Gateway") ? "ROUTE" : line.includes("成功") ? "SUCCESS" : "DEPLOY",
    text: line,
  }));
  if (task?.error_message) terminal.push({ time, type: "ERROR", text: task.error_message });
  if (!terminal.length) terminal.push({ time, type: "DEPLOY", text: "等待部署任务写入日志..." });
  return terminal;
}
export function useDeveloperCapabilities(langCode: "ZH" | "EN" | "JA" | "ES") {
  const t = getI18n(langCode);
  const formatAlert = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce((message, [key, value]) => message.replace(`{${key}}`, value), template);
  const [assets, setAssets] = useState<DeveloperAsset[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ all: 0, skill: 0, mcp: 0 });
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeTab, setActiveTypeTab] = useState<AssetTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AssetStatus>("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<Partial<DeveloperAsset>>(DEFAULT_ASSET);
  const [tagsInputText, setTagsInputText] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionAsset, setNewVersionAsset] = useState<DeveloperAsset | null>(null);
  const [newVersionNum, setNewVersionNum] = useState("");
  const [newVersionDesc, setNewVersionDesc] = useState("");
  const [newVersionZipName, setNewVersionZipName] = useState("");
  const [newVersionZipSize, setNewVersionZipSize] = useState("");
  const [newVersionZipFiles, setNewVersionZipFiles] = useState<{ name: string; size: string }[]>([]);
  const [newVersionPackageToken, setNewVersionPackageToken] = useState<string>();
  const [newVersionErrors, setNewVersionErrors] = useState<Record<string, string>>({});

  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugAsset, setDebugAsset] = useState<DeveloperAsset | null>(null);
  const [debugStatus, setDebugStatus] = useState<"idle" | "testing" | "pass" | "fail">("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ time: string; type: string; text: string }>>([]);
  const [stepDurations, setStepDurations] = useState<Record<number, string>>({});
  const [stepStatuses, setStepStatuses] = useState<Record<number, "pass" | "fail">>({});
  const [testStarted, setTestStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployAsset, setDeployAsset] = useState<DeveloperAsset | null>(null);
  const [deployStatus, setDeployStatus] = useState<"idle" | "creating" | "running" | "success" | "fail">("idle");
  const [deployDeploymentId, setDeployDeploymentId] = useState<number | null>(null);
  const [deployCurrentStepIndex, setDeployCurrentStepIndex] = useState(0);
  const [deployTerminalLogs, setDeployTerminalLogs] = useState<Array<{ time: string; type: string; text: string }>>([]);
  const [deployStepStatuses, setDeployStepStatuses] = useState<Record<number, "pass" | "fail">>({});
  const [deployErrorMessage, setDeployErrorMessage] = useState<string | null>(null);
  const deploySessionRef = useRef(0);

  const [deleteTarget, setDeleteTarget] = useState<DeveloperAsset | null>(null);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const iconUrlsRef = useRef<string[]>([]);
  const iconUploadPromiseRef = useRef<Promise<string | null> | null>(null);
  const requestIdRef = useRef(0);

  const triggerFlashAlert = useCallback((message: FlashMessage) => {
    setFlashMessage(message);
    window.setTimeout(() => setFlashMessage(null), 3000);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const type = activeTypeTab === "Skill" ? "skill" : activeTypeTab === "MCP Server" ? "mcp" : undefined;
        const result = await listCapabilities({
          page: currentPage,
          pageSize,
          search: searchQuery.trim(),
          type,
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        const hydrated = await Promise.all(result.items.map(async (asset) => {
          if (!asset.icon) return asset;
          try {
            return { ...asset, icon: await loadCapabilityIcon(asset.icon) };
          } catch {
            return { ...asset, icon: undefined };
          }
        }));
        if (requestId !== requestIdRef.current) {
          hydrated.forEach((asset) => asset.icon?.startsWith("blob:") && URL.revokeObjectURL(asset.icon));
          return;
        }
        iconUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        iconUrlsRef.current = hydrated.flatMap((asset) => asset.icon?.startsWith("blob:") ? [asset.icon] : []);
        setAssets(hydrated);
        setTotalItems(result.total);
        setCounts(result.counts);
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setAssets([]);
          setTotalItems(0);
          triggerFlashAlert({ type: "error", title: t.alertLoadFailedTitle, description: errorMessage(error) });
        }
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeTypeTab, currentPage, pageSize, refreshVersion, searchQuery, statusFilter, triggerFlashAlert]);

  useEffect(() => () => {
    iconUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!showDeployModal || deployDeploymentId === null || deployStatus === "success" || deployStatus === "fail") return;
    let cancelled = false;

    const pollDeployment = async () => {
      try {
        const [deployments, tasks, logs] = await Promise.all([
          listMcpDeployments(),
          listMcpDeployTasks(deployDeploymentId),
          getMcpDeploymentLogs(deployDeploymentId),
        ]);
        if (cancelled) return;
        const deployment = deployments.find((item) => item.id === deployDeploymentId) ?? null;
        const latestTask = tasks[0] ?? null;
        const currentStep = deploymentStepIndex(deployment, latestTask, logs);
        const nextStatus = latestTask?.task_status === "failed" || deployment?.deploy_status === "failed"
          ? "fail"
          : latestTask?.task_status === "success" || deployment?.deploy_status === "running"
          ? "success"
          : "running";
        setDeployCurrentStepIndex(currentStep);
        setDeployStepStatuses(deploymentStepStatuses(deployment, latestTask, currentStep));
        setDeployTerminalLogs(deploymentLogsToTerminal(logs, latestTask));
        setDeployErrorMessage(latestTask?.error_message ?? deployment?.last_error ?? null);
        setDeployStatus(nextStatus);
        if (nextStatus === "success") refresh();
      } catch (error) {
        if (!cancelled) {
          setDeployStatus("fail");
          setDeployErrorMessage(errorMessage(error));
          setDeployTerminalLogs((previous) => previous.length ? previous : [{ time: formatDeployLogTime(), type: "ERROR", text: errorMessage(error) }]);
        }
      }
    };

    pollDeployment();
    const timer = window.setInterval(pollDeployment, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deployDeploymentId, deployStatus, showDeployModal]);
  useEffect(() => {
    if (!showDeployModal || !deployAsset || deployDeploymentId !== null || deployStatus !== "running") return;
    let cancelled = false;
    const findDeployment = async () => {
      try {
        const deployments = await listMcpDeployments();
        if (cancelled) return;
        const deployment = deployments.find((item) => String(item.capability_id) === String(deployAsset.id));
        if (deployment) setDeployDeploymentId(deployment.id);
      } catch (error) {
        if (!cancelled) {
          setDeployStatus("fail");
          setDeployErrorMessage(errorMessage(error));
        }
      }
    };
    findDeployment();
    const timer = window.setInterval(findDeployment, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deployAsset, deployDeploymentId, deployStatus, showDeployModal]);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const refresh = () => setRefreshVersion((value) => value + 1);
  const resetToFirstPage = () => setCurrentPage(1);
  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveTypeTab("all");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const handleOpenAddAsset = (type: "Skill" | "MCP Server" = "Skill") => {
    setIsEditing(false);
    setFormErrors({});
    setTagsInputText("");
    iconUploadPromiseRef.current = null;
    setCurrentAsset({
      ...DEFAULT_ASSET,
      type,
      icon: type === "MCP Server" ? mcpDefaultIcon : skillDefaultIcon,
      project: "企业办公",
      version: "v1.0.0",
      description: "",
    });
    setShowEditModal(true);
  };

  const handleOpenEditAsset = (asset: DeveloperAsset) => {
    setIsEditing(true);
    setFormErrors({});
    setTagsInputText((asset.tags || []).join("，"));
    iconUploadPromiseRef.current = null;
    setCurrentAsset({ ...asset, iconUploadToken: undefined, packageUploadToken: undefined, documentationUploadToken: undefined });
    setShowEditModal(true);
  };

  const handleIconFileUploaded = async (file: File, previewUrl: string) => {
    setCurrentAsset((previous) => ({ ...previous, icon: previewUrl, iconUploadToken: undefined }));
    let uploadPromise: Promise<string | null>;
    uploadPromise = uploadCapabilityIcon(file)
      .then((upload) => {
        if (iconUploadPromiseRef.current === uploadPromise) {
          setCurrentAsset((previous) => ({ ...previous, iconUploadToken: upload.uploadToken }));
          setFormErrors((previous) => ({ ...previous, icon: "" }));
        }
        return upload.uploadToken;
      })
      .catch((error) => {
        if (iconUploadPromiseRef.current === uploadPromise) {
          setFormErrors((previous) => ({ ...previous, icon: errorMessage(error) }));
        }
        return null;
      });
    iconUploadPromiseRef.current = uploadPromise;
    await uploadPromise;
  };

  const handleZipFileUploaded = async (file: File) => {
    try {
      const type = currentAsset.type === "MCP Server" ? "mcp" : "skill";
      const upload = await uploadCapabilityFile(file, type);
      const mcpConfig = upload.manifest?.["mcp.json"] as Record<string, string> | undefined;
      setCurrentAsset((previous) => ({
        ...previous,
        packageUploadToken: upload.uploadToken,
        zipName: upload.fileName,
        zipSize: formatFileSize(upload.size),
        zipFiles: upload.files.map((item) => ({ name: item.name, size: formatFileSize(item.size) })),
        ...(mcpConfig && previous.type === "MCP Server" ? {
          transport: mcpConfig.transport?.toLowerCase() === "stdio" ? "STDIO" : "HTTP",
          serverUrl: mcpConfig.serverUrl ?? previous.serverUrl,
          startCommand: mcpConfig.command ?? previous.startCommand,
          startArgs: mcpConfig.args ?? previous.startArgs,
        } : {}),
      }));
      setFormErrors((previous) => ({ ...previous, zipName: "" }));
    } catch (error) {
      setFormErrors((previous) => ({ ...previous, zipName: errorMessage(error) }));
    }
  };

  const handleDocumentationUploaded = async (file: File) => {
    try {
      const upload = await uploadCapabilityDocumentation(file);
      setCurrentAsset((previous) => ({
        ...previous,
        documentationUploadToken: upload.uploadToken,
        documentationSize: formatFileSize(upload.size),
        documentationFiles: upload.files.map((item) => ({ name: item.name, size: formatFileSize(item.size) })),
      }));
      setFormErrors((previous) => ({ ...previous, documentation: "" }));
    } catch (error) {
      setFormErrors((previous) => ({ ...previous, documentation: errorMessage(error) }));
    }
  };

  const validateAsset = () => {
    const errors: Record<string, string> = {};
    if (!currentAsset.name?.trim()) errors.name = "能力名称不能为空";
    else if (currentAsset.name.length > 100) errors.name = "能力名称不能超过 100 个字符";
    if (!currentAsset.code?.trim()) errors.code = "Slug 不能为空";
    else if (!/^[a-z0-9-]{3,50}$/.test(currentAsset.code)) errors.code = "Slug 只允许小写字母、数字和中划线，3-50 个字符";
    if (!currentAsset.categoryId) errors.project = "请选择业务分类";
    if (!currentAsset.description?.trim()) errors.description = "能力描述不能为空";
    else if (currentAsset.description.length > 300) errors.description = "能力描述不能超过 300 个字符";
    const zipLocked = isEditing && (isHttpMcp(currentAsset)
      ? ["published", "offline"].includes(currentAsset.status ?? "")
      : ["deployed", "debug_passed", "debug_failed", "published", "offline"].includes(currentAsset.status ?? ""));
    const hasExistingPackage = isEditing && Boolean(currentAsset.zipName || currentAsset.zipFiles?.length);
    if (!zipLocked && !currentAsset.packageUploadToken && !hasExistingPackage) errors.zipName = "能力 ZIP 文件必填";
    return errors;
  };

  const handleSaveAssetForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const uploadedIconToken = await iconUploadPromiseRef.current;
    if (currentAsset.icon?.startsWith("data:") && !uploadedIconToken) {
      setFormErrors((previous) => ({ ...previous, icon: previous.icon || "图标上传失败，请重新选择" }));
      return;
    }
    const errors = validateAsset();
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    try {
      let iconUploadToken = uploadedIconToken ?? currentAsset.iconUploadToken;
      if (!isEditing && !iconUploadToken) {
        iconUploadToken = await uploadDefaultCapabilityIcon(
          currentAsset.type === "MCP Server" ? "MCP Server" : "Skill",
        );
      }
      const assetToSave = iconUploadToken
        ? { ...currentAsset, iconUploadToken }
        : currentAsset;
      if (isEditing) await updateCapability(assetToSave);
      else await createCapability(assetToSave);
      setShowEditModal(false);
      triggerFlashAlert({
        type: "success",
        title: t.alertSaveSuccessTitle,
        description: formatAlert(
          isHttpMcpPackageReplacement(currentAsset)
            ? t.developerAssetPackageUpdated
            : isEditing ? t.developerAssetUpdated : t.developerAssetCreated,
          { name: currentAsset.name ?? "" },
        ),
      });
      refresh();
    } catch (error) {
      const message = errorMessage(error);
      if (error instanceof ApiError && error.status === 409 && isCapabilityCodeError(message)) {
        setFormErrors((previous) => ({ ...previous, code: message }));
      }
      if (currentAsset.packageUploadToken && isUploadTokenError(message)) {
        setCurrentAsset((previous) => ({ ...previous, packageUploadToken: undefined }));
        setFormErrors((previous) => ({ ...previous, zipName: "ZIP 上传凭证已失效，请重新上传 ZIP 文件" }));
      }
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: message });
    }
  };

  const handleSubmitReview = async (asset: DeveloperAsset) => {
    try {
      await submitReviewCapability(asset.id);
      triggerFlashAlert({ type: "success", title: t.alertSubmitSuccessTitle, description: formatAlert(t.developerAssetSubmitted, { name: asset.name }) });
      refresh();
    } catch (error) {
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: errorMessage(error) });
    }
  };

  const handleDeployAsset = async (asset: DeveloperAsset) => {
    const sessionId = deploySessionRef.current + 1;
    deploySessionRef.current = sessionId;
    setDeployAsset(asset);
    setShowDeployModal(true);
    setDeployStatus("creating");
    setDeployDeploymentId(null);
    setDeployCurrentStepIndex(0);
    setDeployStepStatuses({});
    setDeployErrorMessage(null);
    setDeployTerminalLogs([{ time: formatDeployLogTime(), type: "START", text: `创建 ${asset.name} 的服务部署任务...` }]);

    try {
      await deployCapability(asset.id);
      if (deploySessionRef.current !== sessionId) return;
      setDeployStatus("running");
      setDeployTerminalLogs((previous) => previous.concat({ time: formatDeployLogTime(), type: "DEPLOY", text: "部署任务已创建，等待 Worker 消费..." }));
      refresh();

      const deployments = await listMcpDeployments();
      if (deploySessionRef.current !== sessionId) return;
      const deployment = deployments.find((item) => String(item.capability_id) === String(asset.id));
      if (deployment) {
        setDeployDeploymentId(deployment.id);
      } else {
        setDeployTerminalLogs((previous) => previous.concat({ time: formatDeployLogTime(), type: "DEPLOY", text: "等待部署记录生成..." }));
      }
    } catch (error) {
      if (deploySessionRef.current !== sessionId) return;
      const message = errorMessage(error);
      setDeployStatus("fail");
      setDeployErrorMessage(message);
      setDeployStepStatuses({ 0: "fail" });
      setDeployTerminalLogs((previous) => previous.concat({ time: formatDeployLogTime(), type: "ERROR", text: message }));
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: message });
    }
  };
  const handleDebugComplete = (asset: DeveloperAsset) => {
    handleOpenDebug(asset);
  };
  const handlePublishAsset = async (asset: DeveloperAsset) => {
    try {
      await publishCapability(asset.id);
      triggerFlashAlert({ type: "success", title: t.alertPublishSuccessTitle, description: formatAlert(t.developerAssetPublished, { name: asset.name }) });
      refresh();
    } catch (error) {
      const message = error instanceof ApiError && (error.code === 40911 || error.message === "Capability is not ready to be published")
        ? t.developerPublishNotReady
        : errorMessage(error);
      triggerFlashAlert({ type: error instanceof ApiError && error.status === 409 ? "warning" : "error", title: error instanceof ApiError && error.status === 409 ? t.alertActionRequiredTitle : t.alertOperationFailedTitle, description: message });
    }
  };

  const handleOfflineAsset = async (asset: DeveloperAsset) => {
    try {
      await offlineCapability(asset.id);
      triggerFlashAlert({ type: "success", title: t.alertOperationSuccessTitle, description: formatAlert(t.developerAssetOffline, { name: asset.name }) });
      refresh();
    } catch (error) {
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: errorMessage(error) });
    }
  };

  const handleIncrementVersion = (asset: DeveloperAsset) => {
    const parts = asset.version.replace(/^v/, "").split(".");
    if (parts.length === 3) parts[1] = String(Number(parts[1]) + 1);
    setNewVersionAsset(asset);
    setNewVersionNum(parts.length === 3 ? parts.join(".") : "1.1.0");
    setNewVersionDesc("");
    setNewVersionZipName("");
    setNewVersionZipSize("");
    setNewVersionZipFiles([]);
    setNewVersionPackageToken(undefined);
    setNewVersionErrors({});
    setShowNewVersionModal(true);
  };

  const handleNewVersionZipUploaded = async (file: File) => {
    if (!newVersionAsset) return;
    try {
      const type = newVersionAsset.type === "MCP Server" ? "mcp" : "skill";
      const upload = await uploadCapabilityFile(file, type);
      setNewVersionPackageToken(upload.uploadToken);
      setNewVersionZipName(upload.fileName);
      setNewVersionZipSize(formatFileSize(upload.size));
      setNewVersionZipFiles(upload.files.map((item) => ({ name: item.name, size: formatFileSize(item.size) })));
      setNewVersionErrors((previous) => ({ ...previous, zipName: "" }));
    } catch (error) {
      setNewVersionErrors((previous) => ({ ...previous, zipName: errorMessage(error) }));
    }
  };

  const handleSaveNewVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newVersionAsset) return;
    const errors: Record<string, string> = {};
    if (!/^\d+\.\d+\.\d+$/.test(newVersionNum.trim())) errors.version = t.developerVersionFormat;
    if (!newVersionDesc.trim()) errors.description = t.developerDescriptionRequired;
    if ((newVersionAsset.type === "Skill" || newVersionAsset.type === "MCP Server") && !newVersionPackageToken) errors.zipName = t.developerSkillZipRequired;
    if (Object.keys(errors).length) {
      setNewVersionErrors(errors);
      return;
    }
    try {
      await createCapabilityVersion(newVersionAsset.id, newVersionNum, newVersionDesc, newVersionPackageToken);
      setShowNewVersionModal(false);
      triggerFlashAlert({ type: "success", title: t.alertSaveSuccessTitle, description: formatAlert(t.developerVersionCreated, { name: newVersionAsset.name, version: newVersionNum }) });
      refresh();
    } catch (error) {
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: errorMessage(error) });
    }
  };

  const handleDeleteAsset = async (asset: DeveloperAsset) => {
    try {
      await deleteCapability(asset.id);
      setDeleteTarget(null);
      triggerFlashAlert({ type: "success", title: t.alertDeleteSuccessTitle, description: formatAlert(t.developerAssetDeleted, { name: asset.name }) });
      refresh();
    } catch (error) {
      triggerFlashAlert({ type: "error", title: t.alertOperationFailedTitle, description: errorMessage(error) });
    }
  };

  const handleCopyAssetCode = (asset: DeveloperAsset) => {
    const text = asset.type === "Skill" ? `${asset.name} (Slug: ${asset.code}):\n${asset.description || ""}` : asset.code;
    navigator.clipboard.writeText(text);
    triggerFlashAlert({ type: "success", title: t.alertCopySuccessTitle, description: t.developerPromptCopied });
  };

  const handleOpenDebug = (asset: DeveloperAsset) => {
    setDebugAsset({ ...asset });
    setDebugStatus("idle");
    setCurrentStepIndex(-1);
    setTerminalLogs([]);
    setTestStarted(false);
    setShowDebugModal(true);
  };

  const formatTerminalTime = () => {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
  };

  const runRealTest = async (asset?: DeveloperAsset) => {
    const target = asset || debugAsset;
    if (!target?.id) return;

    // Abort any in-progress test
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setTerminalLogs([]);
    setCurrentStepIndex(0);
    setStepDurations({});
    setStepStatuses({});
    setDebugStatus("testing");

    const pushLog = (type: string, text: string) =>
      setTerminalLogs((prev) => [...prev, { time: formatTerminalTime(), type, text }]);

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    pushLog("START", `开始测试 MCP 服务: ${target.serverUrl || target.code}`);

    try {
      const resp = await fetch(`/api/developer/capabilities/${target.id}/test-run`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: abort.signal,
      });

      if (!resp.ok || !resp.body) {
        pushLog("ERROR", `请求失败 (${resp.status})`);
        setDebugStatus("fail");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "step_start") {
              setCurrentStepIndex(event.step);
            } else if (event.type === "log") {
              pushLog(event.tag, event.text);
            } else if (event.type === "step_done") {
              const dur = event.duration_ms > 0
                ? event.duration_ms < 1000
                  ? `${event.duration_ms}ms`
                  : `${(event.duration_ms / 1000).toFixed(2)}s`
                : "";
              if (dur) setStepDurations((prev) => ({ ...prev, [event.step]: dur }));
              setStepStatuses((prev) => ({ ...prev, [event.step]: "pass" }));
              setCurrentStepIndex(event.step + 1);
            } else if (event.type === "error") {
              setStepStatuses((prev) => ({ ...prev, [event.step]: "fail" }));
            } else if (event.type === "done") {
              const status = event.status as "pass" | "fail";
              setDebugStatus(status);
              triggerFlashAlert({
                type: status === "pass" ? "success" : "error",
                title: status === "pass" ? t.alertTestSuccessTitle : t.alertTestFailedTitle,
                description: status === "pass" ? t.developerMcpTestPassed : t.developerMcpTestFailed,
              });
              // Refresh capability to pick up updated test status
              setRefreshVersion((v) => v + 1);
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      pushLog("ERROR", `测试中断: ${err instanceof Error ? err.message : String(err)}`);
      setDebugStatus("fail");
    }
  };

  const tabCounts = useMemo(() => ({
    all: counts.all ?? 0,
    skill: counts.skill ?? 0,
    mcp: counts.mcp ?? 0,
  }), [counts]);

  return {
    assets, tabCounts, totalItems, totalPages, safeCurrentPage,
    searchQuery, setSearchQuery, activeTypeTab, setActiveTypeTab, statusFilter, setStatusFilter,
    pageSize, setPageSize, currentPage, setCurrentPage, resetToFirstPage, handleResetFilters,
    showEditModal, setShowEditModal, isEditing, currentAsset, setCurrentAsset,
    tagsInputText, setTagsInputText, formErrors, setFormErrors,
    handleOpenAddAsset, handleOpenEditAsset, handleIconFileUploaded, handleZipFileUploaded, handleDocumentationUploaded, handleSaveAssetForm,
    showNewVersionModal, setShowNewVersionModal, newVersionAsset, newVersionNum, setNewVersionNum,
    newVersionDesc, setNewVersionDesc, newVersionZipName, setNewVersionZipName,
    newVersionZipSize, setNewVersionZipSize, newVersionZipFiles, setNewVersionZipFiles, setNewVersionPackageToken,
    newVersionErrors, handleIncrementVersion, handleNewVersionZipUploaded, handleSaveNewVersion,
    handleSubmitReview, handleDeployAsset, handleDebugComplete,
    handlePublishAsset, handleOfflineAsset, handleDeleteAsset, deleteTarget, setDeleteTarget,
    handleCopyAssetCode, handleOpenDebug, showDebugModal, setShowDebugModal, debugAsset,
    debugStatus, currentStepIndex, terminalLogs, setTerminalLogs, stepDurations, stepStatuses,
    testStarted, setTestStarted, runRealTest,
    showDeployModal, setShowDeployModal, deployAsset, deployStatus, deployCurrentStepIndex,
    deployTerminalLogs, setDeployTerminalLogs, deployStepStatuses, deployErrorMessage,
    flashMessage, triggerFlashAlert,
  };
}
