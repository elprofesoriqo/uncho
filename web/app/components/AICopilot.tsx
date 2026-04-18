'use client';

import { useState, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  CopilotComposer,
  CopilotHeader,
  CopilotMessageList,
  CopilotQuickPrompts,
} from './copilot/AICopilotParts';

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

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || status === 'streaming') return;
    sendMessage({ text });
    setDraft('');
  }, [draft, status, sendMessage]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      <CopilotHeader subtitle={subtitle} />

      {/* Sandbox slot (optional) */}
      {sandboxNode}

      <CopilotMessageList messages={messages} isStreaming={status === 'streaming'} />

      <CopilotQuickPrompts quickPrompts={quickPrompts} onSelect={setDraft} />

      <CopilotComposer
        draft={draft}
        disabled={!draft.trim() || status === 'streaming'}
        placeholder={inputPlaceholder}
        onChange={setDraft}
        onSubmit={submit}
      />
    </aside>
  );
}
