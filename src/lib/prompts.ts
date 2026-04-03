import { MemoSectionType, Language, SectionQuestionnaire } from './types';
import { SECTION_FRAMEWORKS } from './constants';

const SYSTEM_PROMPT_EN = `You are a senior investment analyst at a top-tier venture capital fund. You are writing a professional investment memorandum (MEMO) for internal use. 

Style requirements:
- Concise, professional, data-driven
- Avoid generic claims and marketing language
- Focus on concrete facts and evidence
- Use specific numbers when available
- Do NOT use any markdown formatting: no **bold**, no # headers, no bullet points with -, no numbered lists with 1., no backticks. Use plain text only with natural paragraph breaks.
- English output`;

const SYSTEM_PROMPT_ZH = `你是一位顶级风投基金的资深投资分析师。你正在撰写一份供内部使用的专业投资备忘录（MEMO）。

风格要求：
- 简洁、专业、数据驱动
- 避免泛化描述和营销语言
- 聚焦具体事实和证据
- 尽量使用具体数字
- 禁止使用任何 markdown 格式：不要用 **加粗**，不要用 # 标题，不要用 - 列表，不要用 1. 编号列表，不要用反引号。只使用纯文本，用自然段落分隔。
- 中文输出`;

export function getSystemPrompt(language: Language): string {
  return language === 'zh' ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
}

// ============ STEP 1: Pre-fill questionnaire from pitch deck ============

export function getPreFillPrompt(
  language: Language,
  extractedInfo: string,
  allQuestions: { sectionType: MemoSectionType; questions: { id: string; question: string; questionZh: string }[] }[]
): string {
  const questionList = allQuestions.flatMap((section) =>
    section.questions.map((q) => `- ${q.id}: ${language === 'zh' ? q.questionZh : q.question}`)
  ).join('\n');

  if (language === 'zh') {
    return `分析以下公司资料，尝试回答下列问题。如果资料中找不到某个问题的答案，请将该问题的值设为空字符串 ""。

回答要简洁、客观，直接引用原文数据和事实。不要编造信息。

问题列表：
${questionList}

请以 JSON 格式返回，格式为 {"questionId": "answer", ...}。
仅返回 JSON，无其他文字。

公司资料：
${extractedInfo}`;
  }

  return `Analyze the following company materials and try to answer each question below. If information for a question is not available in the materials, set its value to an empty string "".

Be concise, factual, and quote data from the source. Do not fabricate information.

Questions:
${questionList}

Return your answers as a JSON object: {"questionId": "answer", ...}.
Return ONLY the JSON, no other text.

Company materials:
${extractedInfo}`;
}

/**
 * Generate a prompt for answering a SINGLE question from the pitch deck.
 * This is used in the per-question pre-fill flow for higher accuracy.
 */
export function getSingleQuestionPreFillPrompt(
  language: Language,
  extractedInfo: string,
  question: string,
  previousAnswers: { question: string; answer: string }[]
): string {
  const prevContext = previousAnswers.length > 0
    ? previousAnswers.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
    : '';

  if (language === 'zh') {
    return `分析以下公司资料，回答一个问题。

规则：
- 简洁、客观、引用原文数据
- 不要编造信息
- 如果资料中确实找不到相关信息，只回复 "N/A"
- 直接回答问题内容，不要重复问题本身
- 不要加前缀（如"答："、"A:"等）
${prevContext ? `\n已知信息（供参考，避免重复）：\n${prevContext}\n` : ''}
问题：${question}

公司资料：
${extractedInfo}`;
  }

  return `Analyze the following company materials to answer ONE question.

Rules:
- Be concise, factual, and quote data from the source
- Do NOT fabricate information
- If the information is genuinely not available in the materials, reply with just "N/A"
- Answer the question directly, do not repeat the question
- Do not add prefixes like "A:" or "Answer:"
${prevContext ? `\nPrevious answers (for context, avoid repetition):\n${prevContext}\n` : ''}
Question: ${question}

Company materials:
${extractedInfo}`;
}

