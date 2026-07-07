import { apiBlobRequest, apiRequest } from "./api";
import { DeveloperAsset } from "../types/developer-center";

export type CapabilityApiType = "skill" | "mcp";
export type CapabilityApiStatus =
  | "draft"
  | "reviewing"
  | "approved"
  | "rejected"
  | "deployed"
  | "deploy_failed"
  | "debug_passed"
  | "debug_failed"
  | "published"
  | "offline";

export interface McpDeployment {
  id: number;
  capability_id: number;
  capability_name: string | null;
  capability_code: string | null;
  capability_icon: string | null;
  creator_name: string | null;
  version_id: number | null;
  deployment_name: string;
  deploy_status: string;
  desired_status: string;
  actual_status: string;
  image_url: string | null;
  internal_service_name: string | null;
  internal_url: string | null;
  public_url: string | null;
  gateway_route: string | null;
  replicas: number;
  ready_replicas: number;
  restart_count: number;
  health_status: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  stopped_at: string | null;
}

export interface McpCallLog {
  id: number;
  capability_id: number;
  deployment_id: number | null;
  asset_code: string;
  request_id: string | null;
  user_id: number | null;
  caller_name: string | null;
  client_ip: string | null;
  method: string | null;
  tool_name: string | null;
  status_code: number | null;
  success: boolean | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface McpDeployTask {
  id: number;
  capability_id: number;
  version_id: number | null;
  version: string | null;
  task_type: string;
  task_status: string;
  runtime_provider: string;
  logs: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface McpDeploymentListData { items: McpDeployment[]; total: number; }
interface McpDeployTaskListData { items: McpDeployTask[]; total: number; }
export interface McpCallLogListData { items: McpCallLog[]; total: number; today_total: number; today_errors: number; success_rate: number | null; avg_duration_ms: number | null; }

interface ApiPackageFile {
  name: string;
  size: number;
}

interface ApiPackage {
  path?: string;
  name?: string;
  size?: number;
  files?: ApiPackageFile[];
  manifest?: Record<string, unknown> | null;
}

interface ApiCapability {
  id: number;
  code: string;
  name: string;
  type: CapabilityApiType;
  description?: string | null;
  category_id?: number | null;
  category?: string | null;
  icon?: string | null;
  version: string;
  status: CapabilityApiStatus;
  visibility: "internal";
  owner?: string | null;
  creator?: string | null;
  department?: string | null;
  tags: string[];
  config: Record<string, unknown>;
  calls: number;
  recent_test_status: "none" | "testing" | "pass" | "fail";
  package?: ApiPackage | null;
  documentation?: ApiPackage | null;
  updated_at: string;
}

interface ApiCapabilityList {
  items: ApiCapability[];
  page: number;
  page_size: number;
  total: number;
  counts: Record<string, number>;
}

export interface CapabilityListResult {
  items: DeveloperAsset[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<string, number>;
}

export interface UploadResult {
  uploadToken: string;
  fileName: string;
  size: number;
  files: { name: string; size: number }[];
  manifest?: Record<string, unknown> | null;
}

function formatVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function mapCapability(item: ApiCapability): DeveloperAsset {
  const config = item.config ?? {};
  const packageInfo = item.package ?? undefined;
  return {
    id: String(item.id),
    name: item.name,
    code: item.code,
    type: item.type === "skill" ? "Skill" : "MCP Server",
    description: item.description ?? "",
    version: formatVersion(item.version),
    project: item.category ?? "",
    categoryId: item.category_id ?? undefined,
    owner: item.owner ?? "",
    creator: item.creator ?? "",
    status: item.status,
    recentTestStatus: item.recent_test_status,
    updatedAt: item.updated_at,
    calls: item.calls,
    tags: item.tags ?? [],
    visibility: item.visibility,
    icon: item.icon ?? undefined,
    zipName: packageInfo?.name,
    zipSize: packageInfo?.size !== undefined ? formatFileSize(packageInfo.size) : undefined,
    zipFiles: packageInfo?.files?.map((file) => ({ name: file.name, size: formatFileSize(file.size) })),
    documentationSize: item.documentation?.size !== undefined ? formatFileSize(item.documentation.size) : undefined,
    documentationFiles: item.documentation?.files?.map((file) => ({ name: file.name, size: formatFileSize(file.size) })),
    skillMd: typeof config.skillMd === "string" ? config.skillMd : undefined,
    dependentTools: Array.isArray(config.dependentTools) ? config.dependentTools as string[] : undefined,
    testCases: Array.isArray(config.testCases) ? config.testCases as DeveloperAsset["testCases"] : undefined,
    transport: String(config.transport ?? "").toUpperCase() === "STDIO" ? "STDIO" : "HTTP",
    serverUrl: typeof config.serverUrl === "string" ? config.serverUrl : undefined,
    startCommand: typeof config.startCommand === "string" ? config.startCommand : undefined,
    startArgs: typeof config.startArgs === "string" ? config.startArgs : undefined,
    healthCheckUrl: typeof config.healthCheckUrl === "string" ? config.healthCheckUrl : undefined,
    credentialRef: typeof config.credentialRef === "string" ? config.credentialRef : undefined,
    averageResponseTime: typeof config.averageResponseTime === "number" ? config.averageResponseTime : undefined,
    capabilities: typeof config.capabilities === "object" ? config.capabilities as DeveloperAsset["capabilities"] : undefined,
    tools: Array.isArray(config.tools) ? config.tools as string[] : undefined,
    resources: Array.isArray(config.resources) ? config.resources as string[] : undefined,
    prompts: Array.isArray(config.prompts) ? config.prompts as string[] : undefined,
  };
}

export function buildCapabilityConfig(asset: Partial<DeveloperAsset>): Record<string, unknown> {
  if (asset.type === "MCP Server") {
    return {
      transport: asset.transport ?? "HTTP",
      serverUrl: asset.serverUrl ?? "",
      startCommand: asset.startCommand ?? "",
      startArgs: asset.startArgs ?? "",
      healthCheckUrl: asset.healthCheckUrl ?? "",
      credentialRef: asset.credentialRef ?? "",
      averageResponseTime: asset.averageResponseTime,
      capabilities: asset.capabilities ?? {},
      tools: asset.tools ?? [],
      resources: asset.resources ?? [],
      prompts: asset.prompts ?? [],
    };
  }
  return {
    skillMd: asset.skillMd ?? "",
    dependentTools: asset.dependentTools ?? [],
    testCases: asset.testCases ?? [],
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function listCapabilities(params: {
  page: number;
  pageSize: number;
  search?: string;
  type?: CapabilityApiType;
  status?: CapabilityApiStatus;
}): Promise<CapabilityListResult> {
  const query = new URLSearchParams({ page: String(params.page), page_size: String(params.pageSize) });
  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  const data = (await apiRequest<ApiCapabilityList>(`/api/developer/capabilities?${query}`)).data;
  return {
    items: data.items.map(mapCapability),
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
    counts: data.counts,
  };
}

export async function uploadCapabilityFile(file: File, type: CapabilityApiType): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const data = (await apiRequest<{
    upload_token: string;
    file_name: string;
    size: number;
    files: ApiPackageFile[];
    manifest?: Record<string, unknown> | null;
  }>(`/api/developer/uploads/package?type=${type}`, { method: "POST", body: form })).data;
  return {
    uploadToken: data.upload_token,
    fileName: data.file_name,
    size: data.size,
    files: data.files ?? [],
    manifest: data.manifest,
  };
}

export async function uploadCapabilityDocumentation(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const data = (await apiRequest<{ upload_token: string; file_name: string; size: number; files: ApiPackageFile[] }>(
    "/api/developer/uploads/documentation",
    { method: "POST", body: form },
  )).data;
  return {
    uploadToken: data.upload_token,
    fileName: data.file_name,
    size: data.size,
    files: data.files ?? [],
  };
}

export async function uploadCapabilityIcon(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const data = (await apiRequest<{ upload_token: string; file_name: string; size: number }>(
    "/api/developer/uploads/icon",
    { method: "POST", body: form },
  )).data;
  return { uploadToken: data.upload_token, fileName: data.file_name, size: data.size, files: [] };
}

function payloadFromAsset(asset: Partial<DeveloperAsset>) {
  return {
    code: asset.code,
    name: asset.name,
    description: asset.description || null,
    category_id: asset.categoryId || null,
    visibility: "internal" as const,
    tags: asset.tags ?? [],
    config: buildCapabilityConfig(asset),
  };
}

export async function createCapability(asset: Partial<DeveloperAsset>): Promise<DeveloperAsset> {
  const data = (await apiRequest<ApiCapability>("/api/developer/capabilities", {
    method: "POST",
    body: {
      ...payloadFromAsset(asset),
      type: asset.type === "MCP Server" ? "mcp" : "skill",
      version: asset.version?.replace(/^v/, "") || "1.0.0",
      icon_upload_token: asset.iconUploadToken || null,
      package_upload_token: asset.packageUploadToken,
      documentation_upload_token: asset.documentationUploadToken || null,
    },
  })).data;
  return mapCapability(data);
}

export async function updateCapability(asset: Partial<DeveloperAsset>): Promise<DeveloperAsset> {
  const data = (await apiRequest<ApiCapability>(`/api/developer/capabilities/${asset.id}`, {
    method: "PATCH",
    body: {
      ...payloadFromAsset(asset),
      icon_upload_token: asset.iconUploadToken || null,
      package_upload_token: asset.packageUploadToken || null,
      documentation_upload_token: asset.documentationUploadToken || null,
    },
  })).data;
  return mapCapability(data);
}

export async function createCapabilityVersion(
  id: string,
  version: string,
  changelog: string,
  packageUploadToken?: string,
): Promise<DeveloperAsset> {
  const data = (await apiRequest<ApiCapability>(`/api/developer/capabilities/${id}/versions`, {
    method: "POST",
    body: {
      version: version.replace(/^v/, ""),
      changelog,
      package_upload_token: packageUploadToken || null,
    },
  })).data;
  return mapCapability(data);
}

export async function submitReviewCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}/submit-review`, { method: "POST" });
}

export async function deployCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}/deploy`, { method: "POST" });
}

export async function listMcpDeployments(): Promise<McpDeployment[]> {
  const data = (await apiRequest<McpDeploymentListData>("/api/mcp-runtime/deployments?page=1&page_size=100")).data;
  return Promise.all(data.items.map(async (item) => {
    if (!item.capability_icon) return item;
    try {
      return { ...item, capability_icon: await loadCapabilityIcon(item.capability_icon) };
    } catch {
      return { ...item, capability_icon: null };
    }
  }));
}

export async function listMcpDeployTasks(deploymentId: number): Promise<McpDeployTask[]> {
  const data = (await apiRequest<McpDeployTaskListData>(`/api/mcp-runtime/deployments/${deploymentId}/tasks?page=1&page_size=20`)).data;
  return data.items;
}

export async function getMcpDeploymentLogs(deploymentId: number): Promise<string> {
  const accessToken = localStorage.getItem("haze_access_token");
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`/api/mcp-runtime/deployments/${deploymentId}/logs`, { headers });
  if (!response.ok) throw new Error(response.statusText || "Failed to load deployment logs");
  return response.text();
}

