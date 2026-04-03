'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { MemoSection, Language, MemoSectionType } from '@/lib/types';
import {
  IconSparkles, IconArrowUp, IconCopy, IconRefresh, IconDownload,
  IconCheck, IconEdit, IconX, IconSave,
} from './Icons';

interface MemoEditorProps {
  sections: MemoSection[];
  language: Language;
  activeSection: MemoSectionType | null;
  onSectionUpdate: (sectionType: MemoSectionType, content: string) => void;
  onSectionClick: (sectionType: MemoSectionType) => void;
  onInlineFeedback: (sectionType: MemoSectionType, feedback: string) => void;
  onTextSelect: (text: string, sectionType: MemoSectionType, rect: DOMRect) => void;
  onSectionRetry?: (sectionType: MemoSectionType) => void;
  onSave?: () => void;
  isSaved?: boolean;
  completedAt?: number;
  retryingSections?: Set<MemoSectionType>;
  showToolbar?: boolean;
}

/* ---- Read-only section content ---- */
function SectionContent({ content, language }: { content: string; language: Language }) {
  return (
    <div
      className="memo-section-content"
      data-placeholder={language === 'zh' ? '等待 AI 生成内容...' : 'Waiting for AI to generate content...'}
    >
      {content}
    </div>
  );
}

/* ---- Editable textarea for a section ---- */
function SectionEditArea({
  content,
  language,
  sectionType,
  onSave,
  onCancel,
}: {
  content: string;
  language: Language;
  sectionType: MemoSectionType;
  onSave: (sectionType: MemoSectionType, content: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="section-edit-area">
      <textarea
        ref={textareaRef}
        className="section-edit-textarea"
        value={draft}
        onChange={handleInput}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      <div className="section-edit-actions">
        <button
          className="section-edit-btn section-edit-confirm"
          onClick={() => onSave(sectionType, draft)}
          title={language === 'zh' ? '保存' : 'Save'}
        >
          <IconCheck size={14} />
        </button>
        <button
          className="section-edit-btn section-edit-cancel"
          onClick={onCancel}
          title={language === 'zh' ? '取消' : 'Cancel'}
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---- Streaming content (contentEditable for live updates) ---- */
const StreamingSectionContent = memo(function StreamingSectionContent({
  content,
  language,
  sectionType,
  onSectionUpdate,
  onTextSelect,
}: {
  content: string;
  language: Language;
  sectionType: MemoSectionType;
  onSectionUpdate: (sectionType: MemoSectionType, content: string) => void;
  onTextSelect: (text: string, sectionType: MemoSectionType, rect: DOMRect) => void;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const syncedContentRef = useRef(content);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    if (document.activeElement === element) return;
    if (element.innerText !== content) {
      element.innerText = content;
    }
    syncedContentRef.current = content;
  }, [content]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.currentTarget.innerText;
      syncedContentRef.current = next;
      if (next !== content) onSectionUpdate(sectionType, next);
    },
    [content, onSectionUpdate, sectionType]
  );

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    syncedContentRef.current = e.currentTarget.innerText;
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    const range = sel.getRangeAt(0);
    onTextSelect(sel.toString(), sectionType, range.getBoundingClientRect());
  }, [onTextSelect, sectionType]);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el;
    if (el && el.innerText !== syncedContentRef.current) el.innerText = syncedContentRef.current;
  }, []);

  return (
    <div
      ref={setRef}
      className="memo-section-content"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={language === 'zh' ? '等待 AI 生成内容...' : 'Waiting for AI to generate content...'}
      onInput={handleInput}
      onBlur={handleBlur}
      onMouseUp={handleMouseUp}
    />
  );
}, (prev, next) =>
  prev.content === next.content && prev.language === next.language && prev.sectionType === next.sectionType
);