// ============ STEP 1: Batch pre-fill per section ============

export function getSectionPreFillPrompt(
  language: Language,
  extractedInfo: string,
  sectionTitle: string,
  questions: { id: string; question: string; questionZh: string }[]
): string {
  const questionList = questions
    .map((q) => `- ${q.id}: ${language === 'zh' ? q.questionZh : q.question}`)
    .join('\n');

  if (language === 'zh') {
    return `分析以下公司资料，回答「${sectionTitle}」章节的所有问题。

规则：
- 简洁、客观，尽量引用原文数据和事实
- 不要编造信息
- 如果资料中确实找不到某个问题的答案，将该题的值设为 "N/A"
- 直接给出答案内容，不要重复问题或加前缀

问题列表：
${questionList}

以 JSON 格式返回，key 为题号（如 "do_q1"），value 为答案字符串。
仅返回 JSON，不要加其他文字或 markdown 代码块。

公司资料：
${extractedInfo}`;
  }

  return `Analyze the following company materials to answer all questions for the "${sectionTitle}" section.

Rules:
- Be concise, factual, and quote data from the source
- Do NOT fabricate information
- If information for a question is not found in the materials, set its value to "N/A"
- Answer directly without repeating the question or adding prefixes

Questions:
${questionList}

Return a JSON object with question IDs as keys and answer strings as values (e.g. {"do_q1": "answer..."}).
Return ONLY the JSON, no other text or markdown code blocks.

Company materials:
${extractedInfo}`;
}

// ============ STEP 1: Gap analysis ============

export function getInfoGapPrompt(
  language: Language,
  questionnaire: SectionQuestionnaire[],
  companyName: string
): string {
  const filled: string[] = [];
  const missing: string[] = [];

  questionnaire.forEach((section) => {
    section.questions.forEach((q) => {
      const label = language === 'zh' ? q.questionZh : q.question;
      if (q.answer.trim()) {
        filled.push(`✓ ${label}`);
      } else {
        missing.push(`✗ ${label}`);
      }
    });
  });

  if (language === 'zh') {
    return `你在帮助准备 ${companyName} 的投资备忘录。以下是信息采集情况：

已获得的信息（${filled.length}项）：
${filled.join('\n')}

${missing.length > 0 ? `缺失的信息（${missing.length}项）：
${missing.join('\n')}

请简要总结当前信息的完整度，并指出最重要的2-3个缺失信息项。建议用户优先补充这些内容。所有问题均为非必填项，但补充更多信息可以生成更高质量的 MEMO。` : '信息很完整！可以开始生成 MEMO 了。'}`;
  }

  return `You are helping prepare an investment memo for ${companyName}. Here is the current information status:

Information gathered (${filled.length} items):
${filled.join('\n')}

${missing.length > 0 ? `Missing information (${missing.length} items):
${missing.join('\n')}

Please briefly summarize the completeness of the current information and highlight the 2-3 most important missing items. Suggest the user prioritize these. All questions are optional, but more information leads to a higher quality MEMO.` : 'Information looks comprehensive! Ready to generate the MEMO.'}`;
}

// ============ STEP 2: Default prompt template (for display in Settings) ============

export function getDefaultPromptTemplate(
  sectionType: MemoSectionType,
  language: Language,
): string {
  const framework = SECTION_FRAMEWORKS[sectionType];
  const purpose = language === 'zh' ? framework.purposeZh : framework.purpose;

  if (language === 'zh') {
    return `你正在为 {公司名称}（{行业}）撰写投资备忘录中的"${sectionType}"章节。

本章节目的：${purpose}

请用中文撰写。
重要：不要在输出中包含章节标题或标题行。只输出正文内容。

重要：禁止使用任何 markdown 格式。不要用 **加粗**，不要用 # 标题，不要用 - 列表，不要用 1. 编号列表，不要用反引号。只使用纯文本，用自然段落分隔。

根据以下收集到的信息，撰写一段专业、数据驱动的内容。使用所有可用的事实和数据。如果信息缺失，可以做合理推断但要标注不确定性。`;
  }

  return `You are writing the "${sectionType}" section of an investment memo for {companyName} ({industry}).

Purpose of this section: ${purpose}

Write in English.
IMPORTANT: Do NOT include any section title or header in your output. Only output the section body content.

IMPORTANT: Do NOT use any markdown formatting. No **bold**, no # headers, no bullet lists, no numbered lists, no backticks. Write in plain text with natural paragraph breaks only.

Based on the following collected information, write a professional, data-driven section. Use all available facts and figures. If information is missing, make reasonable inferences but flag uncertainties.`;
}

