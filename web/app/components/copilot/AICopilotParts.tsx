import { Bot, User, SendHorizontal } from "lucide-react";
import { type UIMessage } from "ai";

interface HeaderProps {
  subtitle: string;
}

interface MessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
}

interface QuickPromptsProps {
  quickPrompts: string[];
  onSelect: (prompt: string) => void;
}

interface ComposerProps {
  draft: string;
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function formatAssistantText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-800">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function getMessageText(m: UIMessage): string {
  const textPart = m.parts.find((p) => p.type === "text") as
    | { type: "text"; text: string }
    | undefined;

  return textPart?.text ?? "";
}

export function CopilotHeader({ subtitle }: HeaderProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-un-blue to-un-blue-dark shadow-sm">
        <Bot size={15} className="text-white" strokeWidth={2.2} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-bold tracking-wide text-slate-800">AI Co-Pilot</p>
        <p className="text-[9px] text-slate-400">{subtitle}</p>
      </div>
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
    </div>
  );
}

export function CopilotMessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((m, i) => {
        const text = getMessageText(m);
        const isUser = m.role === "user";

        return (
          <div
            key={m.id}
            className={`msg-in flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isUser ? "bg-slate-100" : "bg-un-blue/10"
              }`}
            >
              {isUser ? (
                <User size={11} className="text-slate-500" />
              ) : (
                <Bot size={11} className="text-un-blue" />
              )}
            </div>
            <div
              className={`max-w-52.5 whitespace-pre-line rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed ${
                isUser
                  ? "rounded-tr-sm bg-un-blue text-white"
                  : "rounded-tl-sm border border-slate-100 bg-slate-50 text-slate-700"
              }`}
            >
              {isUser ? text : formatAssistantText(text)}
            </div>
          </div>
        );
      })}

      {isStreaming && (
        <div className="flex gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-un-blue/10">
            <Bot size={11} className="text-un-blue" />
          </div>
          <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                style={{
                  animation: "pulse 1s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CopilotQuickPrompts({
  quickPrompts,
  onSelect,
}: QuickPromptsProps) {
  if (quickPrompts.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-slate-100 px-4 py-2">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
        Quick Actions
      </p>
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((chip) => (
          <button
            key={chip}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 transition-all duration-150 hover:border-un-blue/40 hover:bg-un-blue/5 hover:text-un-blue"
            onClick={() => onSelect(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CopilotComposer({
  draft,
  disabled,
  placeholder,
  onChange,
  onSubmit,
}: ComposerProps) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition-all duration-150 focus:border-un-blue/40 focus:bg-white focus:ring-2 focus:ring-un-blue/10"
        />
        <button
          onClick={onSubmit}
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-un-blue text-white shadow-sm transition-all duration-150 hover:bg-un-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
