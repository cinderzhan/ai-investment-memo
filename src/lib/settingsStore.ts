import { create } from 'zustand';
import { UserSettings, Language, CustomModelConfig, MemoSectionType } from './types';
import { PROVIDERS } from './constants';

interface SettingsStore extends UserSettings {
  setApiKey: (providerId: string, apiKey: string) => void;
  toggleProvider: (providerId: string, enabled: boolean) => void;
  setDefaultModel: (provider: string, model: string) => void;
  setLanguage: (lang: Language) => void;
  setBaseUrl: (providerId: string, baseUrl: string) => void;
  addCustomModel: (model: Omit<CustomModelConfig, 'id' | 'enabled'>) => void;
  updateCustomModel: (id: string, updates: Partial<CustomModelConfig>) => void;
  removeCustomModel: (id: string) => void;
  setPromptOverride: (sectionType: MemoSectionType, lang: Language, prompt: string) => void;
  resetPromptOverride: (sectionType: MemoSectionType) => void;
  getPromptOverride: (sectionType: MemoSectionType, lang: Language) => string | undefined;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  getAvailableModels: () => { provider: string; model: string; name: string; providerName: string; isCustom?: boolean; baseUrl?: string; apiKey?: string }[];
}

const STORAGE_KEY = 'dd-agent-settings';

const defaultSettings: UserSettings = {
  providers: {},
  customModels: [],
  defaultModel: { provider: 'openai', model: 'gpt-4o' },
  language: 'en',
  promptOverrides: {},
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaultSettings,

  setApiKey: (providerId, apiKey) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [providerId]: { ...state.providers[providerId], apiKey, enabled: !!apiKey },
      },
    }));
    get().saveToStorage();
  },

  toggleProvider: (providerId, enabled) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [providerId]: { ...state.providers[providerId], enabled },
      },
    }));
    get().saveToStorage();
  },

  setDefaultModel: (provider, model) => {
    set({ defaultModel: { provider, model } });
    get().saveToStorage();
  },

  setLanguage: (language) => {
    set({ language });
    get().saveToStorage();
  },

  setBaseUrl: (providerId, baseUrl) => {
    set((state) => ({
      providers: {
        ...state.providers,
        [providerId]: { ...state.providers[providerId], baseUrl },
      },
    }));
    get().saveToStorage();
  },

  addCustomModel: (model) => {
    const newModel: CustomModelConfig = {
      ...model,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      enabled: true,
    };
    set((state) => ({
      customModels: [...state.customModels, newModel],
    }));
    get().saveToStorage();
  },

  updateCustomModel: (id, updates) => {
    set((state) => ({
      customModels: state.customModels.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
    get().saveToStorage();
  },

  removeCustomModel: (id) => {
    set((state) => ({
      customModels: state.customModels.filter((m) => m.id !== id),
    }));
    get().saveToStorage();
  },

  setPromptOverride: (sectionType, lang, prompt) => {
    set((state) => {
      const existing = state.promptOverrides[sectionType] || { en: '', zh: '' };
      return {
        promptOverrides: {
          ...state.promptOverrides,
          [sectionType]: { ...existing, [lang]: prompt },
        },
      };
    });
    get().saveToStorage();
  },

  resetPromptOverride: (sectionType) => {
    set((state) => {
      const newOverrides = { ...state.promptOverrides };
      delete newOverrides[sectionType];
      return { promptOverrides: newOverrides };
    });
    get().saveToStorage();
  },

  getPromptOverride: (sectionType, lang) => {
    const override = get().promptOverrides[sectionType];
    if (!override) return undefined;
    const val = override[lang];
    return val?.trim() || undefined;
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserSettings;
        if (!parsed.customModels) parsed.customModels = [];
        if (!parsed.promptOverrides) parsed.promptOverrides = {};
        set(parsed);
      }
    } catch { /* ignore */ }
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return;
    const { providers, customModels, defaultModel, language, promptOverrides } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ providers, customModels, defaultModel, language, promptOverrides }));
  },

  getAvailableModels: () => {
    const { providers, customModels } = get();
    const models: { provider: string; model: string; name: string; providerName: string; isCustom?: boolean; baseUrl?: string; apiKey?: string }[] = [];
    
    PROVIDERS.forEach((p) => {
      const cfg = providers[p.id];
      if (cfg?.apiKey && cfg.enabled) {
        p.models.forEach((m) => {
          models.push({
            provider: p.id,
            model: m.id,
            name: m.name,
            providerName: p.name,
            baseUrl: cfg.baseUrl || p.baseUrl,
            apiKey: cfg.apiKey,
          });
        });
      }
    });

    customModels.forEach((cm) => {
      if (cm.enabled && cm.apiKey && cm.baseUrl && cm.modelId) {
        models.push({
          provider: `custom_${cm.id}`,
          model: cm.modelId,
          name: cm.name || cm.modelId,
          providerName: cm.name || 'Custom',
          isCustom: true,
          baseUrl: cm.baseUrl,
          apiKey: cm.apiKey,
        });
      }
    });
    
    return models;
  },
}));
