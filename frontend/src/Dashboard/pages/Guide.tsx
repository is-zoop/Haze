import { useMemo, useState, useEffect } from "react";
import {
  BookOpen,
  Terminal,
  Workflow,
  FileText,
  FolderGit,
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  Download,
  ArrowUpRight,
  HelpCircle,
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
  Database,
  Clock3,
  Search,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { BasicAlert, FloatingAlert, WarningAlert, type FlashMessage } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n";

// Eagerly import Markdown content using Vite's raw loading
import quickStartRaw from "../../content/developer-guide/quick-start.md?raw";
import capabilityCreationProcessRaw from "../../content/developer-guide/capability-creation-process.md?raw";
import skillMdGuideRaw from "../../content/developer-guide/skill-md-guide.md?raw";
import mcpMdGuideRaw from "../../content/developer-guide/mcp-md-guide.md?raw";
import testingPublishRaw from "../../content/developer-guide/testing-publish.md?raw";
import runtimeMonitorRaw from "../../content/developer-guide/runtime-monitor.md?raw";

const DOCS_MAP: Record<string, string> = {
  "quick-start": quickStartRaw,
  "capability-creation-process": capabilityCreationProcessRaw,
  "skill-md-guide": skillMdGuideRaw,
  "mcp-md-guide": mcpMdGuideRaw,
  "testing-publish": testingPublishRaw,
  "runtime-monitor": runtimeMonitorRaw,
};

const GUIDE_SECTIONS = [
  { id: "quick-start", title: "快速开始", icon: Terminal },
  { id: "capability-creation-process", title: "能力创建流程", icon: Workflow },
  { id: "skill-md-guide", title: "Skill 接入规范", icon: FileText },
  { id: "mcp-md-guide", title: "MCP 接入规范", icon: FolderGit },
  { id: "testing-publish", title: "调试与发布", icon: PlayCircle },
  { id: "runtime-monitor", title: "运行监控", icon: Clock3 },
] as const;

type SectionId = typeof GUIDE_SECTIONS[number]["id"];

interface GuideProps {
  onBackToHome?: () => void;
  langCode?: "ZH" | "EN" | "JA" | "ES";
  setActiveMenu?: (menuKey: "workbench" | "market" | "developer" | "guide" | "audit" | "settings") => void;
}

interface HeaderItem {
  id: string;
  title: string;
  level: number;
}

// ----------------------------------------------------------------------
// Lightweight and robust front-matter & YAML parser
// ----------------------------------------------------------------------
function parseValue(val: string): any {
  val = val.trim();
  if (!val) return "";
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val)) && val !== "") return Number(val);
  if (val.startsWith("[") && val.endsWith("]")) {
    return val.slice(1, -1).split(",").map(v => parseValue(v));
  }
  return val;
}

function parseYaml(yamlStr: string): Record<string, any> {
  const lines = yamlStr.split(/\r?\n/);
  const result: Record<string, any> = {};
  let currentKey = "";
  let currentArray: any[] = [];
  let currentObject: Record<string, any> | null = null;

  for (let line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    if (trimmed.startsWith("- ")) {
      const itemContent = trimmed.slice(2).trim();
      if (itemContent.includes(":")) {
        const colonIdx = itemContent.indexOf(":");
        const k = itemContent.slice(0, colonIdx).trim();
        const v = itemContent.slice(colonIdx + 1).trim();
        if (currentObject) {
          currentArray.push(currentObject);
        }
        currentObject = { [k]: parseValue(v) };
      } else {
        currentArray.push(parseValue(itemContent));
      }
    } else if (trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const k = trimmed.slice(0, colonIdx).trim();
      const v = trimmed.slice(colonIdx + 1).trim();

      if (indent === 0) {
        if (currentObject) {
          currentArray.push(currentObject);
          currentObject = null;
        }
        if (currentArray.length > 0 && currentKey) {
          result[currentKey] = currentArray;
          currentArray = [];
        } else if (currentKey && !result[currentKey]) {
          result[currentKey] = null;
        }

        currentKey = k;
        if (v) {
          result[currentKey] = parseValue(v);
        } else {
          currentArray = [];
        }
      } else {
        if (currentObject) {
          currentObject[k] = parseValue(v);
        } else if (currentKey) {
          if (!result[currentKey] || typeof result[currentKey] !== "object") {
            result[currentKey] = {};
          }
          result[currentKey][k] = parseValue(v);
        }
      }
    }
  }

  if (currentObject) {
    currentArray.push(currentObject);
  }
  if (currentArray.length > 0 && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

function parseFrontMatter(rawMarkdown: string) {
  const match = rawMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {} as Record<string, any>, content: rawMarkdown };
  }
  const yamlStr = match[1];
  const content = match[2];
  const data = parseYaml(yamlStr);
  return { data, content };
}

// Helper to pull clean text representation out of nested children tree
function getTextFromChildren(children: any): string {
  if (!children) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (typeof children === "object" && children.props) {
    return getTextFromChildren(children.props.children);
  }
  return "";
}

