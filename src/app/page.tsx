'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { IconDocument, IconPlus, IconTrash, IconFileText } from '@/components/Icons';
import Header from '@/components/Header';

const STAGE_LABELS: Record<string, { en: string; zh: string; color: string; bg: string }> = {
  uploading: { en: 'Draft', zh: '草稿', color: 'var(--fg-subtle)', bg: 'var(--bg-muted)' },
  reviewing: { en: 'Reviewing', zh: '信息采集', color: 'var(--info, #3b82f6)', bg: 'var(--bg-muted)' },
  generating: { en: 'Generating', zh: '生成中', color: 'var(--warning)', bg: 'var(--warning-muted)' },
  editing: { en: 'Editing', zh: '编辑中', color: 'var(--fg)', bg: 'var(--bg-muted)' },
  completed: { en: 'Completed', zh: '已完成', color: 'var(--success)', bg: 'var(--success-muted)' },
};

export default function HomePage() {
  const router = useRouter();
  const { projects, loadFromStorage, deleteProject } = useProjectStore();
  const { language, loadFromStorage: loadSettings } = useSettingsStore();
  const isZh = language === 'zh';

  useEffect(() => {
    loadFromStorage();
    loadSettings();
  }, [loadFromStorage, loadSettings]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="app-layout">
      <Header />
      <div className="home-page">
        <div className="home-hero">
          <h1 className="home-title">
            {isZh ? '投资备忘录' : 'Investment Memos'}
          </h1>
          <p className="home-subtitle">
            {isZh
              ? 'AI 驱动的投资 MEMO 智能生成器。上传 Pitch Deck，即刻获得专业结构化备忘录。'
              : 'AI-powered investment memo generator. Upload a pitch deck to create structured, professional memos instantly.'}
          </p>
          <div className="home-actions">
            <button className="btn btn-primary" onClick={() => router.push('/create')}>
              <IconPlus size={16} />
              {isZh ? '新建项目' : 'New Project'}
            </button>
          </div>
        </div>

        {projects.length > 0 ? (
          <>
            <div className="home-section-title">
              {isZh ? '项目列表' : 'Projects'}
            </div>
            <div className="project-list">
              {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).map((project) => {
                const stage = STAGE_LABELS[project.stage] || STAGE_LABELS.uploading;
                return (
                  <div
                    key={project.id}
                    className="project-card"
                    onClick={() => router.push(`/editor/${project.id}`)}
                  >
                    <div className="project-card-icon">
                      <IconDocument size={18} />
                    </div>
                    <div className="project-card-info">
                      <div className="project-card-name">{project.companyName}</div>
                      <div className="project-card-meta">
                        {project.industry} · {formatDate(project.updatedAt)}
                      </div>
                    </div>
                    <span
                      className="project-card-stage"
                      style={{ color: stage.color, background: stage.bg }}
                    >
                      {isZh ? stage.zh : stage.en}
                    </span>
                    <div className="project-card-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(isZh ? '确定删除此项目？' : 'Delete this project?')) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconFileText size={24} />
            </div>
            <div className="empty-state-text">
              {isZh
                ? '还没有项目，点击上方按钮创建第一个投资 MEMO'
                : 'No projects yet. Click the button above to create your first investment memo.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
