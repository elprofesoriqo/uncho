"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Zap, AlertCircle, Search, BarChart3, Globe2, TrendingUp } from "lucide-react";
import { streamChat, type ChatMessage, type ChatEvent } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/ui/Primitives";

const QUICK_PROMPTS = [
  { icon: Search, label: "Top 5 overlooked crises", prompt: "Which 5 crises are most overlooked globally right now? Rank them and explain why." },
  { icon: Globe2, label: "Africa funding situation", prompt: "Summarize the current humanitarian funding situation in Sub-Saharan Africa. Highlight the most critically underfunded countries." },
  { icon: BarChart3, label: "WASH sector gaps", prompt: "Which countries have the largest WASH (water, sanitation, hygiene) funding gaps? Include coverage ratios." },
  { icon: TrendingUp, label: "Structural crisis analysis", prompt: "Identify the top 3 structural crises — those with chronic multi-year neglect — and explain the structural drivers." },
];

interface MessageBlock {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "tool_call" | "status" | "error";
  tool?: string;
}

function ToolCallBubble({ tool, input }: { tool: string; input?: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg text-[11px] text-muted">
      <Zap size={11} className="text-accent flex-shrink-0" />
      <span className="text-accent font-medium">{tool.replace(/_/g, " ")}</span>
      {input && Object.keys(input).length > 0 && (
        <span className="text-faint truncate max-w-[300px]">
          {Object.entries(input).map(([k, v]) => `${k}=${String(v)}`).join(", ")}
        </span>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: MessageBlock }) {
  if (msg.type === "tool_call") {
    return <ToolCallBubble tool={msg.tool ?? msg.content} />;
  }
  if (msg.type === "status") {
    return (
      <div className="flex items-center gap-2 text-[11px] text-faint py-1">
        <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
        {msg.content}
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? "bg-accent/20 border border-accent/30" : "bg-surface-3 border border-border"
      }`}>
        {isUser ? <User size={12} className="text-accent" /> : <Bot size={12} className="text-muted" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {msg.type === "error" ? (
          <div className="px-3 py-2 bg-severe/10 border border-severe/30 rounded-lg text-severe text-[12px] flex items-center gap-2">
            <AlertCircle size={12} /> {msg.content}
          </div>
        ) : (
          <div className={`px-3 py-2.5 rounded-xl text-[13px] leading-relaxed ${
            isUser
              ? "bg-accent/15 border border-accent/20 text-text"
              : "bg-surface-2 border border-border text-text"
          }`}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="text-text font-semibold">{children}</strong>,
                code: ({ children }) => <code className="mono text-[11px] bg-surface-3 px-1 py-0.5 rounded text-accent">{children}</code>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-[12px]">{children}</li>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageBlock[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function send(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || streaming) return;
    setInput("");

    const userBlock: MessageBlock = { role: "user", content: msg, type: "text" };
    setMessages(m => [...m, userBlock]);
    setHistory(h => [...h, { role: "user", content: msg }]);
    setStreaming(true);
    setStreamingContent("");

    let assistantText = "";

    const ctrl = streamChat(
      msg,
      history,
      (ev: ChatEvent) => {
        if (ev.type === "tool_call") {
          setMessages(m => [...m, { role: "system", content: ev.tool ?? "", type: "tool_call", tool: ev.tool }]);
        } else if (ev.type === "status") {
          setMessages(m => {
            const last = m[m.length - 1];
            if (last?.type === "status") return [...m.slice(0, -1), { role: "system", content: ev.content ?? "", type: "status" }];
            return [...m, { role: "system", content: ev.content ?? "", type: "status" }];
          });
        } else if (ev.type === "message") {
          assistantText += ev.content ?? "";
          setStreamingContent(assistantText);
        } else if (ev.type === "error") {
          setMessages(m => [...m, { role: "assistant", content: ev.content ?? "An error occurred.", type: "error" }]);
        }
      },
      () => {
        setStreaming(false);
        setStreamingContent("");
        if (assistantText) {
          setMessages(m => {
            const filtered = m.filter(x => x.type !== "status");
            return [...filtered, { role: "assistant", content: assistantText, type: "text" }];
          });
          setHistory(h => [...h, { role: "assistant", content: assistantText }]);
        }
      }
    );
    abortRef.current = ctrl;
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <PageHeader
          title="AI Co-Pilot"
          subtitle="Conversational intelligence layer — queries live Databricks data via Claude"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Bot size={22} className="text-accent" />
            </div>
            <h2 className="text-[16px] font-semibold text-text mb-2">Lighthouse OS Intelligence</h2>
            <p className="text-muted text-[13px] max-w-[400px] mx-auto mb-8 leading-relaxed">
              Ask about any humanitarian crisis, funding gap, or donor pattern. I query live Databricks data and provide analysis with confidence scores.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-[480px] mx-auto">
              {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => send(prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 card hover:bg-surface-2 hover:border-border-2 transition-all text-left rounded-lg"
                >
                  <Icon size={13} className="text-accent flex-shrink-0" />
                  <span className="text-[12px] text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {/* Streaming assistant bubble */}
        {streaming && streamingContent && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-surface-3 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={12} className="text-muted" />
            </div>
            <div className="max-w-[75%] px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-[13px] leading-relaxed">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
                  code: ({ children }) => <code className="mono text-[11px] bg-surface-3 px-1 py-0.5 rounded text-accent">{children}</code>,
                  ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
                  li: ({ children }) => <li className="text-[12px]">{children}</li>,
                }}
              >
                {streamingContent}
              </ReactMarkdown>
              <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-pulse align-bottom" />
            </div>
          </div>
        )}

        {/* Tool call spinner */}
        {streaming && !streamingContent && (
          <div className="flex items-center gap-2 text-muted text-[12px]">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            Querying data…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-surface">
        <div className="flex items-end gap-3 max-w-[900px] mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about a crisis, funding gap, or donor pattern…"
            rows={1}
            disabled={streaming}
            className="flex-1 bg-surface-2 border border-border text-text text-[13px] rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-accent disabled:opacity-50 leading-relaxed"
            style={{ minHeight: "44px", maxHeight: "180px" }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="w-[44px] h-[44px] bg-accent rounded-xl flex items-center justify-center hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-center text-[10px] text-faint mt-2 max-w-[900px] mx-auto">
          All responses cite data confidence scores. [OBSERVED] = live data. [FORECAST] = Kumo.AI projection.
        </p>
      </div>
    </div>
  );
}