function getIconByName(name: string) {
  const icons: Record<string, any> = {
    FileText,
    ShieldCheck,
    Sparkles,
    Database,
    Terminal,
  };
  return icons[name] || FileText;
}

// ----------------------------------------------------------------------
// i18n Helpers for Guide Section Titles, Checklist descriptions, and metadata
// ----------------------------------------------------------------------
function getSectionTitle(id: string, langCode: string): string {
  switch (id) {
    case "quick-start":
      return langCode === "ZH" ? "快速开始" : langCode === "JA" ? "クイックスタート" : langCode === "ES" ? "Inicio rápido" : "Quick Start";
    case "capability-creation-process":
      return langCode === "ZH" ? "能力创建流程" : langCode === "JA" ? "機能作成フロー" : langCode === "ES" ? "Proceso de creación de capacidades" : "Capability Creation Process";
    case "skill-md-guide":
      return langCode === "ZH" ? "Skill 接入规范" : langCode === "JA" ? "Skill 接続仕様" : langCode === "ES" ? "Especificación de integración de Skill" : "Skill Integration Guide";
    case "mcp-md-guide":
      return langCode === "ZH" ? "MCP 接入规范" : langCode === "JA" ? "MCP 接続仕様" : langCode === "ES" ? "Especificación de integración MCP" : "MCP Integration Guide";
    case "testing-publish":
      return langCode === "ZH" ? "调试与发布" : langCode === "JA" ? "デバッグと公開" : langCode === "ES" ? "Depuración y publicación" : "Debugging & Publishing";
    case "runtime-monitor":
      return langCode === "ZH" ? "运行监控" : langCode === "JA" ? "実行監視" : langCode === "ES" ? "Monitoreo de ejecución" : "Runtime Monitoring";
    default:
      return "";
  }
}