// ============ STEP 2: Section generation from questionnaire answers ============

export function getSectionPrompt(
  sectionType: MemoSectionType,
  language: Language,
  context: {
    companyName: string;
    industry: string;
    questionnaireAnswers: { question: string; answer: string }[];
    extractedInfo?: string;
  },
  overridePrompt?: string
): string {
  const framework = SECTION_FRAMEWORKS[sectionType];
  const langNote = language === 'zh' ? '请用中文撰写。' : 'Write in English.';
  const noTitleNote = language === 'zh'
    ? '重要：不要在输出中包含章节标题或标题行。只输出正文内容。'
    : 'IMPORTANT: Do NOT include any section title or header in your output. Only output the section body content.';

  // Format Q&A context
  const qaContext = context.questionnaireAnswers
    .filter((qa) => qa.answer.trim())
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  if (overridePrompt) {
    // User customized prompt
    return `${overridePrompt}

${langNote}
${noTitleNote}

Company: ${context.companyName} (${context.industry})

Collected information:
${qaContext || 'No specific answers provided.'}

${context.extractedInfo ? `\nAdditional materials:\n${context.extractedInfo}` : ''}`;
  }

  const purpose = language === 'zh' ? framework.purposeZh : framework.purpose;

  return `You are writing the "${sectionType}" section of an investment memo for ${context.companyName} (${context.industry}).

Purpose of this section: ${purpose}

${langNote}
${noTitleNote}

IMPORTANT: Do NOT use any markdown formatting. No **bold**, no # headers, no bullet lists, no numbered lists, no backticks. Write in plain text with natural paragraph breaks only.

Based on the following collected information, write a professional, data-driven section. Use all available facts and figures. If information is missing, make reasonable inferences but flag uncertainties.

Collected information:
${qaContext || 'No specific answers provided. Generate reasonable placeholder content based on available context.'}

${context.extractedInfo ? `\nAdditional raw materials:\n${context.extractedInfo}` : ''}`;
}

// ============ Refine/edit prompt ============

export function getRefinePrompt(
  sectionType: MemoSectionType,
  currentContent: string,
  instruction: string,
  language: Language
): string {
  const langNote = language === 'zh' ? '请用中文回复。' : 'Reply in English.';
  const noTitleNote = language === 'zh'
    ? '不要在输出中包含章节标题。只输出修改后的正文内容。'
    : 'Do NOT include any section title in your output. Only output the revised section body.';

  return `You are editing the "${sectionType}" section of an investment MEMO. ${langNote}
${noTitleNote}

Current content:
---
${currentContent}
---

User instruction: ${instruction}

IMPORTANT: Do NOT use any markdown formatting. No **bold**, no # headers, no bullet lists, no numbered lists, no backticks. Write in plain text only.

Please provide the updated section content. Only output the revised section text, nothing else.`;
}

// ============ Chat action prompt (for chip-like actions, kept for compatibility) ============

export function getChipActionPrompt(
  chipId: string,
  sectionType: MemoSectionType,
  currentContent: string,
  userInput: string,
  language: Language
): string {
  const langNote = language === 'zh' ? '请用中文回复。' : 'Reply in English.';
  return `You are refining the "${sectionType}" section of an investment MEMO based on a specific action. ${langNote}

Current section content:
---
${currentContent}
---

Action: ${chipId}
User provided: ${userInput}

Update the section content accordingly. Only output the complete revised section text. Do NOT include section headers.`;
}
