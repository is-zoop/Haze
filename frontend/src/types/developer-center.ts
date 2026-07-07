export type AssetType = "Skill" | "MCP Server" | "Tool";

export type AssetStatus =
  | "draft"          // 草稿
  | "reviewing"      // 待审核
  | "approved"       // 审核通过
  | "rejected"       // 审核驳回
  | "deployed"       // 部署完成
  | "deploy_failed"  // 部署失败
  | "debug_passed"   // 调试通过
  | "debug_failed"   // 调试失败
  | "published"      // 已发布
  | "offline";       // 已下线

export type TestStatus = "none" | "testing" | "pass" | "fail";

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected: string;
}

export interface DeveloperAsset {
  id: string;
  name: string;
  code: string;
  type: AssetType;
  description: string;
  version: string;
  project: string;
  categoryId?: number;
  owner: string;
  creator?: string;
  status: AssetStatus;
  recentTestStatus: TestStatus;
  updatedAt: string;
  calls: number;
  tags: string[];
  visibility: "private" | "internal" | "public";

  // Skill-specific fields
  skillMd?: string;
  dependentTools?: string[];
  testCases?: TestCase[];
  icon?: string;
  zipName?: string;
  zipSize?: string;
  zipFiles?: { name: string; size: string }[];
  iconUploadToken?: string;
  packageUploadToken?: string;
  documentationUploadToken?: string;
  documentationSize?: string;
  documentationFiles?: { name: string; size: string }[];

  // MCP Server-specific fields
  transport?: "HTTP" | "STDIO";
  serverUrl?: string;
  startCommand?: string;
  startArgs?: string;
  healthCheckUrl?: string;
  credentialRef?: string;
  averageResponseTime?: number;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  tools?: string[];
  resources?: string[];
  prompts?: string[];

  // MCP Tool-specific fields
  mcpServerId?: string;
  mcpServerName?: string;
  inputSchema?: string;
  outputSchema?: string;
  parameterNotice?: string;
  readWrite?: "readonly" | "readwrite";
  needConfirm?: boolean;
}
