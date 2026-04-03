'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { INDUSTRIES } from '@/lib/constants';
import { UploadedFile, Language } from '@/lib/types';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';

export default function CreatePage() {
  const router = useRouter();
  const { createProject, addUploadedFile, loadFromStorage } = useProjectStore();
  const { language, defaultModel, providers, customModels, setDefaultModel, loadFromStorage: loadSettings, getAvailableModels } = useSettingsStore();
  const isZh = language === 'zh';

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [lang, setLang] = useState<Language>(language);

  useEffect(() => {
    loadFromStorage();
    loadSettings();
  }, [loadFromStorage, loadSettings]);

  useEffect(() => {
    setLang(language);
  }, [language]);

  const availableModels = useMemo(() => getAvailableModels(), [providers, customModels, getAvailableModels]);

  const currentModelLabel = useMemo(() => {
    const found = availableModels.find(
      (m) => m.provider === defaultModel.provider && m.model === defaultModel.model
    );
    return found ? `${found.providerName} / ${found.name}` : (isZh ? '请先配置模型' : 'Configure a model first');
  }, [availableModels, defaultModel, isZh]);

  const noModels = availableModels.length === 0;
  const hasParsing = files.some((f) => f.parseStatus === 'parsing');
  const hasFailed = files.some((f) => f.parseStatus === 'failed');
  const canCreate = companyName.trim() && !noModels && !hasParsing && !hasFailed;

  const handleCreate = () => {
    if (!canCreate) return;
    const projectId = createProject(companyName.trim(), industry || 'other', lang);
    files.forEach((f) => addUploadedFile(projectId, f));
    router.push(`/editor/${projectId}`);
  };

  return (
    <div className="app-layout">
      <Header />
      <div className="create-page">
        <div className="create-card">
          <h1 className="create-title">{isZh ? '新建投资 MEMO' : 'New Investment Memo'}</h1>
          <p className="create-subtitle">
            {isZh
              ? '输入公司信息并上传 Pitch Deck，AI 将自动生成结构化投资备忘录'
              : 'Enter company details and upload a pitch deck. AI will generate a structured investment memo.'}
          </p>

          <div className="create-form">
            <div className="input-group">
              <label className="input-label">{isZh ? '公司名称' : 'Company Name'} *</label>
              <input
                className="input"
                type="text"
                placeholder={isZh ? '输入公司名称...' : 'Enter company name...'}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">{isZh ? '行业' : 'Industry'}</label>
              <select
                className="input input-select"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option value="">{isZh ? '选择行业...' : 'Select industry...'}</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {isZh ? ind.labelZh : ind.label}
                  </option>
                ))}
              </select>
            </div>

            <FileUpload
              files={files}
              onFilesChange={setFiles}
              language={lang}
              category="company_intro"
              label={isZh ? '公司介绍' : 'Company Introduction'}
              hint={isZh ? 'BP、商业计划书、公司简介' : 'Pitch deck, business plan, overview'}
            />
            <FileUpload
              files={files}
              onFilesChange={setFiles}
              language={lang}
              category="key_member_resume"
              label={isZh ? '核心成员简历' : 'Key Member Resume'}
              hint={isZh ? '创始人 / 高管简历' : 'Founder / executive CVs'}
            />
            <FileUpload
              files={files}
              onFilesChange={setFiles}
              language={lang}
              category="audit_report"
              label={isZh ? '审计报告' : 'Audit Report'}
              hint={isZh ? '财务报表、审计报告' : 'Financial statements, audit reports'}
            />

            {/* Language + Model row */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div className="input-group" style={{ flex: '0 0 auto' }}>
                <label className="input-label">{isZh ? '输出语言' : 'Output Language'}</label>
                <div className="lang-toggle">
                  <button
                    className={`lang-toggle-btn ${lang === 'en' ? 'active' : ''}`}
                    onClick={() => setLang('en')}
                  >
                    EN
                  </button>
                  <button
                    className={`lang-toggle-btn ${lang === 'zh' ? 'active' : ''}`}
                    onClick={() => setLang('zh')}
                  >
                    中文
                  </button>
                </div>
              </div>

              <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="input-label">{isZh ? 'AI 模型' : 'AI Model'} *</label>
                {noModels ? (
                  <div style={{ fontSize: 13, color: 'var(--fg-subtle)', padding: '10px 0' }}>
                    {isZh ? '请先在设置中配置 API Key' : 'Please configure an API Key in Settings first'}
                  </div>
                ) : (
                  <select
                    className="input input-select"
                    value={`${defaultModel.provider}::${defaultModel.model}`}
                    onChange={(e) => {
                      const [provider, model] = e.target.value.split('::');
                      setDefaultModel(provider, model);
                    }}
                  >
                    {availableModels.map((m) => (
                      <option key={`${m.provider}_${m.model}`} value={`${m.provider}::${m.model}`}>
                        {m.providerName} / {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!canCreate}
              style={{ alignSelf: 'flex-start', padding: '10px 24px', fontSize: 15 }}
            >
              {hasParsing
                ? (isZh ? '文件解析中...' : 'Parsing files...')
                : hasFailed
                  ? (isZh ? '请重试失败的文件' : 'Please retry failed files')
                  : (isZh ? '开始' : 'Start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