function translateChecklistItem(id: number, title: string, desc: string, sectionId: string, langCode: string) {
  if (langCode === "ZH") return { title, desc };
  
  const translations: Record<string, Record<number, { title: Record<string, string>, desc: Record<string, string> }>> = {
    "quick-start": {
      1: {
        title: { JA: "機能分類を理解", ES: "Entender categorías", EN: "Learn Categories" },
        desc: { JA: "SkillとMCP Serverの機能特性を把握する。", ES: "Familiarizarse con Skills y Servidores MCP.", EN: "Understand core features of Skills and MCP Servers." }
      },
      2: {
        title: { JA: "ローカル環境初期化", ES: "Inicializar proyecto", EN: "Init Local Project" },
        desc: { JA: "プリセットファイル構造を含む標準テンプレートパッケージをダウンロードします。", ES: "Descargar la plantilla y el conjunto de pruebas estándares.", EN: "Download standard templates and project boilerplate files." }
      },
      3: {
        title: { JA: "サンドボックス連携設定", ES: "Configurar Sandbox", EN: "Config Sandbox" },
        desc: { JA: "SSEプロトコル等でデバッグクライアントと通信を開始します。", ES: "Iniciar sandbox de pruebas y conectar mediante SSE.", EN: "Launch your local sandbox and connect via SSE protocol." }
      },
      4: {
        title: { JA: "承認・配信の申請", ES: "Enviar para aprobación", EN: "Submit & Publish" },
        desc: { JA: "セキュリティと機能の監査を経て、最終的に能力市場へリリースします。", ES: "Aprobación de seguridad para publicar en el mercado oficial.", EN: "Pass reviews and release to the capability marketplace." }
      }
    },
    "skill-upload": {
      1: {
        title: { JA: "パッケージ構造", ES: "Estructura del paquete", EN: "Package Structure" },
        desc: { JA: "ファイルレイアウトとフォルダー構成の標準ルールに従います。", ES: "Seguir las reglas de carpetas y diseño de archivos.", EN: "Follow directory structure rules and package layout guidelines." }
      },
      2: {
        title: { JA: "metadata.json 設定", ES: "Declaración metadata", EN: "metadata.json Spec" },
        desc: { JA: "名称、説明及び権限の宣言を正確に入力します。", ES: "Ingresar descripción, permisos y campos requeridos.", EN: "Accurately fill in details, description, and permissions structure." }
      },
      3: {
        title: { JA: "厳格なバージョン管理", ES: "Control de versiones", EN: "Version Control" },
        desc: { JA: "SemVer 規格に則り、互換性に配慮したバージョン管理を行います。", ES: "Utilizar revisiones estables y seguir especificaciones de SemVer.", EN: "Implement strict semantic versioning to preserve core compatibility." }
      },
      4: {
        title: { JA: "環境依存関係チェック", ES: "Verificar dependencias", EN: "Verify Dependencies" },
        desc: { JA: "外部パッケージ依存や Node モジュール構成を十分にテスト、固定します。", ES: "Probar y comprobar dependencias de Node.js externamente.", EN: "Thoroughly inspect and package external libraries or node dependencies." }
      }
    },
    "skill-md-guide": {
      1: {
        title: { JA: "必須情報の記載", ES: "Información crítica", EN: "Critical Info" },
        desc: { JA: "対応モデル、説明、パラメータなどを詳しくガイド形式で記述します。", ES: "Detallar soporte, descripciones, llamadas y ejemplos prácticos.", EN: "Ensure thorough parameters guide and API descriptions are included." }
      },
      2: {
        title: { JA: "構造化レイアウト", ES: "Diseño estructurado", EN: "Structured Layout" },
        desc: { JA: "マークダウン記法に準拠し、適切なヘッダー見出しを付与します。", ES: "Utilizar títulos organizados y cumplir con formato Markdown.", EN: "Format correctly with headers for automated platform ingestion." }
      },
      3: {
        title: { JA: "豊かな実用例", ES: "Ejemplos prácticos", EN: "Practical Examples" },
        desc: { JA: "実世界のコンテキストに役立つ対話シナリオや用例を追加します。", ES: "Añadir diálogos y flujos típicos para guiar al modelo AI.", EN: "Add clear dialogs and usage guidelines for robust model execution." }
      },
      4: {
        title: { JA: "チェンジログ更新", ES: "Historial de cambios", EN: "Update Changelog" },
        desc: { JA: "変更履歴ドキュメントを更新し、履歴を一元的に管理します。", ES: "Registrar modificaciones e incidentes resueltos en el historial.", EN: "Log change history to keep the release log up-to-date." }
      }
    },
    "mcp-register": {
      1: {
        title: { JA: "認証情報の取得", ES: "Obtener credenciales", EN: "Get Credentials" },
        desc: { JA: "必要なクライアント証明書またはキーペアを生成します。", ES: "Generar certificados de cliente o pares de claves requeridos.", EN: "Acquire mandatory client TLS keys or credentials." }
      },
      2: {
        title: { JA: "対応プロトコルの記述", ES: "Definir protocolo", EN: "Define Protocols" },
        desc: { JA: "SSE 輸送または起動コマンドなどのプロトコル情報を入力します。", ES: "Configurar opciones de transporte SSE o comandos de arranque.", EN: "Specify SSE transports or launch command protocols." }
      },
      3: {
        title: { JA: "サンドボックス検証", ES: "Pruebas en sandbox", EN: "Sandbox Self-Test" },
        desc: { JA: "ローカルサンドボックス環境で、ツールの呼び出しを試行します。", ES: "Validar llamadas de herramientas dentro del entorno de sandbox.", EN: "Execute local diagnostic tests for resource lookups." }
      },
      4: {
        title: { JA: "登録申請の提出", ES: "Enviar registro", EN: "Submit Registration" },
        desc: { JA: "登録が完了すると、直ちに接続検証が開始されます。", ES: "Una vez enviado el registro, se realiza la verificación remota.", EN: "Upon submission, connection verification automatically triggers." }
      }
    },
    "mcp-discovery": {
      1: {
        title: { JA: "ディスカバリパス指定", ES: "Declarar ruta", EN: "Declare Routes" },
        desc: { JA: "自動探索が可能になる共通の检测アドレスを指定します。", ES: "Configurar la ruta uniforme requerida para búsquedas de red.", EN: "Establish standard network discovery endpoints." }
      },
      2: {
        title: { JA: "確実に接続可能", ES: "Garantizar alcance", EN: "Ensure Reachability" },
        desc: { JA: "ファイアウォールなどのネットワーク設定を適切に開放します。", ES: "Configurar el firewall local o red de almacenamiento.", EN: "Ensure firewall access rules allow communication." }
      },
      3: {
        title: { JA: "标准機能の公開", ES: "Exponer capacidades", EN: "Expose Capabilities" },
        desc: { JA: "モデルコンテキストに必要なツール定義を正しく公開します。", ES: "Formatear definiciones que consumirá el protocolo.", EN: "Correctly format tool and resource lists." }
      },
      4: {
        title: { JA: "ブロードキャスト監視", ES: "Escucha dinámica", EN: "Dynamic Listening" },
        desc: { JA: "クラスター内連携を確立するため、動的な通知ソケットを開きます。", ES: "Habilitar sockets informativos de red local.", EN: "Support local pub/sub channels or network announcements." }
      }
    },
    "testing-publish": {
      1: {
        title: { JA: "個別単体テスト", ES: "Pruebas unitarias", EN: "Unit Testing" },
        desc: { JA: "すべてのハンドラーおよびデータ検証のコードをカバレッジに適合させます。", ES: "Implementar cobertura de pruebas automatizadas.", EN: "Ensure code coverage metrics are validated." }
      },
      2: {
        title: { JA: "マルチモーダル検証", ES: "Simular entradas", EN: "Simulate Inputs" },
        desc: { JA: "画像、構造化データなどの入力バリエーションで安全性を評価します。", ES: "Probar validaciones de archivos y parámetros dinámicos.", EN: "Verify behavior against non-standard file contexts." }
      },
      3: {
        title: { JA: "要件定義と一致", ES: "Verificar requeramientos", EN: "Verify Requirements" },
        desc: { JA: "ビジネスルールとクライアント要件に対して適切に設計されているかレビューします。", ES: "Garantizar que cumpla las expectativas operativas del cliente.", EN: "Review operation models against initial rules." }
      },
      4: {
        title: { JA: "システム安全性", ES: "Cumplir seguridad", EN: "Security Compliance" },
        desc: { JA: "資格情報の不必要な露出やセキュリティ侵害を完全に排除します。", ES: "Eliminar filtración de credenciales y asegurar privacidad.", EN: "Audit for credential leakages or vulnerable endpoints." }
      }
    }
  };

  const sectionMap = translations[sectionId];
  if (!sectionMap) return { title, desc };
  const itemMap = sectionMap[id];
  if (!itemMap) return { title, desc };

  return {
    title: itemMap.title[langCode] || title,
    desc: itemMap.desc[langCode] || desc
  };
}

