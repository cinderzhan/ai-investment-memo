'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChatMessage, Language, MemoSectionType } from '@/lib/types';
import { useProjectStore } from '@/lib/projectStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { getRefinePrompt, getSystemPrompt } from '@/lib/prompts';
import { MEMO_SECTIONS } from '@/lib/constants';
import { IconMessageSquare, IconBot, IconUser, IconArrowUp, IconCheck, IconRefresh } from './Icons';

export interface ChatPanelHandle {
  sendMessageFromEditor: (text: string, sectionType: MemoSectionType) => void;
  sendRawMessage: (text: string) => void;
}

interface ChatPanelProps {
  projectId: string;
  language: Language;
  floatingAction: { text: string; action: string; sectionType: MemoSectionType } | null;
  onClearFloatingAction: () => void;
  onApplyToSection: (sectionType: MemoSectionType, content: string) => void;
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({
  projectId,
  language,
  floatingAction,
  onClearFloatingAction,
  onApplyToSection,
}, ref) {
  const isZh = language === 'zh';
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSectionRef, setStreamingSectionRef] = useState<MemoSectionType | undefined>();
  const [appliedMessages, setAppliedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handledFloatingActionRef = useRef<string | null>(null);

  const chatMessages = useProjectStore((state) => state.chatMessages);
  const projects = useProjectStore((state) => state.projects);
  const addChatMessage = useProjectStore((state) => state.addChatMessage);
  const defaultModel = useSettingsStore((state) => state.defaultModel);
  const providers = useSettingsStore((state) => state.providers);

  const messages = chatMessages.filter((message: ChatMessage) => message.projectId === projectId);
  const project = projects.find((item) => item.id === projectId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const callAI = useCallback(async (messagesPayload: { role: string; content: string }[], sectionType?: MemoSectionType) => {
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingSectionRef(sectionType);

    const availModels = useSettingsStore.getState().getAvailableModels();
    const activeModel = availModels.find(
      (m) => m.provider === defaultModel.provider && m.model === defaultModel.model
    ) || availModels[0];

    const apiKey = activeModel?.apiKey || providers[defaultModel.provider]?.apiKey;
    const baseUrl = activeModel?.baseUrl || providers[defaultModel.provider]?.baseUrl;

    if (!apiKey) {
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh ? '请先在设置中配置 API Key' : 'Please configure your API Key in Settings first.',
      });
      setIsStreaming(false);
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: defaultModel.provider,
          model: defaultModel.model,
          apiKey,
          baseUrl,
          messages: messagesPayload,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || res.statusText);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              fullContent += delta;
              setStreamingContent(fullContent);
            } catch {
              // might be partial JSON, skip
            }
          }
        }
      }

      addChatMessage({
        projectId,
        role: 'assistant',
        content: fullContent,
        sectionRef: sectionType,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh ? `生成失败: ${errMsg}` : `Generation failed: ${errMsg}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingSectionRef(undefined);
    }
  }, [project, projectId, defaultModel, providers, addChatMessage, isZh]);

  const sendMessage = useCallback(async (text: string, sectionType?: MemoSectionType) => {
    if (!text.trim() || isStreaming) return;

    addChatMessage({
      projectId,
      role: 'user',
      content: text,
      sectionRef: sectionType,
    });

    const systemPrompt = getSystemPrompt(language);
    const section = project?.memo?.sections.find((s) => s.type === sectionType);
    let userPrompt = text;

    if (sectionType && section?.content) {
      userPrompt = getRefinePrompt(sectionType, section.content, text, language);
    }

    await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      sectionType
    );
  }, [projectId, language, project, callAI, addChatMessage, isStreaming]);

  // Send a raw message (no section context, no refine prompt wrapping)
  const sendRawMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    addChatMessage({
      projectId,
      role: 'assistant',
      content: text,
    });
  }, [projectId, addChatMessage, isStreaming]);

  useImperativeHandle(ref, () => ({
    sendMessageFromEditor: (text: string, sectionType: MemoSectionType) => {
      void sendMessage(text, sectionType);
    },
    sendRawMessage: (text: string) => {
      sendRawMessage(text);
    },
  }), [sendMessage, sendRawMessage]);

  useEffect(() => {
    if (!floatingAction) {
      handledFloatingActionRef.current = null;
      return;
    }

    const actionKey = JSON.stringify(floatingAction);
    if (handledFloatingActionRef.current === actionKey) return;
    handledFloatingActionRef.current = actionKey;

    const prompt = isZh
      ? `请对以下选中文本执行"${floatingAction.action}"操作：\n\n"${floatingAction.text}"`
      : `Please "${floatingAction.action}" the following selected text:\n\n"${floatingAction.text}"`;

    void sendMessage(prompt, floatingAction.sectionType);
    onClearFloatingAction();
  }, [floatingAction, isZh, onClearFloatingAction, sendMessage]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = (msg: ChatMessage) => {
    if (!msg.sectionRef || !msg.content) return;
    onApplyToSection(msg.sectionRef, msg.content);
    setAppliedMessages((prev) => new Set(prev).add(msg.id));
  };

  // Section title map for display
  const sectionTitleMap = Object.fromEntries(
    MEMO_SECTIONS.map((s) => [s.type, { en: s.title, zh: s.titleZh }])
  );

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-title">
          <IconMessageSquare size={16} />
          {isZh ? 'AI 助手' : 'AI Assistant'}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isStreaming && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--fg-subtle)', fontSize: 14, lineHeight: 1.8 }}>
            {isZh
              ? '点击左侧文档中的段落输入修改意见，\n或直接在下方输入开始对话'
              : 'Click a section in the document to give feedback,\nor type below to start a conversation'}
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <div key={msg.id} className="chat-message">
            <div className={`chat-avatar ${msg.role}`}>
              {msg.role === 'assistant' ? <IconBot size={14} /> : <IconUser size={14} />}
            </div>
            <div className="chat-bubble">
              <div className="chat-bubble-name">
                {msg.role === 'assistant' ? 'AI' : (isZh ? '你' : 'You')}
                {msg.sectionRef && sectionTitleMap[msg.sectionRef] && (
                  <span className="chat-section-tag">
                    {isZh ? sectionTitleMap[msg.sectionRef].zh : sectionTitleMap[msg.sectionRef].en}
                  </span>
                )}
              </div>
              <div className="chat-bubble-content">{msg.content}</div>
              {msg.role === 'assistant' && msg.sectionRef && msg.content && (
                <div className="chat-apply-actions">
                  {appliedMessages.has(msg.id) ? (
                    <span className="chat-applied-label">
                      <IconCheck size={13} />
                      {isZh ? '已替换' : 'Applied'}
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary chat-apply-btn"
                      onClick={() => handleApply(msg)}
                    >
                      <IconRefresh size={13} />
                      {isZh ? '替换到原文' : 'Replace in document'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="chat-message">
            <div className="chat-avatar assistant"><IconBot size={14} /></div>
            <div className="chat-bubble">
              <div className="chat-bubble-name">
                AI
                {streamingSectionRef && sectionTitleMap[streamingSectionRef] && (
                  <span className="chat-section-tag">
                    {isZh ? sectionTitleMap[streamingSectionRef].zh : sectionTitleMap[streamingSectionRef].en}
                  </span>
                )}
              </div>
              <div className="chat-bubble-content">{streamingContent}</div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="chat-message">
            <div className="chat-avatar assistant"><IconBot size={14} /></div>
            <div className="chat-bubble">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={isZh ? '输入消息...' : 'Type a message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <IconArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatPanel;
