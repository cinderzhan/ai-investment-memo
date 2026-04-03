'use client';

import { Language } from '@/lib/types';
import { IconSparkles } from './Icons';

interface FloatingToolbarProps {
  position: { top: number; left: number } | null;
  language: Language;
  onAction: (action: string) => void;
  onClose: () => void;
}

export default function FloatingToolbar({ position, language, onAction, onClose }: FloatingToolbarProps) {
  if (!position) return null;
  const isZh = language === 'zh';

  const actions = [
    { id: 'rewrite', label: isZh ? 'AI 改写' : 'AI Rewrite', accent: true },
    { id: 'expand', label: isZh ? '展开' : 'Expand', accent: false },
    { id: 'simplify', label: isZh ? '简化' : 'Simplify', accent: false },
    { id: 'tone', label: isZh ? '调整语气' : 'Adjust tone', accent: false },
  ];

  return (
    <div
      className="floating-toolbar"
      style={{ top: position.top - 48, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
      onMouseLeave={onClose}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          className={`floating-toolbar-btn ${action.accent ? 'accent' : ''}`}
          onClick={() => onAction(action.id)}
        >
          {action.accent && <IconSparkles size={13} />}
          {action.label}
        </button>
      ))}
    </div>
  );
}