function localizeFrontMatter(meta: Record<string, any>, id: string, langCode: string) {
  const result = { ...meta };
  result.title = getSectionTitle(id, langCode);
  
  if (langCode !== "ZH") {
    if (id === "quick-start") {
      result.description = langCode === "JA" ? "開発者コンソールで最初のコンテキスト対応能力を作成、実行、デバッグ、配信する。" : langCode === "ES" ? "Cree, ejecute, depure y publique su primera capacidad en la consola de desarrollo." : "Build, run, debug, and publish your first context-aware capability in the developer console.";
      if (result.downloadLabel) {
        result.downloadLabel = langCode === "JA" ? "SDK クイックスタート・スターターパック" : langCode === "ES" ? "Paquete de inicio rápido de SDK" : "SDK Quickstart Starter Pack";
      }
      if (result.actionLabel) {
        result.actionLabel = langCode === "JA" ? "開発者センターへ移動" : langCode === "ES" ? "Ir al centro de desarrollo" : "Go to Developer Center";
      }
    } else if (id === "skill-upload") {
      result.description = langCode === "JA" ? "パッケージ化、メタデータの要件、依存関係定義を含む、Skillのアップロード仕様。" : langCode === "ES" ? "Especificaciones sobre cómo empaquetar, definir metadatos y dependencias para subir Skills." : "Specifications for packaging, metadata requirements, and dependency definitions for uploading Skills.";
      if (result.downloadLabel) {
        result.downloadLabel = langCode === "JA" ? "標準的な Skill テンプレート" : langCode === "ES" ? "Plantilla de Skill estándar" : "Standard Skill Template";
      }
      if (result.actionLabel) {
        result.actionLabel = langCode === "JA" ? "新しい Skill をアップロード" : langCode === "ES" ? "Subir nueva Skill" : "Upload New Skill";
      }
    } else if (id === "skill-md-guide") {
      result.description = langCode === "JA" ? "AIモデルがSkillを正しく認識して選択できるようにSKILL.mdを作成するための詳細な指示。" : langCode === "ES" ? "Instrucciones detalladas sobre cómo escribir un archivo SKILL.md robusto." : "Detailed instructions on scripting a robust SKILL.md file.";
      if (result.downloadLabel) {
        result.downloadLabel = langCode === "JA" ? "リファレンス SKILL.md 見本" : langCode === "ES" ? "Plantilla de SKILL.md" : "Reference SKILL.md Spec";
      }
    } else if (id === "mcp-register") {
      result.description = langCode === "JA" ? "SSEおよびStdioプロトコルを使用した、モデルコンテキストプロトコル（MCP）サーバーの登録とテストのステップ。" : langCode === "ES" ? "Pasos para registrar y probar los servidores de Model Context Protocol (MCP)." : "Steps to register and test Model Context Protocol (MCP) servers.";
      if (result.actionLabel) {
        result.actionLabel = langCode === "JA" ? "MCP サーバーを登録" : langCode === "ES" ? "Registrar MCP" : "Register MCP Server";
      }
    } else if (id === "mcp-discovery") {
      result.description = langCode === "JA" ? "共通レジストリからの自動MCP服务検出の仕組みを有効にするためのガイド。" : langCode === "ES" ? "Habilite el descubrimiento automático del servidor MCP en el clúster local." : "Enable automated MCP server discovery on the local cluster.";
    } else if (id === "testing-publish") {
      result.description = langCode === "JA" ? "実稼働環境にコミットする前の、ローカルでの単体テスト、安全なテスト構成、検証、および監査要件。" : langCode === "ES" ? "Pruebas unitarias, configuraciones seguras de sandbox y flujos de auditoría." : "Unit-testing, secure sandboxed configurations, and audit workflows.";
      if (result.actionLabel) {
        result.actionLabel = langCode === "JA" ? "監査センターを開く" : langCode === "ES" ? "Ver auditoría" : "Go to Audit Center";
      }
    }
  }
  return result;
}

