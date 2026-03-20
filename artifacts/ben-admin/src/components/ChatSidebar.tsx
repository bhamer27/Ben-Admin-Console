import { useState, useRef, useEffect } from "react";
import { Send, X, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSidebarProps {
  tab: string;
  tabData?: unknown;
  onClose: () => void;
}

export function ChatSidebar({ tab, tabData, onClose }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `On the **${tab}** tab. What do you want to know or change?` },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: `On the **${tab}** tab. What do you want to know or change?` }]);
    setToolCalls([]);
  }, [tab]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setStreaming(true);
    setToolCalls([]);

    let assistantText = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          tabContext: { tab, data: tabData },
        }),
      });

      if (!r.ok || !r.body) {
        throw new Error(`HTTP ${r.status}`);
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "text") {
              assistantText += ev.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantText };
                return updated;
              });
            } else if (ev.type === "tool_call") {
              setToolCalls(ev.tools as string[]);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${msg}` };
        return updated;
      });
    }

    setStreaming(false);
    setToolCalls([]);
  };

  const renderContent = (content: string) => {
    // Simple bold/code rendering
    return content
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        return part;
      });
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Kowalski</span>
          <Badge variant="outline" className="text-xs capitalize">{tab}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {m.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/60 text-foreground rounded-tl-sm border border-border/50",
                )}
              >
                {m.content
                  ? renderContent(m.content)
                  : m.role === "assistant" && streaming
                    ? <span className="inline-block w-1.5 h-4 bg-foreground/40 animate-pulse rounded-sm" />
                    : null}
              </div>
            </div>
          ))}

          {toolCalls.length > 0 && streaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching {toolCalls.join(", ")}...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Ask about ${tab}...`}
            className="min-h-[60px] max-h-[120px] resize-none text-sm bg-muted/30"
            disabled={streaming}
          />
          <Button
            size="icon"
            onClick={send}
            disabled={streaming || !input.trim()}
            className="h-9 w-9 shrink-0"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
