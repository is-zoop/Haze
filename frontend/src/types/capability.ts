export type CapabilityType = "Skill" | "MCP" | "Tool";

export type PermissionStatus = 
  | "direct"       // 可直接使用
  | "need_apply"   // 需要申请
  | "granted"      // 已获得权限
  | "pending"      // 待审批
  | "expired";     // 权限已过期

export type RunningStatus = "active" | "warning" | "maintenance" | "inactive";

export type RiskLevel = "low" | "medium" | "high";

export interface DependencyItem {
  type: string;
  name: string;
}

export interface MCPToolListItem {
  name: string;
  description: string;
  isReadonly: boolean;
  riskLevel: RiskLevel;
  permissionsStatus: PermissionStatus;
  status: RunningStatus;
}

export interface ToolParamItem {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface CapabilityVersionRecord {
  version: string;
  updatedAt: string;
  content?: string | string[] | null;
}

export interface CapabilityItem {
  id: string;
  name: string;
  type: CapabilityType;
  description: string;
  calls: number;
  status: RunningStatus;
  author: string;
  version: string;
  updateTime: string;
  permissionsStatus: PermissionStatus;
  riskLevel: RiskLevel;
  department: string;
  tags?: string[];
  categoryId?: number;
  category?: string;
  versionHistory?: CapabilityVersionRecord[];
  isFavorite?: boolean;
  icon?: string | null;
  lastUsedTime?: string;

  // Type specific fields - Skill
  scenarios?: string[];         // 适用场景
  whatItCanDo?: string[];       // 能做什么
  whatItCantDo?: string[];      // 不能做什么
  inputExample?: string;        // 输入示例
  outputExample?: string;       // 输出示例
  dependencies?: DependencyItem[]; // 依赖关系
  steps?: string[];             // 使用步骤
  examples?: string[];          // 示例问题
  notes?: string[];             // 注意事项

  // Type specific fields - MCP Server
  systemName?: string;          // 所属业务系统
  toolsCount?: number;          // 可用 Tool 数量
  resourcesCount?: number;      // Resources 数量
  promptsCount?: number;        // Prompts 数量
  connectType?: string;
  serverUrl?: string;         // 连接方式
  avgResponseTime?: string;     // 平均响应时间
  toolsList?: MCPToolListItem[]; // Tools 列表
  resourcesList?: string[];     // Resources 列表
  promptsList?: string[];       // Prompts 列表
  accessInstruction?: string;   // 接入说明

  // Type specific fields - MCP Tool
  mcpServerName?: string;       // 所属 MCP Server
  isReadonly?: boolean;         // 只读或写入
  needConfirmation?: boolean;   // 是否需要执行确认
  paramsCount?: number;         // 参数数量
  paramsList?: ToolParamItem[]; // 参数说明
  inputSchema?: string;         // 输入 Schema JSON 字符表示
}
