'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/lib/settingsStore';
import { IconSettings, IconChevronDown, IconLibrary } from './Icons';
import SettingsModal from './SettingsModal';

interface HeaderProps {
  projectName?: string;
  showModelSelector?: boolean;
}

export default function Header({ projectName, showModelSelector = false }: HeaderProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const defaultModel = useSettingsStore((state) => state.defaultModel);
  const setDefaultModel = useSettingsStore((state) => state.setDefaultModel);
  const getAvailableModels = useSettingsStore((state) => state.getAvailableModels);

  const availableModels = useMemo(() => getAvailableModels(), [getAvailableModels]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof availableModels> = {};
    availableModels.forEach((m) => {
      if (!groups[m.providerName]) groups[m.providerName] = [];
      groups[m.providerName].push(m);
    });
    return groups;
  }, [availableModels]);

  const currentModelName = (() => {
    const found = availableModels.find(
      (m) => m.model === defaultModel.model && m.provider === defaultModel.provider
    );
    return found?.name || defaultModel.model;
  })();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowSettings(false);
      setShowDropdown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo" onClick={() => router.push('/')}>
            Investment Assistant
          </div>
          {projectName && (
            <div className="breadcrumb">
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{projectName}</span>
            </div>
          )}
        </div>
        <div className="app-header-right">
          {showModelSelector && availableModels.length > 0 && (
            <div className="model-selector">
              <button
                className="model-selector-trigger"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {currentModelName}
                <IconChevronDown size={12} />
              </button>
              {showDropdown && (
                <div className="model-dropdown" onMouseLeave={() => setShowDropdown(false)}>
                  {Object.entries(groupedModels).map(([groupName, models]) => (
                    <div key={groupName}>
                      <div className="model-dropdown-group">{groupName}</div>
                      {models.map((model) => (
                        <div
                          key={`${model.provider}_${model.model}`}
                          className={`model-dropdown-item ${defaultModel.provider === model.provider && defaultModel.model === model.model ? 'selected' : ''}`}
                          onClick={() => {
                            setDefaultModel(model.provider, model.model);
                            setShowDropdown(false);
                          }}
                        >
                          {model.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="lang-toggle">
            <button
              className={`lang-toggle-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              className={`lang-toggle-btn ${language === 'zh' ? 'active' : ''}`}
              onClick={() => setLanguage('zh')}
            >
              中文
            </button>
          </div>
          <button className="btn-icon" onClick={() => router.push('/library')} title={language === 'zh' ? '项目库' : 'Library'}>
            <IconLibrary size={18} />
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">
            <IconSettings size={18} />
          </button>
        </div>
      </header>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
