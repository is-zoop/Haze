export type AuditRequestType =
  | "capability_publish"
  | "version_publish"
  | "permission_request"
  | "high_risk_tool"
  | "capability_offline";

export type AuditStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

export type CapabilityType = "Skill" | "MCP Server" | "MCP Tool";

export interface AuditRequest {
  id: string; // 申请单号
  title: string; // 审核事项 label
  type: AuditRequestType;
  capabilityName: string;
  capabilityType: CapabilityType;
  version?: string;
  targetVersion?: string;
  applicant: string;
  applicantEmail: string;
  department: string;
  submitTime: string;
  urgency: "normal" | "urgent" | "critical"; // 普通、紧急、即将超时
  status: AuditStatus;
  timeLeft: string; // 剩余处理时间 / 剩余 18 小时, 已超时 3 小时 etc.
  description: string; // 简短申请说明
  hasBlocker: boolean;
  blockReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface AuditHistoryItem {
  id: string;
  title: string;
  type: AuditRequestType;
  capabilityName: string;
  capabilityType: CapabilityType;
  applicant: string;
  department: string;
  status: "approved" | "rejected" | "withdrawn" | "expired";
  decisionComment: string; // 审核意见摘要
  processedTime: string; // 处理时间
  processor: string; // 处理人
}

// Detailed types for AuditDetailSheet
export interface AuditDetail {
  requestId: string;
  applicantEmail: string;
  expectedTime: string;
  reason: string;
  scenario: string;
  attachments: { name: string; size: string; url?: string }[];
  notes?: string;

  // Permission Request details
  permissionScope?: string[];
  dataScope?: string;
  usageDuration?: string;
  projectId?: string;
  allowAutoCall?: boolean;

  // High Risk Tool details
  toolName?: string;
  paramsSummary?: string;
  executeTarget?: string;
  dataImpactScope?: string;
  riskDescription?: string;
  userConfirmed?: boolean;

  // Capability details
  capabilityUrl?: string;
  transportType?: string;
  toolsCount?: number;
  healthState?: string;
  avgLatency?: string;
  skillMdSummary?: string;
  dependencies?: string[];
  testCasesCount?: number;
  runsCount?: number;
  currentPermissions?: string;

  // Version Diff
  diffCount?: { added: number; deleted: number; modified: number };
  changes?: {
    item: string;
    before: string;
    after: string;
    status: "added" | "deleted" | "modified";
  }[];

  // Testing & Security Scan
  testStatus?: "passed" | "failed" | "warning";
  testVersion?: string;
  testEnv?: string;
  testPassRate?: string;
  duration?: string;
  failedTests?: string[];
  dependencyHealthy?: boolean;
  toolRiskLevel?: "low" | "medium" | "high";
  securityScanResult?: "passed" | "failed" | "warning";
  hasSensitiveInfo?: boolean;
  requireManualConfirm?: boolean;
}

export interface AuditTimelineEvent {
  id: string;
  requestId: string;
  operator: string;
  operatorRole?: string;
  time: string;
  type: "submit" | "autocheck" | "assign" | "request_info" | "reply_info" | "approve" | "reject" | "transfer";
  comment?: string;
  attachments?: { name: string; size: string }[];
}
