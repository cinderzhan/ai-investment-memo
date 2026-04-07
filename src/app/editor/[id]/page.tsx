'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { MemoSectionType } from '@/lib/types';
import { getSystemPrompt, getSectionPrompt, getSectionPreFillPrompt } from '@/lib/prompts';
import { MEMO_SECTIONS } from '@/lib/constants';
import { IconLoader, IconCheck } from '@/components/Icons';

const MAX_CONCURRENT = 3;

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}
import Header from '@/components/Header';
import MemoEditor from '@/components/MemoEditor';
import ChatPanel, { ChatPanelHandle } from '@/components/ChatPanel';
import SectionNav from '@/components/SectionNav';
import FloatingToolbar from '@/components/FloatingToolbar';
import QuestionnairePanel from '@/components/QuestionnairePanel';

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const {
    projects,
    setCurrentProject,
    updateSectionContent,
    updateSectionStatus,
    updateProjectStage,
    updateQuestionAnswer,
    bulkUpdateQuestionnaire,
    addChatMessage,
    completeProject,
    loadFromStorage,
  } = useProjectStore();
  const {
    language,
    defaultModel,
    providers,
    customModels,
    promptOverrides,
    getPromptOverride,
    setDefaultModel,
    loadFromStorage: loadSettings,
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState<MemoSectionType | null>(null);
  const [floatingAction, setFloatingAction] = useState<{ text: string; action: string; sectionType: MemoSectionType } | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedSection, setSelectedSection] = useState<MemoSectionType | null>(null);
  const [isPreFilling, setIsPreFilling] = useState(false);
  const [preFillingSections, setPreFillingSections] = useState<Set<MemoSectionType>>(new Set());
  const [generatingSections, setGeneratingSections] = useState<Set<MemoSectionType>>(new Set());
  const [retryingSections, setRetryingSections] = useState<Set<MemoSectionType>>(new Set());

  const chatPanelRef = useRef<ChatPanelHandle>(null);
  const hasStartedPreFill = useRef(false);

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
    loadSettings();
  }, [loadFromStorage, loadSettings]);

  // Set current project
  useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );

  const isZh = language === 'zh';

  // Build available models list
  const availableModels = useMemo(() => {
    return useSettingsStore.getState().getAvailableModels();
  }, [providers, customModels]);

  // Resolve active model's API credentials
  const getModelCredentials = useCallback(() => {
    const availModels = useSettingsStore.getState().getAvailableModels();
    const activeModel = availModels.find(
      (m) => m.provider === defaultModel.provider && m.model === defaultModel.model
    ) || availModels[0];

    return {
      apiKey: activeModel?.apiKey || providers[defaultModel.provider]?.apiKey || '',
      baseUrl: activeModel?.baseUrl || providers[defaultModel.provider]?.baseUrl || '',
      provider: defaultModel.provider,
      model: defaultModel.model,
    };
  }, [defaultModel, providers]);

  // Helper: call LLM with timeout and accumulate full streamed response
  const callLLM = useCallback(async (
    creds: { provider: string; model: string; apiKey: string; baseUrl: string },
    prompt: string,
    timeoutMs = 120_000,
  ): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: creds.provider,
          model: creds.model,
          apiKey: creds.apiKey,
          baseUrl: creds.baseUrl,
          messages: [
            { role: 'system', content: getSystemPrompt(language) },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText.slice(0, 300)}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              fullContent += delta;
            } catch { /* partial JSON */ }
          }
        }
      }

      return fullContent.trim();
    } finally {
      clearTimeout(timer);
    }
  }, [language]);

  // ============ STEP 1: Pre-fill questionnaire — 8 sections in parallel ============
  const preFillQuestionnaire = useCallback(async () => {
    if (!project || !project.uploadedFiles.length || !project.questionnaire) return;
    if (hasStartedPreFill.current) return;
    hasStartedPreFill.current = true;

    setIsPreFilling(true);

    const fileContents = project.uploadedFiles.map((f) => {
      const c = f.content || '';
      console.log(`[pre-fill] file="${f.name}" category=${f.category || 'none'} contentLen=${c.length}`);
      return c;
    });

    let extractedInfo = fileContents.filter(Boolean).join('\n\n---\n\n');

    if (extractedInfo.length > 120000) {
      extractedInfo = extractedInfo.slice(0, 120000) + '\n\n[...Content truncated due to size limit...]';
    }

    if (!extractedInfo.trim() || extractedInfo.startsWith('[File:')) {
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh
          ? '上传的文件中没有提取到文本内容，无法自动填写。请手动填写问卷。'
          : 'No text content extracted from uploads. Cannot auto-fill. Please fill in manually.',
      });
      setIsPreFilling(false);
      hasStartedPreFill.current = false;
      return;
    }

    console.log(`[pre-fill] total extractedInfo length: ${extractedInfo.length}`);

    const creds = getModelCredentials();
    if (!creds.apiKey) {
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh
          ? '请先在设置中配置 API Key，AI 才能自动解析文件内容。'
          : 'Please configure an API Key in Settings so AI can parse your files.',
      });
      setIsPreFilling(false);
      hasStartedPreFill.current = false;
      return;
    }

    const sectionTitleMap = Object.fromEntries(
      MEMO_SECTIONS.map((s) => [s.type, { en: s.title, zh: s.titleZh }])
    );

    addChatMessage({
      projectId,
      role: 'assistant',
      content: isZh
        ? '🔍 开始分析上传的文档，为您自动填写问卷...'
        : '🔍 Starting to analyze your documents to auto-fill the questionnaire...',
    });

    // Parse JSON answers from LLM response, tolerating extra text / code blocks
    const parseJsonAnswers = (text: string): Record<string, string> => {
      try {
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const result: Record<string, string> = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string' && value.trim() && value.toLowerCase() !== 'n/a') {
              result[key] = value;
            }
          }
          return result;
        }
      } catch { /* ignore parse errors */ }
      return {};
    };

    let totalFilled = 0;
    let totalQuestions = 0;
    let errorCount = 0;

    // Process sections with concurrency limit to avoid API rate-limiting
    const sectionTasks = project.questionnaire.map((sq) => async () => {
      const sectionTitle = isZh
        ? sectionTitleMap[sq.sectionType]?.zh
        : sectionTitleMap[sq.sectionType]?.en;

      setPreFillingSections((prev) => new Set(prev).add(sq.sectionType));
      totalQuestions += sq.questions.length;

      try {
        const prompt = getSectionPreFillPrompt(
          language,
          extractedInfo,
          sectionTitle || sq.sectionType,
          sq.questions.map((q) => ({ id: q.id, question: q.question, questionZh: q.questionZh })),
        );

        const response = await callLLM(creds, prompt);
        const answers = parseJsonAnswers(response);
        const filledCount = Object.keys(answers).length;

        if (filledCount > 0) {
          bulkUpdateQuestionnaire(projectId, answers);
          totalFilled += filledCount;

          // Show extracted Q&A in chat
          const qaPairs = sq.questions
            .filter((q) => answers[q.id])
            .map((q) => `Q: ${isZh ? q.questionZh : q.question}\nA: ${answers[q.id]}`)
            .join('\n\n');
          addChatMessage({
            projectId,
            role: 'assistant',
            content: `📋 ${sectionTitle} (${filledCount}/${sq.questions.length})\n\n${qaPairs}`,
          });
        } else {
          addChatMessage({
            projectId,
            role: 'assistant',
            content: isZh
              ? `ℹ️ ${sectionTitle}: 文档中未找到相关信息`
              : `ℹ️ ${sectionTitle}: No relevant info found in documents`,
          });
        }
      } catch (err) {
        errorCount++;
        const isTimeout = err instanceof DOMException && err.name === 'AbortError';
        const errMsg = isTimeout
          ? (isZh ? '请求超时' : 'Request timeout')
          : (err instanceof Error ? err.message.slice(0, 200) : 'Unknown error');
        addChatMessage({
          projectId,
          role: 'assistant',
          content: isZh
            ? `⚠️ ${sectionTitle} 解析失败: ${errMsg}`
            : `⚠️ ${sectionTitle} analysis failed: ${errMsg}`,
        });
      } finally {
        setPreFillingSections((prev) => {
          const next = new Set(prev);
          next.delete(sq.sectionType);
          return next;
        });
      }
    });

    await runWithConcurrency(sectionTasks, MAX_CONCURRENT);

    // Summary message
    addChatMessage({
      projectId,
      role: 'assistant',
      content: isZh
        ? `✅ 文档分析完成！共填写了 ${totalFilled}/${totalQuestions} 个问题${errorCount > 0 ? `，${errorCount} 个章节解析失败` : ''}。\n\n请检查并补充遗漏的信息，然后点击「确认信息，开始生成 MEMO」。`
        : `✅ Analysis complete! Filled ${totalFilled}/${totalQuestions} questions${errorCount > 0 ? `, ${errorCount} sections failed` : ''}.\n\nPlease review and supplement any missing info, then click "Confirm & Generate MEMO".`,
    });

    setIsPreFilling(false);
  }, [project, projectId, language, isZh, getModelCredentials, addChatMessage, bulkUpdateQuestionnaire, callLLM]);

  // Auto pre-fill when entering reviewing stage
  useEffect(() => {
    if (project?.stage === 'reviewing' && project.uploadedFiles.length > 0 && !hasStartedPreFill.current) {
      preFillQuestionnaire();
    }
  }, [project?.stage, project?.uploadedFiles.length, preFillQuestionnaire]);

  // Retry pre-fill for a single questionnaire section
  const handleSectionPreFillRetry = useCallback(async (sectionType: MemoSectionType) => {
    if (!project || !project.questionnaire) return;

    const creds = getModelCredentials();
    if (!creds.apiKey) {
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh ? '请先在设置中配置 API Key。' : 'Please configure an API Key in Settings first.',
      });
      return;
    }

    let extractedInfo = project.uploadedFiles
      .map((f) => f.content || '')
      .filter(Boolean)
      .join('\n\n---\n\n');
    if (extractedInfo.length > 120000) {
      extractedInfo = extractedInfo.slice(0, 120000) + '\n\n[...truncated...]';
    }
    if (!extractedInfo.trim()) return;

    const sq = project.questionnaire.find((q) => q.sectionType === sectionType);
    if (!sq) return;

    const sectionTitleMap = Object.fromEntries(
      MEMO_SECTIONS.map((s) => [s.type, { en: s.title, zh: s.titleZh }])
    );
    const sectionTitle = isZh
      ? sectionTitleMap[sectionType]?.zh
      : sectionTitleMap[sectionType]?.en;

    setPreFillingSections((prev) => new Set(prev).add(sectionType));

    const parseJsonAnswers = (text: string): Record<string, string> => {
      try {
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const result: Record<string, string> = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string' && value.trim() && value.toLowerCase() !== 'n/a') {
              result[key] = value;
            }
          }
          return result;
        }
      } catch { /* ignore */ }
      return {};
    };

    try {
      const prompt = getSectionPreFillPrompt(
        language,
        extractedInfo,
        sectionTitle || sectionType,
        sq.questions.map((q) => ({ id: q.id, question: q.question, questionZh: q.questionZh })),
      );
      const response = await callLLM(creds, prompt);
      const answers = parseJsonAnswers(response);
      const filledCount = Object.keys(answers).length;

      if (filledCount > 0) {
        bulkUpdateQuestionnaire(projectId, answers);
        const qaPairs = sq.questions
          .filter((q) => answers[q.id])
          .map((q) => `Q: ${isZh ? q.questionZh : q.question}\nA: ${answers[q.id]}`)
          .join('\n\n');
        addChatMessage({
          projectId,
          role: 'assistant',
          content: `🔄 ${sectionTitle} (${filledCount}/${sq.questions.length})\n\n${qaPairs}`,
        });
      } else {
        addChatMessage({
          projectId,
          role: 'assistant',
          content: isZh
            ? `ℹ️ ${sectionTitle}: 文档中未找到相关信息`
            : `ℹ️ ${sectionTitle}: No relevant info found in documents`,
        });
      }
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errMsg = isTimeout
        ? (isZh ? '请求超时' : 'Request timeout')
        : (err instanceof Error ? err.message.slice(0, 200) : 'Unknown error');
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh
          ? `⚠️ ${sectionTitle} 重试失败: ${errMsg}`
          : `⚠️ ${sectionTitle} retry failed: ${errMsg}`,
      });
    } finally {
      setPreFillingSections((prev) => {
        const next = new Set(prev);
        next.delete(sectionType);
        return next;
      });
    }
  }, [project, projectId, language, isZh, getModelCredentials, addChatMessage, bulkUpdateQuestionnaire, callLLM]);

  // ============ STEP 2: Generate all sections in parallel ============
  const generateAllSections = useCallback(async () => {
    if (!project || !project.questionnaire) return;

    updateProjectStage(projectId, 'generating');

    const creds = getModelCredentials();
    if (!creds.apiKey) {
      addChatMessage({
        projectId,
        role: 'assistant',
        content: isZh ? '请先在设置中配置 API Key。' : 'Please configure your API Key in Settings first.',
      });
      return;
    }

    let extractedInfo = project.uploadedFiles
      .map((f) => f.content || '')
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (extractedInfo.length > 120000) {
      extractedInfo = extractedInfo.slice(0, 120000) + '\n\n[...Content truncated due to size limit...]';
    }

    // Mark all sections as generating and launch them in parallel
    const allTypes = MEMO_SECTIONS.map((s) => s.type);
    setGeneratingSections(new Set(allTypes));
    for (const t of allTypes) updateSectionStatus(projectId, t, 'generating');

    const genTasks = MEMO_SECTIONS.map((sectionDef) => async () => {
      const sq = project.questionnaire!.find((q) => q.sectionType === sectionDef.type);
      if (!sq) return;

      const questionnaireAnswers = sq.questions
        .filter((q) => q.answer.trim())
        .map((q) => ({
          question: language === 'zh' ? q.questionZh : q.question,
          answer: q.answer,
        }));

      const overridePrompt = getPromptOverride(sectionDef.type, language);

      const sectionPrompt = getSectionPrompt(
        sectionDef.type,
        language,
        {
          companyName: project.companyName,
          industry: project.industry,
          questionnaireAnswers,
          extractedInfo: extractedInfo || undefined,
        },
        overridePrompt
      );

      const genController = new AbortController();
      const genTimer = setTimeout(() => genController.abort(), 120_000);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: creds.provider,
            model: creds.model,
            apiKey: creds.apiKey,
            baseUrl: creds.baseUrl,
            messages: [
              { role: 'system', content: getSystemPrompt(language) },
              { role: 'user', content: sectionPrompt },
            ],
          }),
          signal: genController.signal,
        });

        if (!res.ok) throw new Error(await res.text());

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No stream');
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                fullContent += delta;
                updateSectionContent(projectId, sectionDef.type, fullContent);
              } catch { /* partial JSON */ }
            }
          }
        }

        updateSectionStatus(projectId, sectionDef.type, 'generated');
      } catch (err) {
        const errMsg = err instanceof Error
          ? (err.name === 'AbortError' ? (isZh ? '请求超时' : 'Request timed out') : err.message)
          : 'Unknown error';
        updateSectionContent(projectId, sectionDef.type, isZh ? `生成失败: ${errMsg}` : `Error generating: ${errMsg}`);
        updateSectionStatus(projectId, sectionDef.type, 'generated');
      } finally {
        clearTimeout(genTimer);
        setGeneratingSections((prev) => {
          const next = new Set(prev);
          next.delete(sectionDef.type);
          return next;
        });
      }
    });

    await runWithConcurrency(genTasks, MAX_CONCURRENT);
    setGeneratingSections(new Set());
    updateProjectStage(projectId, 'editing');
  }, [project, projectId, language, isZh, getModelCredentials, updateProjectStage, updateSectionContent, updateSectionStatus, addChatMessage, getPromptOverride]);

  // ============ Editor handlers ============
  const handleSectionClick = useCallback((sectionType: MemoSectionType) => {
    setActiveSection((prev) => (prev === sectionType ? null : sectionType));
    setToolbarPos(null);
  }, []);

  const handleInlineFeedback = useCallback((sectionType: MemoSectionType, feedback: string) => {
    chatPanelRef.current?.sendMessageFromEditor(feedback, sectionType);
  }, []);

  const handleSectionUpdate = useCallback((sectionType: MemoSectionType, content: string) => {
    updateSectionContent(projectId, sectionType, content);
  }, [projectId, updateSectionContent]);

  const handleTextSelect = useCallback((text: string, sectionType: MemoSectionType, rect: DOMRect) => {
    setSelectedText(text);
    setSelectedSection(sectionType);
    setToolbarPos({ top: rect.top - 48, left: rect.left + rect.width / 2 });
  }, []);

  const handleFloatingAction = useCallback((action: string) => {
    if (selectedText && selectedSection) {
      setFloatingAction({ text: selectedText, action, sectionType: selectedSection });
    }
    setToolbarPos(null);
  }, [selectedText, selectedSection]);

  const handleApplyToSection = useCallback((sectionType: MemoSectionType, content: string) => {
    updateSectionContent(projectId, sectionType, content);
    updateSectionStatus(projectId, sectionType, 'refined');
  }, [projectId, updateSectionContent, updateSectionStatus]);

  const handleQuestionAnswerChange = useCallback((sectionType: MemoSectionType, questionId: string, answer: string) => {
    updateQuestionAnswer(projectId, sectionType, questionId, answer);
  }, [projectId, updateQuestionAnswer]);

  // Regenerate a single section
  const handleSectionRetry = useCallback(async (sectionType: MemoSectionType) => {
    if (!project || !project.questionnaire) return;

    const creds = getModelCredentials();
    if (!creds.apiKey) return;

    setRetryingSections((prev) => new Set(prev).add(sectionType));
    updateSectionStatus(projectId, sectionType, 'generating');

    let extractedInfo = project.uploadedFiles
      .map((f) => f.content || '')
      .filter(Boolean)
      .join('\n\n---\n\n');
    if (extractedInfo.length > 120000) {
      extractedInfo = extractedInfo.slice(0, 120000) + '\n\n[...truncated...]';
    }

    const sq = project.questionnaire.find((q) => q.sectionType === sectionType);
    const questionnaireAnswers = (sq?.questions || [])
      .filter((q) => q.answer.trim())
      .map((q) => ({ question: language === 'zh' ? q.questionZh : q.question, answer: q.answer }));

    const overridePrompt = getPromptOverride(sectionType, language);
    const sectionPrompt = getSectionPrompt(sectionType, language, {
      companyName: project.companyName,
      industry: project.industry,
      questionnaireAnswers,
      extractedInfo: extractedInfo || undefined,
    }, overridePrompt);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: creds.provider, model: creds.model,
          apiKey: creds.apiKey, baseUrl: creds.baseUrl,
          messages: [
            { role: 'system', content: getSystemPrompt(language) },
            { role: 'user', content: sectionPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content || '';
              fullContent += delta;
              updateSectionContent(projectId, sectionType, fullContent);
            } catch { /* partial */ }
          }
        }
      }
      updateSectionStatus(projectId, sectionType, 'generated');
    } catch (err) {
      const errMsg = err instanceof Error
        ? (err.name === 'AbortError' ? (isZh ? '请求超时' : 'Timeout') : err.message)
        : 'Unknown error';
      updateSectionContent(projectId, sectionType, isZh ? `生成失败: ${errMsg}` : `Error: ${errMsg}`);
      updateSectionStatus(projectId, sectionType, 'generated');
    } finally {
      clearTimeout(timer);
      setRetryingSections((prev) => { const n = new Set(prev); n.delete(sectionType); return n; });
    }
  }, [project, projectId, language, isZh, getModelCredentials, updateSectionContent, updateSectionStatus, getPromptOverride]);

  const handleSaveProject = useCallback(() => {
    completeProject(projectId);
    updateProjectStage(projectId, 'completed');
  }, [projectId, completeProject, updateProjectStage]);

  // Clear selection on click outside
  useEffect(() => {
    const handleClick = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setToolbarPos(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <IconLoader size={24} />
      </div>
    );
  }

  const isReviewing = project.stage === 'reviewing';
  const isGenerating = project.stage === 'generating';
  const isEditing = project.stage === 'editing' || project.stage === 'completed';

  return (
    <div className="editor-page">
      <Header
        projectName={project.companyName}
        showModelSelector={true}
      />

      {/* Step indicator */}
      <div className="step-indicator">
        <div className="step done">
          <span className="step-number"><IconCheck size={12} /></span>
          <span className="step-label">{isZh ? '上传' : 'Upload'}</span>
        </div>
        <div className="step-divider" />
        <div
          className={`step clickable ${isReviewing ? 'active' : (isGenerating || isEditing) ? 'done' : ''}`}
          onClick={() => updateProjectStage(projectId, 'reviewing')}
        >
          <span className="step-number">{(isGenerating || isEditing) ? <IconCheck size={12} /> : '2'}</span>
          <span className="step-label">{isZh ? '信息采集' : 'Info Gathering'}</span>
        </div>
        <div className="step-divider" />
        <div
          className={`step clickable ${(isGenerating || isEditing) ? 'active' : ''}`}
          onClick={() => {
            if (isReviewing) {
              generateAllSections();
            } else if (!isGenerating && !isEditing) {
              updateProjectStage(projectId, 'generating');
            }
          }}
        >
          <span className="step-number">3</span>
          <span className="step-label">{isZh ? '生成 MEMO' : 'Generate MEMO'}</span>
        </div>
      </div>

      <div className="editor-layout">
        {/* ============ STEP 1: Questionnaire ============ */}
        {isReviewing && project.questionnaire && (
          <>
            <SectionNav
              language={language}
              questionnaire={project.questionnaire}
              preFillingSections={preFillingSections}
            />
            <div className="editor-main">
              <div className="editor-topbar">
                <span className="editor-topbar-note">
                  {isZh ? '所有问题均为非必填项' : 'All questions are optional'}
                </span>
                <button
                  className="btn btn-primary editor-topbar-action"
                  onClick={generateAllSections}
                  disabled={isPreFilling}
                >
                  {isPreFilling
                    ? (isZh ? 'AI 正在解析...' : 'AI parsing...')
                    : (isZh ? '下一步：生成 MEMO' : 'Next: Generate MEMO')}
                </button>
              </div>
              <QuestionnairePanel
                questionnaire={project.questionnaire}
                language={language}
                onAnswerChange={handleQuestionAnswerChange}
                isPreFilling={isPreFilling}
                preFillingSections={preFillingSections}
                onSectionRetry={handleSectionPreFillRetry}
              />
            </div>

            <ChatPanel
              ref={chatPanelRef}
              projectId={projectId}
              language={language}
              floatingAction={null}
              onClearFloatingAction={() => {}}
              onApplyToSection={handleApplyToSection}
            />
          </>
        )}

        {/* ============ STEP 2: Generating (showing editor) ============ */}
        {isGenerating && project.memo && (
          <>
            <SectionNav
              language={language}
              sections={project.memo.sections}
              generatingSections={generatingSections}
              activeSectionType={activeSection}
              onSectionClick={handleSectionClick}
            />
            <div className="editor-main">
              <MemoEditor
                sections={project.memo.sections}
                language={language}
                activeSection={activeSection}
                onSectionUpdate={handleSectionUpdate}
                onSectionClick={handleSectionClick}
                onInlineFeedback={handleInlineFeedback}
                onTextSelect={handleTextSelect}
                onSectionRetry={handleSectionRetry}
                retryingSections={retryingSections}
                showToolbar={false}
              />
            </div>

            <ChatPanel
              ref={chatPanelRef}
              projectId={projectId}
              language={language}
              floatingAction={floatingAction}
              onClearFloatingAction={() => setFloatingAction(null)}
              onApplyToSection={handleApplyToSection}
            />
          </>
        )}

        {/* ============ STEP 3: Editing ============ */}
        {isEditing && project.memo && (
          <>
            <SectionNav
              language={language}
              sections={project.memo.sections}
              activeSectionType={activeSection}
              onSectionClick={handleSectionClick}
            />
            <div className="editor-main">
              <MemoEditor
                sections={project.memo.sections}
                language={language}
                activeSection={activeSection}
                onSectionUpdate={handleSectionUpdate}
                onSectionClick={handleSectionClick}
                onInlineFeedback={handleInlineFeedback}
                onTextSelect={handleTextSelect}
                onSectionRetry={handleSectionRetry}
                retryingSections={retryingSections}
                onSave={handleSaveProject}
                isSaved={project.stage === 'completed'}
              />
            </div>

            <ChatPanel
              ref={chatPanelRef}
              projectId={projectId}
              language={language}
              floatingAction={floatingAction}
              onClearFloatingAction={() => setFloatingAction(null)}
              onApplyToSection={handleApplyToSection}
            />
          </>
        )}
      </div>

      {/* Floating toolbar for text selection */}
      {toolbarPos && (
        <FloatingToolbar
          position={toolbarPos}
          language={language}
          onAction={handleFloatingAction}
          onClose={() => setToolbarPos(null)}
        />
      )}
    </div>
  );
}