export async function debugCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}/debug`, { method: "POST" });
}

export async function publishCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}/publish`, { method: "POST" });
}

export async function offlineCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}/offline`, { method: "POST" });
}

export async function deleteCapability(id: string): Promise<void> {
  await apiRequest(`/api/developer/capabilities/${id}`, { method: "DELETE" });
}

export async function loadCapabilityIcon(path: string): Promise<string> {
  const separator = path.includes("?") ? "&" : "?";
  const blob = await apiBlobRequest(`${path}${separator}v=${Date.now()}`);
  return URL.createObjectURL(blob);
}

export interface MarketCapabilityVersion {
  version: string;
  updated_at?: string;
  created_at?: string;
  changelog?: string | string[] | null;
  content?: string | string[] | null;
}

export interface MarketCapabilityItem {
  id: string;
  name: string;
  type: string;
  description: string | null;
  version: string;
  author: string;
  department: string | null;
  category_id: number | null;
  category: string | null;
  connect_type?: string | null;
  server_url?: string | null;
  version_history?: MarketCapabilityVersion[];
  versions?: MarketCapabilityVersion[];
  tags: string[];
  calls: number;
  is_favorite: boolean;
  icon: string | null;
  updated_at: string;
}

export async function listMarketCapabilities(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: "skill" | "mcp";
  categoryId?: number;
  favoriteOnly?: boolean;
}): Promise<{ items: MarketCapabilityItem[]; total: number }> {
  const query = new URLSearchParams({ page: String(params.page ?? 1), page_size: String(params.pageSize ?? 100) });
  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  if (params.categoryId) query.set("category_id", String(params.categoryId));
  if (params.favoriteOnly) query.set("favorite_only", "true");
  const data = (await apiRequest<{ items: MarketCapabilityItem[]; page: number; page_size: number; total: number }>(`/api/marketplace/capabilities?${query}`)).data;
  const items = await Promise.all(data.items.map(async (item) => {
    if (!item.icon) return item;
    try {
      return { ...item, icon: await loadCapabilityIcon(item.icon) };
    } catch {
      return { ...item, icon: null };
    }
  }));
  return { items, total: data.total };
}

export async function createMarketCapabilityDownloadLink(id: string): Promise<{ downloadUrl: string; expiresAt: string }> {
  const data = (await apiRequest<{ download_url: string; expires_at: string }>(
    `/api/marketplace/capabilities/${id}/download-link`,
    { method: "POST" },
  )).data;
  return { downloadUrl: data.download_url, expiresAt: data.expires_at };
}

export interface MarketAccessPrompt {
  capability_id: string;
  name: string;
  type: string;
  version: string;
  access_mode: string;
  prompt: string;
  download_url: string | null;
  server_url: string | null;
  expires_at: string | null;
}

export async function getMarketCapabilityAccessPrompt(id: string): Promise<MarketAccessPrompt> {
  const data = (await apiRequest<MarketAccessPrompt>(
    `/api/marketplace/capabilities/${id}/access-prompt`,
  )).data;
  return data;
}

export async function getMarketCapabilityContent(
  id: string,
  fileName: "quick_start.md" | "README.md",
): Promise<{ content: string | null; basePath: string }> {
  const query = new URLSearchParams({ file: fileName });
  const data = (await apiRequest<{ file_name: string; base_path: string; content: string | null }>(
    `/api/marketplace/capabilities/${id}/content?${query}`,
  )).data;
  return { content: data.content, basePath: data.base_path };
}

export function getMarketCapabilityDocumentAsset(id: string, assetPath: string): Promise<Blob> {
  const encodedPath = assetPath.split("/").map(encodeURIComponent).join("/");
  return apiBlobRequest(`/api/marketplace/capabilities/${id}/documentation/${encodedPath}`);
}

export async function toggleMarketFavorite(id: string): Promise<boolean> {
  const data = (await apiRequest<{ is_favorite: boolean }>(`/api/marketplace/capabilities/${id}/favorite`, { method: "POST" })).data;
  return data.is_favorite;
}

export async function listMcpCallLogs(deploymentId: number): Promise<McpCallLogListData> {
  return (await apiRequest<McpCallLogListData>(`/api/mcp-runtime/deployments/${deploymentId}/calls?page=1&page_size=20`)).data;
}

export async function startMcpDeployment(deploymentId: number): Promise<void> {
  await apiRequest(`/api/mcp-runtime/deployments/${deploymentId}/start`, { method: "POST" });
}

export async function stopMcpDeployment(deploymentId: number): Promise<void> {
  await apiRequest(`/api/mcp-runtime/deployments/${deploymentId}/stop`, { method: "POST" });
}

export async function restartMcpDeployment(deploymentId: number): Promise<void> {
  await apiRequest(`/api/mcp-runtime/deployments/${deploymentId}/restart`, { method: "POST" });
}
