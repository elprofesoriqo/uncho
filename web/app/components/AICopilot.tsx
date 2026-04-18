'use client';

import { useState, useRef, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, User, SendHorizontal } from 'lucide-react';

interface Props {
  seedMessages: UIMessage[];
  quickPrompts?: string[];
  sandboxNode?: React.ReactNode;
  subtitle?: string;
  inputPlaceholder?: string;
}

export function AICopilot({
  seedMessages,
  quickPrompts = [],
  sandboxNode,
  subtitle = 'OCHA Crisis Intelligence',
  inputPlaceholder = 'Pledge, query situation, or request brief…',
}: Props) {
  const { messages, sendMessage, status } = useChat({
    messages: seedMessages,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || status === 'streaming') return;
    sendMessage({ text });
    setDraft('');
  }, [draft, status, sendMessage]);

  const formatContent = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**') ? (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const getMessageText = (m: UIMessage): string => {
    const textPart = m.parts.find((p) => p.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    return textPart?.text ?? '';
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#008CFF] to-[#0070CC] shadow-sm">
          <Bot size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold tracking-wide text-slate-800">AI Co-Pilot</p>
          <p className="text-[9px] text-slate-400">{subtitle}</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      </div>

      {/* Sandbox slot (optional) */}
      {sandboxNode}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          const text = getMessageText(m);
          return (
            <div
              key={m.id}
              className={`msg-in flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                  ${m.role === 'assistant' ? 'bg-[#008CFF]/10' : 'bg-slate-100'}`}
              >
                {m.role === 'assistant' ? (
                  <Bot size={11} className="text-[#008CFF]" />
                ) : (
                  <User size={11} className="text-slate-500" />
                )}
              </div>
              <div
                className={`max-w-[210px] rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-line
                  ${m.role === 'assistant'
                    ? 'rounded-tl-sm bg-slate-50 text-slate-700 border border-slate-100'
                    : 'rounded-tr-sm bg-[#008CFF] text-white'
                  }`}
              >
                {m.role === 'assistant' ? formatContent(text) : text}
              </div>
            </div>
          );
        })}
        {status === 'streaming' && (
          <div className="flex gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#008CFF]/10">
              <Bot size={11} className="text-[#008CFF]" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-slate-400"
                  style={{ animation: 'pulse 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {quickPrompts.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((chip) => (
              <button
                key={chip}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 transition-all duration-150 hover:border-[#008CFF]/40 hover:bg-[#008CFF]/5 hover:text-[#008CFF]"
                onClick={() => setDraft(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={inputPlaceholder}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition-all duration-150 focus:border-[#008CFF]/40 focus:bg-white focus:ring-2 focus:ring-[#008CFF]/10"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || status === 'streaming'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008CFF] text-white shadow-sm transition-all duration-150 hover:bg-[#0070CC] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendHorizontal size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
