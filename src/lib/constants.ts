import { ProviderConfig, MemoSectionType, QuestionAnswer } from './types';

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
      { id: 'o1', name: 'o1', provider: 'openai' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    models: [
      { id: 'moonshot-v1-128k', name: 'Kimi (128k)', provider: 'moonshot' },
    ],
    baseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek' },
    ],
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen' },
      { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', provider: 'qwen' },
      { id: 'qwen-long', name: 'Qwen Long', provider: 'qwen' },
    ],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
];

export const INDUSTRIES = [
  { value: 'ai_ml', label: 'AI / Machine Learning', labelZh: '人工智能 / 机器学习' },
  { value: 'saas', label: 'SaaS / Enterprise Software', labelZh: 'SaaS / 企业软件' },
  { value: 'fintech', label: 'Fintech', labelZh: '金融科技' },
  { value: 'healthtech', label: 'Health Tech', labelZh: '医疗科技' },
  { value: 'ecommerce', label: 'E-Commerce', labelZh: '电子商务' },
  { value: 'edtech', label: 'Education Tech', labelZh: '教育科技' },
  { value: 'gaming', label: 'Gaming', labelZh: '游戏' },
  { value: 'hardware', label: 'Hardware / Semiconductors', labelZh: '硬件 / 半导体' },
  { value: 'biotech', label: 'Biotech', labelZh: '生物技术' },
  { value: 'cleantech', label: 'Clean Energy / Climate', labelZh: '清洁能源 / 气候' },
  { value: 'web3', label: 'Web3 / Crypto', labelZh: 'Web3 / 加密货币' },
  { value: 'media', label: 'Media / Content', labelZh: '媒体 / 内容' },
  { value: 'logistics', label: 'Logistics / Supply Chain', labelZh: '物流 / 供应链' },
  { value: 'other', label: 'Other', labelZh: '其他' },
];

export const MEMO_SECTIONS: { type: MemoSectionType; title: string; titleZh: string }[] = [
  { type: 'deal_overview', title: 'Deal Overview', titleZh: '项目概览' },
  { type: 'team_composition', title: 'Team Composition', titleZh: '团队构成' },
  { type: 'model_product', title: 'Model & Product Details', titleZh: '产品与技术' },
  { type: 'market_competitive', title: 'Market & Competitive Advantage', titleZh: '市场与竞争优势' },
  { type: 'business_financials', title: 'Business & Financials', titleZh: '商业与财务' },
  { type: 'return_analysis', title: 'Return Analysis', titleZh: '回报分析' },
  { type: 'reasons_to_invest', title: 'Reasons to Invest', titleZh: '投资理由' },
  { type: 'risk_factors', title: 'Risk Factors', titleZh: '风险因素' },
];

// ============ SECTION FRAMEWORKS ============
// Each section has a purpose (used in generation prompt) and a set of questions (used in Step 1 questionnaire)

export interface SectionFramework {
  purpose: string;
  purposeZh: string;
  questions: Omit<QuestionAnswer, 'answer' | 'autoFilled'>[];
}

