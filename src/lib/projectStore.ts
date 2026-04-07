import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Project, MemoDocument, MemoSection, ChatMessage, UploadedFile, MemoSectionType, ProjectStage, Language, SectionQuestionnaire } from './types';
import { MEMO_SECTIONS, buildDefaultQuestionnaire } from './constants';

const PROJECTS_KEY = 'dd-agent-projects';
const CHATS_KEY = 'dd-agent-chats';

function createDefaultMemo(projectId: string): MemoDocument {
  return {
    id: uuidv4(),
    projectId,
    sections: MEMO_SECTIONS.map((s) => ({
      id: uuidv4(),
      type: s.type,
      title: s.title,
      titleZh: s.titleZh,
      status: 'pending' as const,
      content: '',
    })),
  };
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  chatMessages: ChatMessage[];
  
  // Project actions
  createProject: (companyName: string, industry: string, language: Language) => string;
  setCurrentProject: (id: string | null) => void;
  getCurrentProject: () => Project | null;
  updateProjectStage: (id: string, stage: ProjectStage) => void;
  addUploadedFile: (projectId: string, file: UploadedFile) => void;
  /** Append many files in one update (single localStorage write — faster than repeated addUploadedFile). */
  addUploadedFiles: (projectId: string, files: UploadedFile[]) => void;
  deleteProject: (id: string) => void;
  completeProject: (id: string) => void;
  
  // Questionnaire actions
  updateQuestionAnswer: (projectId: string, sectionType: MemoSectionType, questionId: string, answer: string, autoFilled?: boolean) => void;
  bulkUpdateQuestionnaire: (projectId: string, updates: Record<string, string>) => void;
  
  // Memo actions
  updateSectionContent: (projectId: string, sectionType: MemoSectionType, content: string) => void;
  updateSectionStatus: (projectId: string, sectionType: MemoSectionType, status: MemoSection['status']) => void;
  updateAllSections: (projectId: string, updates: { type: MemoSectionType; content: string; status: MemoSection['status'] }[]) => void;
  
  // Chat actions
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  getChatMessages: (projectId: string) => ChatMessage[];
  
  // Storage
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  chatMessages: [],

  createProject: (companyName, industry, language) => {
    const id = uuidv4();
    const project: Project = {
      id,
      companyName,
      industry,
      uploadedFiles: [],
      stage: 'reviewing', // Start at Step 1 (questionnaire)
      language,
      selectedModel: { provider: 'openai', model: 'gpt-4o' },
      questionnaire: buildDefaultQuestionnaire(),
      memo: createDefaultMemo(id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: id,
    }));
    get().saveToStorage();
    return id;
  },

  setCurrentProject: (id) => {
    set({ currentProjectId: id });
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) || null;
  },

  updateProjectStage: (id, stage) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, stage, updatedAt: Date.now() } : p
      ),
    }));
    get().saveToStorage();
  },

  addUploadedFile: (projectId, file) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, uploadedFiles: [...p.uploadedFiles, file], updatedAt: Date.now() }
          : p
      ),
    }));
    get().saveToStorage();
  },

  addUploadedFiles: (projectId, files) => {
    if (files.length === 0) return;
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, uploadedFiles: [...p.uploadedFiles, ...files], updatedAt: Date.now() }
          : p
      ),
    }));
    get().saveToStorage();
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      chatMessages: state.chatMessages.filter((m) => m.projectId !== id),
    }));
    get().saveToStorage();
  },

  completeProject: (id) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, stage: 'completed' as const, completedAt: Date.now(), updatedAt: Date.now() } : p
      ),
    }));
    get().saveToStorage();
  },

  updateQuestionAnswer: (projectId, sectionType, questionId, answer, autoFilled = false) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId || !p.questionnaire) return p;
        return {
          ...p,
          updatedAt: Date.now(),
          questionnaire: p.questionnaire.map((sq) => {
            if (sq.sectionType !== sectionType) return sq;
            return {
              ...sq,
              questions: sq.questions.map((q) =>
                q.id === questionId ? { ...q, answer, autoFilled } : q
              ),
            };
          }),
        };
      }),
    }));
    get().saveToStorage();
  },

  bulkUpdateQuestionnaire: (projectId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId || !p.questionnaire) return p;
        return {
          ...p,
          updatedAt: Date.now(),
          questionnaire: p.questionnaire.map((sq) => ({
            ...sq,
            questions: sq.questions.map((q) => {
              const newAnswer = updates[q.id];
              if (newAnswer !== undefined && newAnswer.trim()) {
                return { ...q, answer: newAnswer, autoFilled: true };
              }
              return q;
            }),
          })),
        };
      }),
    }));
    get().saveToStorage();
  },

  updateSectionContent: (projectId, sectionType, content) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId || !p.memo) return p;
        return {
          ...p,
          updatedAt: Date.now(),
          memo: {
            ...p.memo,
            sections: p.memo.sections.map((s) =>
              s.type === sectionType ? { ...s, content } : s
            ),
          },
        };
      }),
    }));
    get().saveToStorage();
  },

  updateSectionStatus: (projectId, sectionType, status) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId || !p.memo) return p;
        return {
          ...p,
          memo: {
            ...p.memo,
            sections: p.memo.sections.map((s) =>
              s.type === sectionType ? { ...s, status } : s
            ),
          },
        };
      }),
    }));
    get().saveToStorage();
  },

  updateAllSections: (projectId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId || !p.memo) return p;
        const newSections = p.memo.sections.map((s) => {
          const update = updates.find((u) => u.type === s.type);
          if (update) return { ...s, content: update.content, status: update.status };
          return s;
        });
        return { ...p, updatedAt: Date.now(), memo: { ...p.memo, sections: newSections } };
      }),
    }));
    get().saveToStorage();
  },

  addChatMessage: (message) => {
    const msg: ChatMessage = { ...message, id: uuidv4(), timestamp: Date.now() };
    set((state) => ({ chatMessages: [...state.chatMessages, msg] }));
    get().saveToStorage();
  },

  getChatMessages: (projectId) => {
    return get().chatMessages.filter((m) => m.projectId === projectId);
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const projectsStr = localStorage.getItem(PROJECTS_KEY);
      const chatsStr = localStorage.getItem(CHATS_KEY);
      if (projectsStr) {
        const saved: Project[] = JSON.parse(projectsStr);
        const current = get().projects;
        const merged = saved.map((sp) => {
          const inMem = current.find((cp) => cp.id === sp.id);
          if (inMem && inMem.uploadedFiles.some((f) => f.content)) {
            return { ...sp, uploadedFiles: inMem.uploadedFiles };
          }
          return sp;
        });
        // Also keep in-memory projects not yet in localStorage
        const newInMem = current.filter((cp) => !saved.some((sp) => sp.id === cp.id));
        set({ projects: [...merged, ...newInMem] });
      }
      if (chatsStr) set({ chatMessages: JSON.parse(chatsStr) });
    } catch { /* ignore */ }
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return;
    const { projects, chatMessages } = get();
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      localStorage.setItem(CHATS_KEY, JSON.stringify(chatMessages));
    } catch {
      // Quota exceeded — retry without file content
      const lighterProjects = projects.map((p) => ({
        ...p,
        uploadedFiles: p.uploadedFiles.map((f) => ({ ...f, content: undefined })),
      }));
      try {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(lighterProjects));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
  },
}));
