import { BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface GuidelineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuidelineSheet({ open, onOpenChange }: GuidelineSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-white flex flex-col h-full justify-between border-l border-zinc-200">
        <ScrollArea className="flex-1 p-6">
          <SheetHeader className="pb-4 border-b border-neutral-100 text-left">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-zinc-[650]" />
              <SheetTitle className="text-sm font-semibold text-zinc-900">Haze AI Hub 接入指引</SheetTitle>
            </div>
            <SheetDescription className="text-xs text-zinc-500 mt-1">
              关于发布企业 AI 技能及对接 Model Context Protocol (MCP) 服务器的开发说明与指引。
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 text-xs text-neutral-600 leading-relaxed pr-1">
            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-800 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                1. 什么是 AI Skill ？
              </h4>
              <p className="pl-3.5 text-xs text-neutral-500 leading-relaxed">
                AI Skill 是封装了特定业务大模型 Prompt、业务参数及网关调用流管道的微代理单元。开发者设定大模型底层、定制最合适的词和结构，即可配置出“专属一键执行模块”供业务员零门槛重复使用。
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-800 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                2. MCP Server 上下文接口规范
              </h4>
              <p className="pl-3.5 text-xs text-neutral-500 leading-relaxed">
                Model Context Protocol (MCP) 是当前大模型安全连接外部上下文的事实标准接口。发布并注册您的 MCP，支持 system 零摩擦同步数据库元属性，以及动态获取高合规性私域内容。
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-800 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                3. 模型沙箱机制
              </h4>
              <p className="pl-3.5 text-xs text-neutral-500 leading-relaxed">
                所有的企业能力在生产沙箱内部安全隔离。严禁在提示词 (Prompt) 或是参数定义中暴露数据库明文密码密钥等个人敏感信息，敏感越权审批可以通过审核中心完成授权。
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-zinc-400 font-semibold">版本 v1.0.5 — 2026</span>
          <Button onClick={() => onOpenChange(false)} size="sm" className="h-8 text-xs font-medium cursor-pointer">
            已阅读并理解
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