export const SECTION_FRAMEWORKS: Record<MemoSectionType, SectionFramework> = {
  deal_overview: {
    purpose: 'Provide a fast, accurate snapshot of what the company is, why it exists, and why it matters now, so partners can immediately understand the opportunity without going into details.',
    purposeZh: '快速、准确地概述公司是什么、为什么存在、为什么现在重要，让合伙人无需深入细节即可理解机会。',
    questions: [
      { id: 'do_q1', question: 'Describe the company in one sentence (clear, factual, no marketing language).', questionZh: '用一句话描述公司（清晰、客观、不要营销语言）。' },
      { id: 'do_q2', question: 'What category does the company belong to, and what is the simplest way to understand its business model?', questionZh: '公司属于什么领域？最简单的商业模式理解方式是什么？' },
      { id: 'do_q3', question: 'What problem is being solved, and for whom (core user + buyer)?', questionZh: '解决了什么问题？为谁解决（核心用户 + 购买方）？' },
      { id: 'do_q4', question: 'Why does this company exist now (one or two key enabling factors)?', questionZh: '为什么这家公司现在出现（1-2个关键推动因素）？' },
      { id: 'do_q5', question: 'What stage is the company at today (product, revenue, team)?', questionZh: '公司目前处于什么阶段（产品、收入、团队）？' },
      { id: 'do_q6', question: 'What are the 2–3 key milestones already achieved?', questionZh: '已达成的2-3个关键里程碑是什么？' },
      { id: 'do_q7', question: 'What are the 1–2 most important upcoming milestones?', questionZh: '未来1-2个最重要的里程碑是什么？' },
      { id: 'do_q8', question: 'How much capital has been raised to date and what it was primarily used for?', questionZh: '迄今累计融资多少？主要用途是什么？' },
      { id: 'do_q9', question: 'Valuation for this round. Pre-money or Post-money. Target amount?', questionZh: '本轮估值。Pre-money 还是 Post-money？目标募资金额？' },
    ],
  },
  team_composition: {
    purpose: 'Summarize who is building the company and why they are credible, focusing on the most relevant backgrounds and roles so partners can quickly assess whether the team looks capable of executing.',
    purposeZh: '总结谁在建设公司、为什么他们可信，聚焦最相关的背景和角色，让合伙人快速评估团队执行力。',
    questions: [
      { id: 'tc_q1', question: 'Who are the founders and what are their most relevant prior roles or achievements?', questionZh: '创始人是谁？最相关的过往角色或成就是什么？' },
      { id: 'tc_q2', question: 'What is each founder\'s current role in the company?', questionZh: '每位创始人在公司的当前角色是什么？' },
      { id: 'tc_q3', question: 'What is the most relevant experience that directly maps to this business?', questionZh: '与该业务直接相关的最重要经验是什么？' },
      { id: 'tc_q4', question: 'How long has the team worked together and in what context?', questionZh: '团队合作了多久？在什么背景下合作？' },
      { id: 'tc_q5', question: 'What are the key hires or team strengths beyond the founders?', questionZh: '除创始人外的关键人员或团队优势是什么？' },
      { id: 'tc_q6', question: 'What are the obvious gaps in the current team (if any)?', questionZh: '当前团队有哪些明显的短板（如有）？' },
      { id: 'tc_q7', question: 'How large is the team today and how fast is it growing?', questionZh: '团队目前有多大？增长速度如何？' },
    ],
  },
  model_product: {
    purpose: 'Give a clear view of what the company has actually built and how the product works at a high level, highlighting key capabilities and evolution so partners can understand what is real versus conceptual.',
    purposeZh: '清楚展示公司实际构建了什么、产品如何运作，突出关键能力和演进，让合伙人理解哪些是真实的、哪些是概念性的。',
    questions: [
      { id: 'mp_q1', question: 'What is the core product today (1–2 lines, what it does)?', questionZh: '核心产品是什么（1-2行描述）？' },
      { id: 'mp_q2', question: 'What are the key capabilities or features that matter most?', questionZh: '最重要的关键能力或功能是什么？' },
      { id: 'mp_q3', question: 'What differentiates the product from alternatives (performance, cost, UX, etc.)?', questionZh: '产品与替代方案的差异化是什么（性能、成本、体验等）？' },
      { id: 'mp_q4', question: 'What stage is the product at (early, scaling, mature)?', questionZh: '产品处于什么阶段（早期、扩展、成熟）？' },
      { id: 'mp_q5', question: 'How has the product evolved to date (key versions or milestones)?', questionZh: '产品迄今如何演进（关键版本或里程碑）？' },
      { id: 'mp_q6', question: 'What is the typical use case or workflow for a user?', questionZh: '用户的典型使用场景或工作流程是什么？' },
      { id: 'mp_q7', question: 'What are current limitations or constraints of the product?', questionZh: '产品当前的局限性或约束是什么？' },
      { id: 'mp_q8', question: 'What are the next major product milestones?', questionZh: '下一个主要产品里程碑是什么？' },
    ],
  },
  market_competitive: {
    purpose: 'Outline the market the company operates in and its positioning within it, so partners can quickly grasp the size of the opportunity and where the company sits relative to competitors.',
    purposeZh: '概述公司所处市场及定位，让合伙人快速理解机会规模和公司在竞争中的位置。',
    questions: [
      { id: 'mc_q1', question: 'What market is the company in (simple definition)?', questionZh: '公司所处市场是什么（简单定义）？' },
      { id: 'mc_q2', question: 'Who are the target customers and main use cases?', questionZh: '目标客户和主要使用场景是什么？' },
      { id: 'mc_q3', question: 'How large is the opportunity (order of magnitude, not detailed model)?', questionZh: '市场机会有多大（量级，不需要详细模型）？' },
      { id: 'mc_q4', question: 'What existing solutions are being replaced or competed against?', questionZh: '正在替代或竞争的现有方案是什么？' },
      { id: 'mc_q5', question: 'Who are the key competitors (2–4 names) and how they differ?', questionZh: '主要竞争对手是谁（2-4个）？有何不同？' },
      { id: 'mc_q6', question: 'What is the company\'s main edge (technology, cost, distribution, etc.)?', questionZh: '公司的核心优势是什么（技术、成本、渠道等）？' },
      { id: 'mc_q7', question: 'Why this position is defensible (if applicable, briefly)?', questionZh: '为什么这个定位是可防御的（如适用，简述）？' },
      { id: 'mc_q8', question: 'How the market is expected to evolve over the next few years?', questionZh: '未来几年市场预计如何演变？' },
    ],
  },
  business_financials: {
    purpose: 'Summarize how the company makes money and its current scale, highlighting key metrics and growth trends so partners can understand traction and business momentum at a glance.',
    purposeZh: '总结公司如何盈利及当前规模，突出关键指标和增长趋势，让合伙人一眼了解业务动能。',
    questions: [
      { id: 'bf_q1', question: 'How does the company make money (pricing model and key revenue streams)?', questionZh: '公司如何赚钱（定价模式和关键收入来源）？' },
      { id: 'bf_q2', question: 'What is current revenue and recent growth trend?', questionZh: '当前收入和近期增长趋势是什么？' },
      { id: 'bf_q3', question: 'What are the main drivers of growth (users, pricing, expansion)?', questionZh: '增长的主要驱动因素是什么（用户、定价、扩张）？' },
      { id: 'bf_q4', question: 'What are the key operating metrics (users, engagement, conversion, etc.)?', questionZh: '关键运营指标是什么（用户数、活跃度、转化率等）？' },
      { id: 'bf_q5', question: 'What is the rough split across segments (if applicable)?', questionZh: '各业务线的大致比例是多少（如适用）？' },
      { id: 'bf_q6', question: 'What are the major cost drivers?', questionZh: '主要成本驱动因素是什么？' },
      { id: 'bf_q7', question: 'What are the forward revenue projections (next 1–2 years)?', questionZh: '未来1-2年的收入预测是什么？' },
      { id: 'bf_q8', question: 'What is the current burn and runway (if relevant)?', questionZh: '当前的消耗和续航情况（如相关）？' },
    ],
  },
  return_analysis: {
    purpose: 'Provide a simple view of potential investment outcomes and scenarios, giving partners a quick sense of upside, downside, and how returns could be realized.',
    purposeZh: '简单展示潜在投资回报和场景，让合伙人快速了解上行/下行空间及回报实现路径。',
    questions: [
      { id: 'ra_q1', question: 'What are the most likely exit paths (IPO, acquisition, other)?', questionZh: '最可能的退出路径是什么（IPO、并购、其他）？' },
      { id: 'ra_q2', question: 'What is a reasonable range of potential outcomes (low / base / high level)?', questionZh: '合理的潜在回报区间是什么（低/中/高）？' },
      { id: 'ra_q3', question: 'What are the key drivers of valuation in this business?', questionZh: '该业务估值的关键驱动因素是什么？' },
      { id: 'ra_q4', question: 'What comparable companies or outcomes are relevant references?', questionZh: '有哪些可参考的对标公司或案例？' },
      { id: 'ra_q5', question: 'What dilution or future fundraising is expected?', questionZh: '预计的稀释或未来融资情况？' },
      { id: 'ra_q6', question: 'What milestones would materially increase valuation?', questionZh: '哪些里程碑会大幅提升估值？' },
    ],
  },
  reasons_to_invest: {
    purpose: 'Highlight the key points that make the company compelling, distilling the main arguments into a concise set of takeaways for quick internal alignment.',
    purposeZh: '突出公司最具吸引力的要点，将核心论据提炼为简洁要点，便于内部快速对齐。',
    questions: [
      { id: 'ri_q1', question: 'What are the top 2–3 reasons this company is compelling?', questionZh: '公司最具吸引力的2-3个理由是什么？' },
      { id: 'ri_q2', question: 'What is the single strongest signal of traction or differentiation?', questionZh: '最强的单一牵引力或差异化信号是什么？' },
      { id: 'ri_q3', question: 'What makes this company stand out vs. competitors?', questionZh: '相比竞品，公司最突出的是什么？' },
      { id: 'ri_q4', question: 'Why this is interesting now (timing)?', questionZh: '为什么现在是好时机？' },
      { id: 'ri_q5', question: 'What could drive outsized upside?', questionZh: '什么因素可能带来超额回报？' },
    ],
  },
  risk_factors: {
    purpose: 'Surface the most important risks in a clear and concise way, ensuring partners are aware of key uncertainties before engaging further.',
    purposeZh: '清晰简洁地呈现最重要的风险，确保合伙人在进一步评估前了解关键不确定性。',
    questions: [
      { id: 'rf_q1', question: 'What are the top 2–3 risks to the business?', questionZh: '业务面临的2-3个最大风险是什么？' },
      { id: 'rf_q2', question: 'Where is execution most uncertain?', questionZh: '执行层面最大的不确定性在哪里？' },
      { id: 'rf_q3', question: 'What external factors could impact the company?', questionZh: '哪些外部因素可能影响公司？' },
      { id: 'rf_q4', question: 'What would cause the company to underperform expectations?', questionZh: '什么会导致公司表现低于预期？' },
      { id: 'rf_q5', question: 'What is the realistic downside scenario?', questionZh: '现实的下行场景是什么？' },
    ],
  },
};

// Build default questionnaire for a project
export function buildDefaultQuestionnaire(): { sectionType: MemoSectionType; questions: QuestionAnswer[] }[] {
  return MEMO_SECTIONS.map((section) => {
    const framework = SECTION_FRAMEWORKS[section.type];
    return {
      sectionType: section.type,
      questions: framework.questions.map((q) => ({
        ...q,
        answer: '',
        autoFilled: false,
      })),
    };
  });
}
