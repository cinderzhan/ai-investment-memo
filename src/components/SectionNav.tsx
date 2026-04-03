'use client';

import { MemoSection, Language, MemoSectionType, SectionQuestionnaire } from '@/lib/types';
import { MEMO_SECTIONS } from '@/lib/constants';

interface SectionNavProps {
  language: Language;
  activeSectionType?: MemoSectionType | null;
  onSectionClick?: (sectionType: MemoSectionType) => void;
  /** For Generate MEMO / Editing steps */
  sections?: MemoSection[];
  generatingSections?: Set<MemoSectionType>;
  /** For Info Gathering step */
  questionnaire?: SectionQuestionnaire[];
  preFillingSections?: Set<MemoSectionType>;
}

export default function SectionNav({
  language,
  activeSectionType,
  onSectionClick,
  sections,
  generatingSections,
  questionnaire,
  preFillingSections,
}: SectionNavProps) {
  const isZh = language === 'zh';

  const handleClick = (sectionType: MemoSectionType) => {
    onSectionClick?.(sectionType);
    const el = document.getElementById(`section-${sectionType}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const items = MEMO_SECTIONS.map((def) => {
    const label = isZh ? def.titleZh : def.title;
    let status: 'idle' | 'active' | 'done' = 'idle';
    let subtitle = '';

    if (sections) {
      const sec = sections.find((s) => s.type === def.type);
      if (generatingSections?.has(def.type) || sec?.status === 'generating') {
        status = 'active';
        subtitle = isZh ? '生成中...' : 'Generating...';
      } else if (sec?.status === 'generated' || sec?.status === 'refined' || sec?.status === 'confirmed') {
        if (sec.content.trim()) {
          status = 'done';
          subtitle = isZh ? '已完成' : 'Done';
        }
      }
    }

    if (questionnaire) {
      const sq = questionnaire.find((q) => q.sectionType === def.type);
      if (sq) {
        const filled = sq.questions.filter((q) => q.answer.trim()).length;
        if (preFillingSections?.has(def.type)) {
          status = 'active';
          subtitle = isZh ? '解析中...' : 'Parsing...';
        } else if (filled === sq.questions.length && filled > 0) {
          status = 'done';
          subtitle = `${filled}/${sq.questions.length}`;
        } else if (filled > 0) {
          status = 'idle';
          subtitle = `${filled}/${sq.questions.length}`;
        } else {
          subtitle = `0/${sq.questions.length}`;
        }
      }
    }

    return { type: def.type, label, status, subtitle };
  });

  return (
    <nav className="sidebar-nav">
      {items.map((item) => {
        const isActive = activeSectionType === item.type;
        return (
          <button
            key={item.type}
            className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''} sidebar-nav-item-${item.status}`}
            onClick={() => handleClick(item.type)}
          >
            <span className="sidebar-nav-indicator" />
            <div className="sidebar-nav-text">
              <span className="sidebar-nav-label">{item.label}</span>
              {item.subtitle && (
                <span className="sidebar-nav-subtitle">{item.subtitle}</span>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
