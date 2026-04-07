'use client';

import { useState, useCallback } from 'react';
import { SectionQuestionnaire, Language, MemoSectionType } from '@/lib/types';
import { MEMO_SECTIONS } from '@/lib/constants';
import { IconChevronDown, IconSparkles, IconLoader, IconRefresh } from './Icons';

interface QuestionnairePanelProps {
  questionnaire: SectionQuestionnaire[];
  language: Language;
  onAnswerChange: (sectionType: MemoSectionType, questionId: string, answer: string) => void;
  isPreFilling?: boolean;
  preFillingSections?: Set<MemoSectionType>;
  onSectionRetry?: (sectionType: MemoSectionType) => void;
}

export default function QuestionnairePanel({
  questionnaire,
  language,
  onAnswerChange,
  isPreFilling,
  preFillingSections,
  onSectionRetry,
}: QuestionnairePanelProps) {
  const isZh = language === 'zh';
  const [expandedSections, setExpandedSections] = useState<Set<MemoSectionType>>(
    new Set(MEMO_SECTIONS.map((s) => s.type))
  );

  const toggleSection = useCallback((sectionType: MemoSectionType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionType)) {
        next.delete(sectionType);
      } else {
        next.add(sectionType);
      }
      return next;
    });
  }, []);

  const filledCount = questionnaire.reduce(
    (sum, sq) => sum + sq.questions.filter((q) => q.answer.trim()).length, 0
  );
  const totalCount = questionnaire.reduce(
    (sum, sq) => sum + sq.questions.length, 0
  );

  return (
    <div className="questionnaire-panel">
      <div className="questionnaire-header">
        <h2 className="questionnaire-title">
          {isZh ? '信息采集' : 'Information Gathering'}
        </h2>
        <div className="questionnaire-progress">
          {isPreFilling ? (
            <span className="questionnaire-prefill-badge">
              <IconSparkles size={12} />
              {isZh ? `AI 正在分析文档 (${filledCount}/${totalCount})...` : `AI analyzing documents (${filledCount}/${totalCount})...`}
            </span>
          ) : (
            <span className="questionnaire-count">
              {filledCount} / {totalCount} {isZh ? '已填写' : 'filled'}
            </span>
          )}
        </div>
      </div>

      <p className="questionnaire-subtitle">
        {isZh
          ? 'AI 已从上传的文件中尽可能提取信息。请检查并补充遗漏的内容。所有问题均为非必填项。'
          : 'AI has extracted what it could from your uploads. Please review and supplement any missing info. All questions are optional.'}
      </p>

      <div className="questionnaire-sections">
        {questionnaire.map((sq) => {
          const sectionDef = MEMO_SECTIONS.find((s) => s.type === sq.sectionType);
          if (!sectionDef) return null;
          const isExpanded = expandedSections.has(sq.sectionType);
          const sectionFilled = sq.questions.filter((q) => q.answer.trim()).length;
          const isSectionPreFilling = preFillingSections?.has(sq.sectionType) ?? false;

          return (
            <div key={sq.sectionType} className="questionnaire-section" id={`section-${sq.sectionType}`}>
              <div className="questionnaire-section-header-wrap">
                <button
                  className="questionnaire-section-header"
                  onClick={() => toggleSection(sq.sectionType)}
                >
                  <div className="questionnaire-section-header-left">
                    <span className={`questionnaire-chevron ${isExpanded ? 'open' : ''}`}>
                      <IconChevronDown size={14} />
                    </span>
                    <span className="questionnaire-section-title">
                      {isZh ? sectionDef.titleZh : sectionDef.title}
                    </span>
                    {isSectionPreFilling && (
                      <IconLoader size={13} className="spin" />
                    )}
                  </div>
                  <span className="questionnaire-section-count">
                    {isSectionPreFilling
                      ? (isZh ? '解析中...' : 'Parsing...')
                      : `${sectionFilled}/${sq.questions.length}`}
                  </span>
                </button>
                {onSectionRetry && !isSectionPreFilling && (
                  <button
                    className="questionnaire-section-retry"
                    onClick={(e) => { e.stopPropagation(); onSectionRetry(sq.sectionType); }}
                    title={isZh ? '重新解析此章节' : 'Re-analyze this section'}
                    disabled={isPreFilling}
                  >
                    <IconRefresh size={13} />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="questionnaire-questions">
                  {sq.questions.map((q) => (
                    <div
                      key={q.id}
                      className="questionnaire-question"
                    >
                      <label className="questionnaire-label">
                        {isZh ? q.questionZh : q.question}
                        {q.autoFilled && q.answer.trim() && (
                          <span className="questionnaire-ai-tag">
                            <IconSparkles size={10} />
                            AI
                          </span>
                        )}
                      </label>
                      <textarea
                        className="questionnaire-input"
                        placeholder={isZh ? '可选填写...' : 'Optional...'}
                        value={q.answer}
                        onChange={(e) => onAnswerChange(sq.sectionType, q.id, e.target.value)}
                        rows={q.answer.length > 100 ? 4 : 2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