/* ---- Inline feedback ---- */
function InlineFeedbackInput({
  sectionType,
  language,
  onSubmit,
}: {
  sectionType: MemoSectionType;
  language: Language;
  onSubmit: (sectionType: MemoSectionType, feedback: string) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isZh = language === 'zh';

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(sectionType, value.trim());
    setValue('');
  };

  return (
    <div className="inline-feedback">
      <div className="inline-feedback-label">
        <IconSparkles size={13} />
        {isZh ? '对此段落的修改意见' : 'Revision feedback for this section'}
      </div>
      <div className="inline-feedback-input-row">
        <textarea
          ref={inputRef}
          className="inline-feedback-input"
          placeholder={isZh ? '例如：请加入更多数据支撑，语气更正式...' : 'e.g. Add more data, make the tone more formal...'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          rows={2}
        />
        <button className="inline-feedback-send" onClick={handleSubmit} disabled={!value.trim()}>
          <IconArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---- Copy button ---- */
function CopyButton({ text, language }: { text: string; language: Language }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="section-action-btn"
      onClick={async (e) => { e.stopPropagation(); await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      title={language === 'zh' ? '复制' : 'Copy'}
    >
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
    </button>
  );
}

/* ---- Full memo toolbar (Copy All / Download / Save) ---- */
function FullMemoToolbar({
  sections,
  language,
  onSave,
  isSaved,
}: {
  sections: MemoSection[];
  language: Language;
  onSave?: () => void;
  isSaved?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const isZh = language === 'zh';

  const getFullText = useCallback(() => {
    return sections
      .map((s) => `${language === 'zh' ? s.titleZh : s.title}\n\n${s.content}`)
      .join('\n\n---\n\n');
  }, [sections, language]);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(getFullText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const handleDownloadMd = () => {
    downloadFile(getFullText(), 'memo.md', 'text/markdown;charset=utf-8');
  };

  const handleDownloadDoc = () => {
    const htmlContent = sections
      .map((s) => {
        const title = language === 'zh' ? s.titleZh : s.title;
        const paragraphs = s.content.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
        return `<h2>${title}</h2>${paragraphs}`;
      })
      .join('<hr/>');
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Investment Memo</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7}h2{font-size:18px;margin-top:32px;border-bottom:1px solid #e5e5e5;padding-bottom:8px}p{margin:12px 0}hr{border:none;border-top:1px solid #e5e5e5;margin:32px 0}</style></head><body>${htmlContent}</body></html>`;
    downloadFile(fullHtml, 'memo.doc', 'application/msword;charset=utf-8');
  };

  const handleDownloadPdf = () => {
    const htmlContent = sections
      .map((s) => {
        const title = language === 'zh' ? s.titleZh : s.title;
        const paragraphs = s.content.split('\n\n').map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
        return `<h2>${title}</h2>${paragraphs}`;
      })
      .join('<hr/>');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Investment Memo</title><style>@media print{@page{margin:20mm}}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;line-height:1.7}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #e5e5e5;padding-bottom:6px}p{margin:10px 0;font-size:14px}hr{border:none;border-top:1px solid #eee;margin:24px 0}</style></head><body>${htmlContent}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
    setShowDownloadMenu(false);
  };

  const hasContent = sections.some((s) => s.content.trim());
  if (!hasContent) return null;

  return (
    <div className="memo-toolbar">
      {onSave && (
        <button
          className="memo-toolbar-btn memo-toolbar-btn-primary"
          onClick={onSave}
          disabled={isSaved}
        >
          <IconSave size={14} />
          {isSaved
            ? (isZh ? '已保存' : 'Saved')
            : (isZh ? '保存到项目库' : 'Save to Library')}
        </button>
      )}
      <button className="memo-toolbar-btn" onClick={handleCopyAll}>
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制全文' : 'Copy All')}
      </button>
      <div className="memo-toolbar-dropdown-wrapper">
        <button className="memo-toolbar-btn" onClick={() => setShowDownloadMenu(!showDownloadMenu)}>
          <IconDownload size={14} />
          {isZh ? '下载' : 'Download'}
        </button>
        {showDownloadMenu && (
          <div className="memo-toolbar-dropdown" onMouseLeave={() => setShowDownloadMenu(false)}>
            <button className="memo-toolbar-dropdown-item" onClick={handleDownloadMd}>Markdown (.md)</button>
            <button className="memo-toolbar-dropdown-item" onClick={handleDownloadDoc}>Word (.doc)</button>
            <button className="memo-toolbar-dropdown-item" onClick={handleDownloadPdf}>PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Main MemoEditor ============ */
export default function MemoEditor({
  sections,
  language,
  activeSection,
  onSectionUpdate,
  onSectionClick,
  onInlineFeedback,
  onTextSelect,
  onSectionRetry,
  onSave,
  isSaved,
  retryingSections,
  showToolbar = true,
}: MemoEditorProps) {
  const isZh = language === 'zh';
  const [editingSection, setEditingSection] = useState<MemoSectionType | null>(null);

  const getStatusLabel = (status: MemoSection['status']): string => {
    const labels: Record<MemoSection['status'], { en: string; zh: string }> = {
      pending: { en: 'Pending', zh: '待生成' },
      generating: { en: 'Generating...', zh: '生成中...' },
      generated: { en: 'Generated', zh: '已生成' },
      refined: { en: 'Refined', zh: '已优化' },
      confirmed: { en: 'Confirmed', zh: '已确认' },
    };
    return isZh ? labels[status].zh : labels[status].en;
  };

  const getStatusClass = (status: MemoSection['status']): string => {
    if (status === 'generating') return 'generating';
    if (status === 'pending') return 'pending';
    return 'generated';
  };

  const handleEditSave = useCallback((sectionType: MemoSectionType, content: string) => {
    onSectionUpdate(sectionType, content);
    setEditingSection(null);
  }, [onSectionUpdate]);

  const handleEditCancel = useCallback(() => {
    setEditingSection(null);
  }, []);

  return (
    <div className="editor-content">
      {showToolbar && (
        <FullMemoToolbar
          sections={sections}
          language={language}
          onSave={onSave}
          isSaved={isSaved}
        />
      )}
      <div className="editor-scroll-container">
        {sections.map((section) => {
          const isActive = activeSection === section.type;
          const isRetrying = retryingSections?.has(section.type);
          const isEditing = editingSection === section.type;
          const isStreaming = section.status === 'generating';

          return (
            <div
              key={section.type}
              className={`memo-section ${isActive ? 'memo-section-active' : ''} ${isEditing ? 'memo-section-editing' : ''}`}
              id={`section-${section.type}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('.inline-feedback')) return;
                if ((e.target as HTMLElement).closest('.section-action-btn')) return;
                if ((e.target as HTMLElement).closest('.section-edit-area')) return;
                if (isEditing) return;
                onSectionClick(section.type);
              }}
            >
              <div className="memo-section-header">
                <h2 className="memo-section-title">
                  {isZh ? section.titleZh : section.title}
                </h2>
                <div className="memo-section-header-right">
                  {section.content.trim() && !isEditing && (
                    <div className="section-actions">
                      <button
                        className="section-action-btn"
                        onClick={(e) => { e.stopPropagation(); setEditingSection(section.type); }}
                        title={isZh ? '编辑' : 'Edit'}
                      >
                        <IconEdit size={13} />
                      </button>
                      <CopyButton text={section.content} language={language} />
                      {onSectionRetry && (
                        <button
                          className="section-action-btn"
                          onClick={(e) => { e.stopPropagation(); onSectionRetry(section.type); }}
                          disabled={isRetrying}
                          title={isZh ? '重新生成' : 'Regenerate'}
                        >
                          <IconRefresh size={13} className={isRetrying ? 'spin' : ''} />
                        </button>
                      )}
                    </div>
                  )}
                  <span className={`memo-section-status ${getStatusClass(section.status)}`}>
                    {getStatusLabel(section.status)}
                  </span>
                </div>
              </div>

              {isEditing ? (
                <SectionEditArea
                  content={section.content}
                  language={language}
                  sectionType={section.type}
                  onSave={handleEditSave}
                  onCancel={handleEditCancel}
                />
              ) : isStreaming ? (
                <StreamingSectionContent
                  content={section.content}
                  language={language}
                  sectionType={section.type}
                  onSectionUpdate={onSectionUpdate}
                  onTextSelect={onTextSelect}
                />
              ) : (
                <SectionContent content={section.content} language={language} />
              )}

              {isActive && section.content && !isEditing && (
                <InlineFeedbackInput
                  sectionType={section.type}
                  language={language}
                  onSubmit={onInlineFeedback}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
