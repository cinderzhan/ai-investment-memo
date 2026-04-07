'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadedFile, FileCategory } from '@/lib/types';
import { IconUpload, IconX, IconCheck, IconLoader, IconRefresh } from './Icons';

interface FileUploadProps {
  files: UploadedFile[];
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  language: 'en' | 'zh';
  category: FileCategory;
  label: string;
  hint?: string;
}

export default function FileUpload({ files, onFilesChange, language, category, label, hint }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rawFilesRef = useRef<Map<string, File>>(new Map());
  const isZh = language === 'zh';

  const parseFile = async (file: File): Promise<string> => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/parse-file', { method: 'POST', body: form });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Server error');
        throw new Error(errText);
      }
      const data = await res.json();
      return data.content || '';
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsText(file);
    });
  };

  const processFiles = useCallback(async (fileList: FileList) => {
    const placeholders: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const id = `${Date.now()}-${i}`;
      rawFilesRef.current.set(id, file);
      placeholders.push({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        content: '',
        category,
        parseStatus: 'parsing',
      });
    }

    onFilesChange((prev) => [...prev, ...placeholders]);

    const results = await Promise.all(
      placeholders.map(async (ph) => {
        const rawFile = rawFilesRef.current.get(ph.id);
        if (!rawFile) return { id: ph.id, ok: false as const, content: '' };
        try {
          const content = await parseFile(rawFile);
          return { id: ph.id, ok: true as const, content };
        } catch {
          return { id: ph.id, ok: false as const, content: '' };
        }
      }),
    );

    onFilesChange((prev) => {
      let next = prev;
      for (const r of results) {
        next = next.map((f) => {
          if (f.id !== r.id) return f;
          if (r.ok) return { ...f, content: r.content, parseStatus: 'success' as const };
          return { ...f, parseStatus: 'failed' as const };
        });
      }
      return next;
    });
  }, [onFilesChange, category]);

  const handleRetry = useCallback(async (fileId: string) => {
    const rawFile = rawFilesRef.current.get(fileId);
    if (!rawFile) return;

    onFilesChange((prev) =>
      prev.map((f) => f.id === fileId ? { ...f, parseStatus: 'parsing' as const } : f)
    );

    try {
      const content = await parseFile(rawFile);
      onFilesChange((prev) =>
        prev.map((f) => f.id === fileId ? { ...f, content, parseStatus: 'success' as const } : f)
      );
    } catch {
      onFilesChange((prev) =>
        prev.map((f) => f.id === fileId ? { ...f, parseStatus: 'failed' as const } : f)
      );
    }
  }, [onFilesChange]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) await processFiles(e.dataTransfer.files);
  };

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    rawFilesRef.current.delete(id);
    onFilesChange((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categoryFiles = files.filter((f) => f.category === category);
  const isParsing = categoryFiles.some((f) => f.parseStatus === 'parsing');

  return (
    <div className="input-group">
      <label className="input-label">
        {label}
        {hint && <span className="input-hint"> — {hint}</span>}
      </label>

      <div
        className={`file-input-zone ${dragging ? 'file-input-zone-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.txt,.csv"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {isParsing ? (
          <>
            <IconLoader size={15} className="spin" />
            <span>{isZh ? '解析中...' : 'Parsing...'}</span>
          </>
        ) : (
          <>
            <IconUpload size={15} />
            <span>{isZh ? '点击或拖拽上传文件' : 'Click or drag to upload'}</span>
          </>
        )}
      </div>

      {categoryFiles.length > 0 && (
        <div className="file-chips">
          {categoryFiles.map((file) => (
            <div
              key={file.id}
              className={`file-chip ${
                file.parseStatus === 'failed' ? 'file-chip-error' :
                file.parseStatus === 'parsing' ? 'file-chip-parsing' : ''
              }`}
            >
              {file.parseStatus === 'parsing' && <IconLoader size={12} className="spin" />}
              {file.parseStatus === 'success' && <IconCheck size={12} className="file-status-ok" />}
              {file.parseStatus === 'failed' && <IconX size={12} className="file-status-err" />}
              <span className="file-chip-name">{file.name}</span>
              <span className="file-chip-size">{formatSize(file.size)}</span>
              {file.parseStatus === 'failed' && (
                <button
                  className="file-chip-action"
                  onClick={(e) => { e.stopPropagation(); handleRetry(file.id); }}
                  title={isZh ? '重试' : 'Retry'}
                >
                  <IconRefresh size={11} />
                </button>
              )}
              <button
                className="file-chip-action file-chip-remove"
                onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
              >
                <IconX size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
