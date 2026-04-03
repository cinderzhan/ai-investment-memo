'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { INDUSTRIES } from '@/lib/constants';
import { IconDocument, IconCheck, IconTrash } from '@/components/Icons';
import Header from '@/components/Header';

export default function LibraryPage() {
  const router = useRouter();
  const { projects, loadFromStorage, deleteProject } = useProjectStore();
  const { language, loadFromStorage: loadSettings } = useSettingsStore();
  const isZh = language === 'zh';

  useEffect(() => {
    loadFromStorage();
    loadSettings();
  }, [loadFromStorage, loadSettings]);

  const completedProjects = [...projects]
    .filter((p) => p.stage === 'completed' && p.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getIndustryLabel = (value: string) => {
    const ind = INDUSTRIES.find((i) => i.value === value);
    return ind ? (isZh ? ind.labelZh : ind.label) : value;
  };

  const getSectionCount = (p: typeof completedProjects[0]) => {
    return p.memo?.sections.filter((s) => s.content.trim()).length || 0;
  };

  return (
    <div className="app-layout">
      <Header />
      <div className="home-page">
        <div className="home-hero">
          <h1 className="home-title">
            {isZh ? '项目库' : 'Project Library'}
          </h1>
          <p className="home-subtitle">
            {isZh
              ? '已完成的投资备忘录归档。点击项目查看或继续编辑。'
              : 'Archive of completed investment memos. Click a project to view or continue editing.'}
          </p>
        </div>

        {completedProjects.length > 0 ? (
          <div className="project-list">
            {completedProjects.map((project) => (
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
                    {getIndustryLabel(project.industry)}
                    {' · '}
                    {getSectionCount(project)} {isZh ? '章节' : 'sections'}
                    {' · '}
                    {isZh ? '完成于 ' : 'Completed '}
                    {formatDate(project.completedAt!)}
                  </div>
                </div>
                <span
                  className="project-card-stage"
                  style={{ color: 'var(--success)', background: 'var(--success-muted)' }}
                >
                  <IconCheck size={12} />
                  {isZh ? '已完成' : 'Completed'}
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
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconDocument size={24} />
            </div>
            <div className="empty-state-text">
              {isZh
                ? '还没有已完成的项目。完成 MEMO 生成后，点击「保存到项目库」即可归档。'
                : 'No completed projects yet. After generating a memo, click "Save to Library" to archive it.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
