import httpMcpPrompt from "./http-mcp.md?raw";
import skillPrompt from "./skill.md?raw";
import stdioMcpPrompt from "./stdio-mcp.md?raw";

export const DOWNLOAD_URL_PLACEHOLDER = "TODO_短期下载链接暂未启用";
export const SERVER_URL_PLACEHOLDER = "TODO_MCP Server地址未配置";

interface AccessPromptValues {
  abilityName: string;
  version: string;
  downloadUrl?: string;
  serverUrl?: string;
  personalCredential?: string;
}

export function renderSkillAccessPrompt(values: AccessPromptValues): string {
  return render(skillPrompt, values);
}

export function renderStdioMcpAccessPrompt(values: AccessPromptValues): string {
  return render(stdioMcpPrompt, values);
}

export function renderHttpMcpAccessPrompt(values: AccessPromptValues): string {
  return render(httpMcpPrompt, values);
}

function render(template: string, values: AccessPromptValues): string {
  return template
    .replaceAll("{{ABILITY_NAME}}", values.abilityName)
    .replaceAll("{{VERSION}}", values.version)
    .replaceAll("{{DOWNLOAD_URL}}", values.downloadUrl ?? DOWNLOAD_URL_PLACEHOLDER)
    .replaceAll("{{SERVER_URL}}", values.serverUrl ?? SERVER_URL_PLACEHOLDER)
    .replaceAll("{{PERSONAL_CREDENTIAL}}", values.personalCredential ?? "")
    .trim();
}