// ----------------------------------------------------------------------
// CodeBlock Sub-Component with full-featured copy support
// ----------------------------------------------------------------------
function CodeBlock({ children, className, langCode = "ZH" }: { children: any; className?: string; langCode?: string }) {
  const [copied, setCopied] = useState(false);
  const codeString = getTextFromChildren(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "text";

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2050);
  };

  return (
    <div className="relative my-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm text-slate-100 font-mono text-xs">
      <div className="flex items-center justify-between bg-slate-900 px-3.5 py-2 text-xs text-slate-400 border-b border-slate-800 border-solid">
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          <span className="flex h-2 w-2 rounded-full bg-slate-700" />
          <span className="font-mono uppercase">{lang}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">
                {langCode === "ZH" ? "已复制" : langCode === "JA" ? "コピー済" : langCode === "ES" ? "Copiado" : "Copied"}
              </span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>
                {langCode === "ZH" ? "复制代码" : langCode === "JA" ? "コピー" : langCode === "ES" ? "Copiar" : "Copy"}
              </span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 leading-6 text-slate-300">
        <code>{codeString}</code>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Collapsible FAQ section sub-component
// ----------------------------------------------------------------------
function FaqSection({ faqs, langCode = "ZH" }: { faqs?: Array<{ q: string; a: string }>; langCode?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!faqs || faqs.length === 0) return null;

  return (
    <div className="mt-12 border-t border-slate-100 pt-8" id="faq-section">
      <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
        <HelpCircle className="h-4.5 w-4.5 text-blue-500" />
        {langCode === "ZH" ? "常见问题 FAQs" : langCode === "JA" ? "よくある質問 FAQs" : langCode === "ES" ? "Preguntas frecuentes FAQs" : "Frequently Asked Questions FAQs"}
      </h2>
      <div className="space-y-2">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="rounded-lg border border-slate-100 bg-white overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-90 text-blue-500")} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-xs leading-6 text-slate-500 bg-slate-50/30 border-t border-slate-50 pt-2.5">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN EXPORTABLE GUIDE PAGE
// ----------------------------------------------------------------------
export function Guide({ langCode: _langCode = "ZH", setActiveMenu }: GuideProps) {
  const t = getI18n(_langCode);
  const [activeSection, setActiveSection] = useState<SectionId>("quick-start");
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [guideAlert, setGuideAlert] = useState<FlashMessage | null>(null);
  const formatAlert = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce((message, [key, value]) => message.replace(`{${key}}`, value), template);
  const showGuideAlert = (message: FlashMessage) => {
    setGuideAlert(message);
    window.setTimeout(() => setGuideAlert(null), 3000);
  };

  const filteredSections = useMemo(() => {
    if (!docSearchQuery.trim()) return GUIDE_SECTIONS;
    const query = docSearchQuery.toLowerCase().trim();
    return GUIDE_SECTIONS.filter((section) => {
      const titleMatch = section.title.toLowerCase().includes(query);
      const content = DOCS_MAP[section.id] || "";
      const contentMatch = content.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });
  }, [docSearchQuery]);

  const activeMeta = useMemo(
    () => GUIDE_SECTIONS.find((s) => s.id === activeSection) ?? GUIDE_SECTIONS[0],
    [activeSection]
  );

  const rawMarkdown = DOCS_MAP[activeSection] || "";

  const { data: rawMeta, content: markdownBody } = useMemo(
    () => parseFrontMatter(rawMarkdown),
    [rawMarkdown]
  );

  const meta = useMemo(
    () => localizeFrontMatter(rawMeta, activeSection, _langCode),
    [rawMeta, activeSection, _langCode]
  );

  const currentIndex = useMemo(
    () => GUIDE_SECTIONS.findIndex((s) => s.id === activeSection),
    [activeSection]
  );

  // Extract all headings for the Table of Contents (TOC)
  const headers = useMemo(() => {
    const lines = markdownBody.split("\n");
    const foundHeaders: HeaderItem[] = [];
    let isCodeBlock = false;

    // Optional Checklist if front-matter checklist is present
    if (meta.checklist && meta.checklist.length > 0) {
      foundHeaders.push({ 
        id: "checklist-section", 
        title: _langCode === "ZH" ? "发布前检查清单" : _langCode === "JA" ? "リリース前チェックリスト" : _langCode === "ES" ? "Checklist de publicación" : "Pre-release Checklist", 
        level: 2 
      });
    }

    for (let line of lines) {
      if (line.trim().startsWith("```")) {
        isCodeBlock = !isCodeBlock;
        continue;
      }
      if (isCodeBlock) continue;

      const h2Match = line.match(/^##\s+(.+)$/);
      if (h2Match) {
        const title = h2Match[1].trim();
        const id = title.replace(/[^\w\u4e00-\u9fa5a-zA-Z0-9-]/g, "-").toLowerCase();
        foundHeaders.push({ id, title, level: 2 });
      }

      const h3Match = line.match(/^###\s+(.+)$/);
      if (h3Match) {
        const title = h3Match[1].trim();
        const id = title.replace(/[^\w\u4e00-\u9fa5a-zA-Z0-9-]/g, "-").toLowerCase();
        foundHeaders.push({ id, title, level: 3 });
      }
    }

    if (meta.faqs && meta.faqs.length > 0) {
      foundHeaders.push({ 
        id: "faq-section", 
        title: _langCode === "ZH" ? "常见问题" : _langCode === "JA" ? "よくある質問" : _langCode === "ES" ? "Preguntas frecuentes" : "FAQs", 
        level: 2 
      });
    }

    return foundHeaders;
  }, [markdownBody, meta]);

  // IntersectionObserver scroll spy to sync active section highlighting in TOC
  useEffect(() => {
    setActiveHeadingId("");
    // Give elements a tiny frame to mount on DOM before observing
    const timer = setTimeout(() => {
      const headings = document.querySelectorAll("[id='checklist-section'], [id='faq-section'], h2[id], h3[id]");
      const observer = new IntersectionObserver(
        (entries) => {
          // Find topmost visible entry in viewport
          const visible = entries.find((e) => e.isIntersecting);
          if (visible) {
            setActiveHeadingId(visible.target.id);
          }
        },
        { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
      );

      headings.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSection, markdownBody]);

  const handleHeadingClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    // Smooth scroll the main reader area back to the top
    const readerEl = document.getElementById("guide-reader-container");
    if (readerEl) {
      readerEl.scrollTop = 0;
    }
  };

  const handleActionClick = (menu: string) => {
    if (!setActiveMenu) {
      showGuideAlert({ type: "warning", title: t.alertActionRequiredTitle, description: formatAlert(t.guidePublishEntryAlert, { menu }) });

      return;
    }
    
    if (menu === "dev" || menu === "developer_center") {
      setActiveMenu("developer");
    } else if (menu === "audit") {
      setActiveMenu("audit");
    } else if (menu === "market") {
      setActiveMenu("market");
    } else {
      setActiveMenu("workbench");
    }
  };

  // Custom component renderers in ReactMarkdown to translate standard HTML to Tailwind/shadcn components
  const markdownRenderers = useMemo(() => {
    return {
      h2: ({ children }: any) => {
        const title = getTextFromChildren(children);
        const id = title.replace(/[^\w\u4e00-\u9fa5a-zA-Z0-9-]/g, "-").toLowerCase();
        return (
          <h2 id={id} className="scroll-m-20 text-md font-black text-slate-950 mt-10 mb-4 border-b border-slate-100 pb-2.5 flex items-center gap-2 group">
            <span className="text-blue-500 font-black">#</span>
            {children}
          </h2>
        );
      },
      h3: ({ children }: any) => {
        const title = getTextFromChildren(children);
        const id = title.replace(/[^\w\u4e00-\u9fa5a-zA-Z0-9-]/g, "-").toLowerCase();
        return (
          <h3 id={id} className="scroll-m-20 text-sm font-black text-slate-800 mt-7 mb-3 flex items-center gap-1.5">
            <span className="text-blue-600 font-extrabold">•</span>
            {children}
          </h3>
        );
      },
      p: ({ children }: any) => {
        return <p className="text-xs leading-6 text-slate-600 mb-4">{children}</p>;
      },
      ul: ({ children }: any) => {
        return <ul className="list-disc list-inside space-y-2 mb-4 text-xs text-slate-600 pl-3 leading-6">{children}</ul>;
      },
      ol: ({ children }: any) => {
        return <ol className="list-decimal list-inside space-y-2 mb-4 text-xs text-slate-600 pl-3 leading-6">{children}</ol>;
      },
      li: ({ children }: any) => {
        return <li className="marker:text-slate-400 font-medium">{children}</li>;
      },
      blockquote: ({ children }: any) => {
        const text = getTextFromChildren(children);
        const isTip = text.startsWith("提示") || text.includes("提示");
        const isWarning = text.startsWith("警告") || text.startsWith("注意") || text.includes("注意");

        const AlertComponent = isWarning ? WarningAlert : BasicAlert;

        return (
          <AlertComponent
            description={<div className="font-medium">{children}</div>}
            className={cn("my-5 text-xs leading-5 shadow-sm", !isWarning && !isTip && "border-slate-100 bg-slate-50 text-slate-700")}
          />
        );
      },
      table: ({ children }: any) => {
        return (
          <div className="my-6 overflow-x-auto rounded-lg border border-slate-100 shadow-sm">
            <Table>{children}</Table>
          </div>
        );
      },
      thead: ({ children }: any) => {
        return <TableHeader>{children}</TableHeader>;
      },
      tbody: ({ children }: any) => {
        return <TableBody>{children}</TableBody>;
      },
      tr: ({ children }: any) => {
        return <TableRow>{children}</TableRow>;
      },
      th: ({ children }: any) => {
        return <TableHead>{children}</TableHead>;
      },
      td: ({ children }: any) => {
        return <TableCell>{children}</TableCell>;
      },
      code: ({ children, className }: any) => {
        const isBlock = String(children).includes("\n") || className;
        if (isBlock) {
          return <CodeBlock className={className}>{children}</CodeBlock>;
        }
        return (
          <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-50 text-xs font-mono text-slate-800 border border-slate-200">
            {children}
          </code>
        );
      },
    };
  }, [showGuideAlert, t]);

  return (
    <div className="dashboard-page-stack h-full overflow-hidden" id="haze-unified-guide-page">
      {guideAlert && <FloatingAlert {...guideAlert} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border/70 bg-white lg:grid-cols-[250px_1fr]">
        
        {/* Left Column: Fixed Navigation Sidebar */}
        <aside className="hidden min-h-0 border-r border-border/70 bg-slate-50/40 p-4 lg:flex lg:flex-col">
          <div className="mb-4 px-1">
            <h2 className="text-base font-black text-slate-900 tracking-wider">
              {_langCode === "ZH" ? "开发者指南" : _langCode === "JA" ? "開発者ガイド" : _langCode === "ES" ? "Guía del desarrollador" : "Developer Guide"}
            </h2>
            <div className="relative mt-2.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder={_langCode === "ZH" ? "搜索文档内容..." : _langCode === "JA" ? "ドキュメントを検索..." : _langCode === "ES" ? "Buscar en documentación..." : "Search documentation..."}
                className="pl-8 bg-white border-slate-200 text-xs h-8 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 pr-1.5">
              {filteredSections.length > 0 ? (
                filteredSections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleSectionChange(section.id)}
                      className={cn(
                        "group relative flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-xs transition-all cursor-pointer",
                        active
                          ? "bg-blue-50/85 text-blue-600 font-extrabold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 font-medium"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-2.5 h-5 w-1 rounded-r-md bg-blue-600" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600")} />
                      <span className="min-w-0 flex-1 truncate">{getSectionTitle(section.id, _langCode)}</span>
                      <ChevronRight className={cn("h-3 w-3 shrink-0 transition-all opacity-0", active ? "opacity-100 text-blue-500" : "group-hover:opacity-40 group-hover:translate-x-0.5 text-slate-400")} />
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-8 text-center text-xs text-slate-400">
                  {_langCode === "ZH" ? "没有找到匹配的文档" : _langCode === "JA" ? "一致するドキュメントはありません" : _langCode === "ES" ? "No se encontraron documentos" : "No matching docs found"}
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Right Content Area + TOC split */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_220px]">
          
          {/* Middle Column: Scrollable Document Body */}
          <main className="flex min-h-0 flex-col overflow-hidden" id="guide-reader-container">
            {/* Top Toolbar for Mobile Layout navigation selector list */}
            <div className="border-b border-border/70 bg-white p-4.5 block lg:hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <activeMeta.icon className="h-4.5 w-4.5 text-blue-600" />
                  <h1 className="text-sm font-black text-slate-950">{getSectionTitle(activeMeta.id, _langCode)}</h1>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GUIDE_SECTIONS.map((section) => (
                    <Button
                      key={section.id}
                      variant={activeSection === section.id ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2.5 text-xs font-bold"
                      onClick={() => handleSectionChange(section.id)}
                    >
                      {getSectionTitle(section.id, _langCode)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Core Reader Body */}
            <ScrollArea className="min-h-0 flex-1 bg-white">
              <div className="mx-auto max-w-[900px] px-6 py-8 md:px-10">
                
                {/* Header Metadata Section */}
                <div className="mb-8 border-b border-slate-100 pb-8">
                  <div className="flex flex-col gap-4.5 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3.5 max-w-[580px]">
                      <h1 className="text-lg font-black text-slate-950 font-sans tracking-tight">
                        {getSectionTitle(activeSection, _langCode)}
                      </h1>
                      <p className="text-xs leading-5.5 text-slate-500 font-medium">
                        {meta.description}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {meta.updatedAt && (
                          <span className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                            {t.lastUpdated}: {meta.updatedAt}
                          </span>
                        )}
                        {meta.readingTime && (
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            {t.estimatedReading}: {meta.readingTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Standard Action buttons mapped dynamically */}
                    <div className="flex flex-row md:flex-col items-stretch gap-2 shrink-0 pt-1.5 w-full md:w-auto">
                      {meta.downloadLabel && (
                        <Button
                          variant="outline"
                          className="h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 text-xs border border-slate-200 text-slate-700 font-bold flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer w-full md:w-auto"
                          onClick={() => {
                            showGuideAlert({ type: "success", title: t.alertDownloadStartedTitle, description: formatAlert(t.guideDownloadAlert, { label: meta.downloadLabel ?? "", url: meta.downloadUrl ?? "" }) });
                          }}
                        >
                          <Download className="h-3.5 w-3.5 text-slate-400" />
                          {meta.downloadLabel}
                        </Button>
                      )}
                      
                      {meta.actionLabel && (
                        <Button
                          className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer w-full md:w-auto"
                          onClick={() => handleActionClick(meta.actionMenu)}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          {meta.actionLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Front Matter Visual Checklist Block */}
                {meta.checklist && meta.checklist.length > 0 && (
                  <div className="mb-10" id="checklist-section">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                      {_langCode === "ZH" ? "发布前检查清单" : _langCode === "JA" ? "リリース前チェックリスト" : _langCode === "ES" ? "Checklist de publicación" : "Pre-release Checklist"}
                    </h2>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-4">
                      {meta.checklist.map((item: any, i: number) => {
                        const Icon = getIconByName(item.icon);
                        const colors = [
                          { numBg: "bg-blue-50 text-blue-600", iconBg: "bg-blue-50/50 text-blue-500" },
                          { numBg: "bg-emerald-50 text-emerald-600", iconBg: "bg-emerald-50/50 text-emerald-500" },
                          { numBg: "bg-amber-50 text-amber-600", iconBg: "bg-amber-50/50 text-amber-500" },
                          { numBg: "bg-purple-50 text-purple-600", iconBg: "bg-purple-50/50 text-purple-500" },
                        ][i % 4];

                        const localItem = translateChecklistItem(Number(item.id), item.title, item.desc, activeSection, _langCode);

                        return (
                          <Card key={item.id} className="rounded-lg border-2 border-slate-100/50 hover:border-slate-200/80 bg-white relative p-4 shadow-none overflow-hidden hover:shadow-none transition-all duration-200">
                            <div className="flex items-center justify-between mb-3.5">
                              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-black", colors.numBg)}>
                                {item.id}
                              </span>
                              <div className={cn("p-1.5 rounded-md", colors.iconBg)}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                            </div>
                            <p className="text-xs font-black text-slate-900 mb-1 leading-tight">{localItem.title}</p>
                            <p className="text-xs leading-relaxed text-slate-500 font-medium">{localItem.desc}</p>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Markdown Main Body Article */}
                <div className="prose prose-slate prose-blue max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownRenderers}>
                    {markdownBody}
                  </ReactMarkdown>
                </div>

                {/* Render the Dynamic FAQ collapsed boards */}
                {meta.faqs && meta.faqs.length > 0 && (
                  <FaqSection faqs={meta.faqs} langCode={_langCode} />
                )}

                {/* Footer page buttons (Previous / Next Article) */}
                <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-7">
                  {currentIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSectionChange(GUIDE_SECTIONS[currentIndex - 1].id)}
                      className="flex flex-col items-start gap-1 p-2 rounded-lg hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                    >
                      <span className="text-xs text-slate-400 font-extrabold uppercase tracking-widest pl-1.5">
                        {_langCode === "ZH" ? "上一篇" : _langCode === "JA" ? "前へ" : _langCode === "ES" ? "Anterior" : "Previous"}
                      </span>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 flex items-center gap-0.5">
                        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 text-slate-400 group-hover:text-blue-500" />
                        {getSectionTitle(GUIDE_SECTIONS[currentIndex - 1].id, _langCode)}
                      </span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {currentIndex < GUIDE_SECTIONS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => handleSectionChange(GUIDE_SECTIONS[currentIndex + 1].id)}
                      className="flex flex-col items-end gap-1 p-2 rounded-lg hover:bg-slate-50 transition-colors text-right group cursor-pointer"
                    >
                      <span className="text-xs text-slate-400 font-extrabold uppercase tracking-widest pr-1.5">
                        {_langCode === "ZH" ? "下一篇" : _langCode === "JA" ? "次へ" : _langCode === "ES" ? "Siguiente" : "Next"}
                      </span>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 flex items-center gap-0.5">
                        {getSectionTitle(GUIDE_SECTIONS[currentIndex + 1].id, _langCode)}
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 text-slate-400 group-hover:text-blue-500" />
                      </span>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>

              </div>
            </ScrollArea>
          </main>

          {/* Right Column: Floating dynamic Table of Contents (TOC) & FAQ links */}
          <aside className="hidden border-l border-border/70 bg-white p-4.5 lg:flex lg:flex-col min-h-0 select-none">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5">
              {_langCode === "ZH" ? "本页目录" : _langCode === "JA" ? "コンテンツ" : _langCode === "ES" ? "Tabla de contenidos" : "TOC"}
            </h3>

            <ScrollArea className="min-h-0 flex-1">
              {headers.length > 0 ? (
                <div className="space-y-1 py-1 relative pl-1 border-l border-slate-100">
                  {headers.map((hdr) => {
                    const isActive = activeHeadingId === hdr.id;
                    return (
                      <button
                        key={hdr.id}
                        type="button"
                        onClick={() => handleHeadingClick(hdr.id)}
                        className={cn(
                          "block w-full text-left font-sans text-xs py-1 transition-all relative cursor-pointer leading-5.5",
                          hdr.level === 3 ? "pl-5 text-slate-400" : "pl-3 font-semibold text-slate-500",
                          isActive
                            ? "text-blue-600 font-black scale-102"
                            : "hover:text-slate-800"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-[-5px] top-1.5 h-3.5 w-1 bg-blue-600 rounded-lg shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                        )}
                        {hdr.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  {_langCode === "ZH" ? "无章节目录" : _langCode === "JA" ? "セクションなし" : _langCode === "ES" ? "Sin secciones" : "No sections"}
                </p>
              )}

              {/* Static Quick FAQ items link in right rail list */}
              {meta.faqs && meta.faqs.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5">
                    {_langCode === "ZH" ? "常见问题" : _langCode === "JA" ? "よくある質問" : _langCode === "ES" ? "Faqs" : "FAQs"}
                  </h3>
                  <div className="space-y-3.5">
                    {meta.faqs.map((faq: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleHeadingClick("faq-section")}
                        className="block w-full text-left text-xs leading-relaxed text-slate-500 hover:text-blue-600 transition-colors font-medium cursor-pointer"
                      >
                        {faq.q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </aside>

        </div>
      </div>
    </div>
  );
}
