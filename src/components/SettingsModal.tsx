'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/lib/settingsStore';
import { PROVIDERS, MEMO_SECTIONS } from '@/lib/constants';
import { MemoSectionType } from '@/lib/types';
import { getDefaultPromptTemplate } from '@/lib/prompts';
import { IconX, IconPlus, IconTrash, IconChevronDown, IconRefresh } from './Icons';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'api' | 'prompts';

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    providers, customModels, language, promptOverrides,
    setApiKey, setBaseUrl, addCustomModel, updateCustomModel, removeCustomModel,
    setPromptOverride, resetPromptOverride,
  } = useSettingsStore();
  const isZh = language === 'zh';

  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
  });
  const [expandedPrompts, setExpandedPrompts] = useState<Set<MemoSectionType>>(new Set());

  const handleAddCustomModel = () => {
    if (!newModel.name || !newModel.baseUrl || !newModel.apiKey || !newModel.modelId) return;
    addCustomModel(newModel);
    setNewModel({ name: '', baseUrl: '', apiKey: '', modelId: '' });
    setShowAddForm(false);
  };

  const togglePromptExpand = (sectionType: MemoSectionType) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(sectionType)) next.delete(sectionType);
      else next.add(sectionType);
      return next;
    });
  };

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-header">
          <div className="settings-title">{isZh ? '设置' : 'Settings'}</div>
          <button className="btn-icon" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            {isZh ? 'API 配置' : 'API Config'}
          </button>
          <button
            className={`settings-tab ${activeTab === 'prompts' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            {isZh ? '提示词配置' : 'Prompt Config'}
          </button>
        </div>

        <div className="settings-body">
          {/* ============ API Config Tab ============ */}
          {activeTab === 'api' && (
            <>
              <div className="settings-section">
                <div className="settings-section-title">
                  {isZh ? '预设模型供应商' : 'Preset Providers'}
                </div>
                {PROVIDERS.map((provider) => {
                  const cfg = providers[provider.id];
                  const hasKey = !!cfg?.apiKey;
                  return (
                    <div key={provider.id} className="provider-card">
                      <div className="provider-header">
                        <span className="provider-name">{provider.name}</span>
                        <span className={`provider-status ${hasKey ? 'connected' : 'disconnected'}`}>
                          {hasKey ? (isZh ? '已连接' : 'Connected') : (isZh ? '未连接' : 'Not connected')}
                        </span>
                      </div>
                      <div className="input-group">
                        <label className="input-label">API Key</label>
                        <input
                          className="input"
                          type="password"
                          placeholder={`${provider.name} API Key`}
                          value={cfg?.apiKey || ''}
                          onChange={(e) => setApiKey(provider.id, e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">
                          Base URL
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 400, marginLeft: 6 }}>
                            {isZh ? '可选，留空使用默认' : 'Optional'}
                          </span>
                        </label>
                        <input
                          className="input"
                          type="text"
                          placeholder={provider.baseUrl || (provider.id === 'openai' ? 'https://api.openai.com/v1' : provider.id === 'anthropic' ? 'https://api.anthropic.com' : provider.id === 'google' ? 'https://generativelanguage.googleapis.com/v1beta/openai' : 'https://...')}
                          value={cfg?.baseUrl || ''}
                          onChange={(e) => setBaseUrl(provider.id, e.target.value)}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                        {isZh ? '可用模型：' : 'Models: '}
                        {provider.models.map((m) => m.name).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="settings-section">
                <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{isZh ? '自定义模型（OpenAI 兼容）' : 'Custom Models (OpenAI Compatible)'}</span>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    {showAddForm ? (isZh ? '取消' : 'Cancel') : (
                      <><IconPlus size={13} /> {isZh ? '添加' : 'Add'}</>
                    )}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.6 }}>
                  {isZh
                    ? '支持任何 OpenAI 兼容 API（如 Qwen/通义千问、智谱、零一万物、Ollama 等），填入 API Key、Base URL 和模型 ID 即可使用。'
                    : 'Supports any OpenAI-compatible API (Qwen, Zhipu, Yi, Ollama, etc.). Provide API Key, Base URL, and Model ID.'}
                </div>

                {customModels.map((cm) => (
                  <div key={cm.id} className="provider-card custom-model-card">
                    <div className="provider-header">
                      <span className="provider-name">{cm.name || cm.modelId}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`provider-status ${cm.enabled ? 'connected' : 'disconnected'}`}>
                          {cm.enabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '已禁用' : 'Disabled')}
                        </span>
                        <button className="btn-icon" title={isZh ? '删除' : 'Delete'} onClick={() => removeCustomModel(cm.id)}>
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="custom-model-fields">
                      <div className="input-group">
                        <label className="input-label">{isZh ? '名称' : 'Name'}</label>
                        <input className="input" type="text" value={cm.name} onChange={(e) => updateCustomModel(cm.id, { name: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">API Key</label>
                        <input className="input" type="password" value={cm.apiKey} onChange={(e) => updateCustomModel(cm.id, { apiKey: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Base URL</label>
                        <input className="input" type="text" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value={cm.baseUrl} onChange={(e) => updateCustomModel(cm.id, { baseUrl: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">{isZh ? '模型 ID' : 'Model ID'}</label>
                        <input className="input" type="text" placeholder="qwen-max, gpt-4o, ..." value={cm.modelId} onChange={(e) => updateCustomModel(cm.id, { modelId: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}

                {showAddForm && (
                  <div className="provider-card custom-model-card" style={{ borderStyle: 'dashed' }}>
                    <div className="provider-header">
                      <span className="provider-name">{isZh ? '新增自定义模型' : 'New Custom Model'}</span>
                    </div>
                    <div className="custom-model-fields">
                      <div className="input-group">
                        <label className="input-label">{isZh ? '显示名称' : 'Display Name'} *</label>
                        <input className="input" type="text" placeholder={isZh ? '例如：Qwen Max' : 'e.g. Qwen Max'} value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">API Key *</label>
                        <input className="input" type="password" placeholder="sk-..." value={newModel.apiKey} onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Base URL *</label>
                        <input className="input" type="text" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value={newModel.baseUrl} onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">{isZh ? '模型 ID' : 'Model ID'} *</label>
                        <input className="input" type="text" placeholder="qwen-max" value={newModel.modelId} onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })} />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-end', padding: '8px 20px', fontSize: 13 }}
                      disabled={!newModel.name || !newModel.baseUrl || !newModel.apiKey || !newModel.modelId}
                      onClick={handleAddCustomModel}
                    >
                      {isZh ? '保存' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ============ Prompts Config Tab ============ */}
          {activeTab === 'prompts' && (
            <div className="settings-section">
              <div className="settings-section-title">
                {isZh ? '章节提示词' : 'Section Prompts'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.6, marginBottom: 16 }}>
                {isZh
                  ? '查看和自定义每个章节的生成提示词。公司信息、问卷答案和上传文档内容会在生成时自动附加到提示词之后。'
                  : 'View and customize the generation prompt for each section. Company info, questionnaire answers, and uploaded documents are automatically appended at generation time.'}
              </div>

              {MEMO_SECTIONS.map((section) => {
                const isExpanded = expandedPrompts.has(section.type);
                const hasOverride = !!(promptOverrides[section.type]?.en || promptOverrides[section.type]?.zh);
                const currentLang = isZh ? 'zh' : 'en';
                const currentOverride = promptOverrides[section.type]?.[currentLang] || '';
                const defaultTemplate = getDefaultPromptTemplate(section.type, language);

                return (
                  <div key={section.type} className="prompt-card">
                    <button className="prompt-card-header" onClick={() => togglePromptExpand(section.type)}>
                      <div className="prompt-card-header-left">
                        <span className={`questionnaire-chevron ${isExpanded ? 'open' : ''}`}>
                          <IconChevronDown size={14} />
                        </span>
                        <span className="prompt-card-title">
                          {isZh ? section.titleZh : section.title}
                        </span>
                        {hasOverride && (
                          <span className="prompt-custom-badge">
                            {isZh ? '已自定义' : 'Custom'}
                          </span>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="prompt-card-body">
                        {/* Full default prompt template */}
                        <div className="prompt-default-info">
                          <div className="prompt-default-label">
                            {hasOverride
                              ? (isZh ? '默认提示词（已被自定义覆盖）' : 'Default prompt (overridden by custom)')
                              : (isZh ? '当前提示词（默认）' : 'Current prompt (default)')}
                          </div>
                          <pre className="prompt-template-text">{defaultTemplate}</pre>
                        </div>

                        <div className="prompt-context-note">
                          {isZh
                            ? '⬇ 以下内容会在生成时自动附加：公司名称、行业、问卷答案、上传文档内容'
                            : '⬇ Auto-appended at generation time: company name, industry, Q&A answers, uploaded documents'}
                        </div>

                        {/* Custom override */}
                        <div className="input-group">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label className="input-label" style={{ marginBottom: 0 }}>
                              {isZh ? '自定义提示词' : 'Custom Prompt'}
                              <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 400, marginLeft: 6 }}>
                                {isZh ? '留空使用默认' : 'Leave empty for default'}
                              </span>
                            </label>
                            {!hasOverride && (
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setPromptOverride(section.type, currentLang, defaultTemplate)}
                              >
                                {isZh ? '复制默认并编辑' : 'Copy default to edit'}
                              </button>
                            )}
                          </div>
                          <textarea
                            className="input prompt-textarea"
                            placeholder={isZh ? '输入自定义提示词...' : 'Enter custom prompt...'}
                            value={currentOverride}
                            onChange={(e) => setPromptOverride(section.type, currentLang, e.target.value)}
                            rows={hasOverride ? 12 : 4}
                          />
                        </div>

                        {hasOverride && (
                          <button
                            className="btn btn-ghost prompt-reset-btn"
                            onClick={() => resetPromptOverride(section.type)}
                          >
                            <IconRefresh size={13} />
                            {isZh ? '恢复默认' : 'Reset to default'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
