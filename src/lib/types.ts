export type MemoSectionType =
  | 'deal_overview'
  | 'team_composition'
  | 'model_product'
  | 'market_competitive'
  | 'business_financials'
  | 'return_analysis'
  | 'reasons_to_invest'
  | 'risk_factors';

export type SectionStatus = 'pending' | 'generating' | 'generated' | 'refined' | 'confirmed';

export type ProjectStage = 'uploading' | 'reviewing' | 'generating' | 'editing' | 'completed';

export type Language = 'en' | 'zh';

export type FileCategory = 'company_intro' | 'key_member_resume' | 'audit_report';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  category?: FileCategory;
  parseStatus?: 'parsing' | 'success' | 'failed';
}

export interface QuestionAnswer {
  id: string;
  question: string;
  questionZh: string;
  answer: string;
  autoFilled: boolean;
}

export interface SectionQuestionnaire {
  sectionType: MemoSectionType;
  questions: QuestionAnswer[];
}

export interface MemoSection {
  id: string;
  type: MemoSectionType;
  title: string;
  titleZh: string;
  status: SectionStatus;
  content: string;
}

export interface MemoDocument {
  id: string;
  projectId: string;
  sections: MemoSection[];
}

export interface Project {
  id: string;
  companyName: string;
  industry: string;
  uploadedFiles: UploadedFile[];
  stage: ProjectStage;
  language: Language;
  selectedModel: { provider: string; model: string };
  questionnaire?: SectionQuestionnaire[];
  memo?: MemoDocument;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sectionRef?: MemoSectionType;
  chipRef?: string;
  selectedText?: string;
  suggestedDiff?: { old: string; new: string };
  timestamp: number;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  models: ModelOption[];
  baseUrl?: string;
}

export interface CustomModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  enabled: boolean;
}

export interface UserSettings {
  providers: {
    [providerId: string]: {
      apiKey: string;
      enabled: boolean;
      baseUrl?: string;
    };
  };
  customModels: CustomModelConfig[];
  defaultModel: { provider: string; model: string };
  language: Language;
  promptOverrides: Record<string, { en: string; zh: string }>;
}
