# DD Agent 开发接续 Prompt

请直接复制下面的内容作为新对话的第一条消息：

---

## 任务

继续开发 DD Agent 投资 Memo 智能生成器 Web 应用。项目基础架构和部分组件已完成，需要继续完成剩余的 UI 组件和页面，让整个流程跑通。

## 项目位置

`/Users/cinder/Desktop/DataElem/60_Oversea/2026_DD Agent/dd-agent/`

这是一个 Next.js 14 (App Router) + TypeScript 项目，**不使用 Tailwind**（纯 CSS）。

## 已安装的依赖

```
next, react, react-dom, typescript
@tiptap/react, @tiptap/starter-kit, @tiptap/pm
@tiptap/extension-placeholder, @tiptap/extension-highlight
@tiptap/extension-underline, @tiptap/extension-text-align, @tiptap/extension-heading
zustand, uuid, @types/uuid
```

## ✅ 已完成的文件（不需要修改，直接使用）

### 数据层 (`src/lib/`)
- **`types.ts`** — 全部 TypeScript 类型定义（Project, MemoDocument, MemoSection, ChatMessage, GuidedChip, UserSettings, Language, ProviderConfig 等）
- **`constants.ts`** — 常量配置：PROVIDERS 多模型列表（OpenAI/Anthropic/Google/Moonshot/DeepSeek）、INDUSTRIES 行业列表、MEMO_SECTIONS 7个章节定义、`getDefaultGuidedChips()` 每章节引导按钮
- **`prompts.ts`** — 7个 MEMO 章节的 AI Prompt 模板（中英文双语）：`getSystemPrompt()`, `getSectionPrompt()`, `getRefinePrompt()`, `getChipActionPrompt()`
- **`settingsStore.ts`** — Zustand 设置 Store：API Key 管理、模型选择、语言切换、`getAvailableModels()` 方法、LocalStorage 持久化
- **`projectStore.ts`** — Zustand 项目 Store：项目 CRUD、MEMO 章节内容更新（`updateSectionContent`, `updateAllSections`）、对话消息管理、LocalStorage 持久化

### 样式 (`src/app/`)
- **`globals.css`** — 完整的 Notion 风格设计系统（1317 行），所有组件的 CSS 类已定义好：
  - 布局：`.app-layout`, `.app-header`, `.editor-layout`, `.editor-main`, `.editor-content`
  - 按钮：`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`
  - 输入：`.input`, `.input-group`, `.input-label`, `.input-select`, `.lang-toggle`
  - 创建页：`.create-page`, `.create-card`, `.create-title`, `.create-form`
  - 文件上传：`.file-upload-zone`, `.file-item`, `.file-list`
  - 生成页：`.generating-page`, `.generating-steps`, `.progress-bar`
  - 编辑器：`.memo-section`, `.memo-section-title`, `.memo-section-content`
  - 引导芯片：`.guided-chips`, `.guided-chip`, `.high-priority`
  - 对话面板：`.chat-panel`, `.chat-message`, `.chat-bubble`, `.chat-input-area`, `.chat-action-panel`
  - 设置弹窗：`.settings-overlay`, `.settings-modal`, `.provider-card`
  - 模型选择器：`.model-selector`, `.model-dropdown`
  - 浮动工具栏：`.floating-toolbar`, `.floating-toolbar-btn`
  - 首页：`.home-page`, `.project-card`, `.empty-state`
  - 章节导航：`.section-nav`, `.section-nav-item`
  - 动画：`messageIn`, `fadeIn`, `modalIn`, `typingBounce`, `spin`

### 已完成的组件 (`src/components/`)
- **`FileUpload.tsx`** — 文件上传组件：拖拽上传、FileReader 读取文本、文件列表展示、支持 PDF/Excel/Word/PPTX
- **`GuidedChips.tsx`** — 引导按钮组件：渲染每章节的引导式优化按钮，支持 high-priority 样式
- **`SectionNav.tsx`** — 底部章节导航：7 个章节快速跳转，显示状态图标（✅/✓/⟳/○）

### 布局
- **`layout.tsx`** — 已更新为正确的根布局（DD Agent 标题 + 描述）

## ❌ 需要创建的文件

### 页面（按优先级）

#### 1. `src/app/page.tsx` — 首页（项目列表页）
- **当前状态**：还是 Next.js 默认模板，需要完全替换
- 需要 `'use client'`
- 展示已有项目列表（从 `useProjectStore` 读取）
- 每个项目显示：公司名、行业、阶段徽章、最后更新时间
- 点击项目 → 跳转到 `/editor/[id]`
- "新建项目"按钮 → 跳转到 `/create`
- 空状态提示
- 页面加载时调用 `loadFromStorage()` 加载持久化数据
- 使用 CSS 类：`.home-page`, `.home-title`, `.project-list`, `.project-card`, `.empty-state`

#### 2. `src/app/create/page.tsx` — 创建项目页
- 需要 `'use client'`
- 表单：公司名（必填）、行业（下拉选择，用 INDUSTRIES 常量）、文件上传（用 FileUpload 组件）、语言切换（EN/中文）
- 点击 "Generate MEMO" → 调用 `createProject()`，将文件添加到项目，然后跳转到 `/editor/[id]`
- 使用 CSS 类：`.create-page`, `.create-card`, `.create-title`, `.create-form`, `.lang-toggle`

#### 3. `src/app/editor/[id]/page.tsx` — 主编辑器页面（核心页面）
- 需要 `'use client'`
- 从 URL params 获取项目 ID，加载项目数据
- **双面板布局**：左侧 MEMO 文档编辑器 + 右侧 AI 对话面板
- 顶部 Header（用 Header 组件）
- 底部 SectionNav（用 SectionNav 组件）
- 管理编辑器和对话面板之间的交互（引导选项点击 → 对话面板响应）
- 首次进入且项目 stage 为 'uploading' 时，自动触发 MEMO 生成
- 使用 CSS 类：`.editor-layout`, `.editor-main`, `.editor-content`

#### 4. `src/app/api/generate/route.ts` — AI 生成 API Route
- 接受 POST 请求，body 包含：`{ provider, model, apiKey, baseUrl?, messages }`
- 根据 provider 构造 OpenAI 兼容的 API 请求（所有模型都通过 OpenAI SDK 格式调用）
- 各 provider 的 baseURL：
  - OpenAI: `https://api.openai.com/v1`
  - Anthropic: `https://api.anthropic.com/v1`（需要特殊处理 header: `x-api-key` + `anthropic-version`）
  - Google: 需要转换为 Gemini API 格式或使用 OpenAI 兼容端点
  - Moonshot: `https://api.moonshot.cn/v1`
  - DeepSeek: `https://api.deepseek.com/v1`
- **支持流式输出**（Server-Sent Events），让前端边生成边展示
- 返回 ReadableStream

### 组件

#### 5. `src/components/Header.tsx` — 顶部导航栏
- Logo "DD Agent"
- 面包屑导航（项目名）
- 模型选择下拉菜单（显示所有已配置 API Key 的可用模型）
- 语言切换按钮（EN/中文）
- 设置按钮（打开 SettingsModal）
- 导出 PDF 按钮
- 使用 CSS 类：`.app-header`, `.app-logo`, `.breadcrumb`, `.model-selector`, `.model-dropdown`

#### 6. `src/components/MemoEditor.tsx` — MEMO 文档编辑器
- 展示 7 个章节内容
- 每个章节：标题 + 状态徽章 + 可编辑内容区 + 底部引导按钮（GuidedChips 组件）
- 内容区域可直接编辑文本（contentEditable 或 TipTap）
- MVP 可以先用 contentEditable + `onBlur` 保存，不一定要用 TipTap
- 文本选中时显示浮动工具栏
- 使用 CSS 类：`.memo-section`, `.memo-section-header`, `.memo-section-title`, `.memo-section-content`, `.memo-section-status`

#### 7. `src/components/ChatPanel.tsx` — 右侧 AI 对话面板
- 显示对话消息列表
- 底部输入框 + 发送按钮
- 支持引导选项点击后的交互面板（文本输入框/选项按钮/表单，根据 chip.actionType 决定）
- 点击发送 → 调用 `/api/generate` API → 流式展示 AI 回复
- AI 回复完成后，如果有 sectionRef，自动更新对应章节内容
- 使用 CSS 类：`.chat-panel`, `.chat-header`, `.chat-messages`, `.chat-message`, `.chat-bubble`, `.chat-input-area`, `.chat-action-panel`

#### 8. `src/components/SettingsModal.tsx` — 设置弹窗
- 显示所有模型供应商（OpenAI, Anthropic, Google, Moonshot, DeepSeek）
- 每个供应商：名称 + 状态徽章（已连接/未连接）+ API Key 输入框 + 可选的 Base URL
- 默认模型选择
- 使用 CSS 类：`.settings-overlay`, `.settings-modal`, `.settings-header`, `.settings-body`, `.provider-card`

#### 9. `src/components/FloatingToolbar.tsx` — 浮动工具栏
- 当用户在 MEMO 编辑器中选中文本时出现
- 按钮：AI 改写、展开、简化、调整语气
- 点击后将选中文本和操作发送到 ChatPanel
- 使用 CSS 类：`.floating-toolbar`, `.floating-toolbar-btn`

## 产品设计要点

### 核心工作流
1. 用户创建项目 → 输入公司名 + 行业 + 上传 Pitch Deck
2. AI **立即**解析文件并生成 7 章节基础 MEMO（不要先做长对话收集信息）
3. 进入双面板编辑模式 → 左侧 MEMO 文档编辑器 + 右侧 AI 对话
4. 每个章节底部显示 **引导式点选按钮（Guided Chips）**，如"添加竞品"、"输入收入数据"
5. 用户点击按钮 → 右侧 Chat 弹出针对性的交互（选项/表单/文本输入）
6. AI 根据补充信息更新对应章节
7. 导出 PDF

### MEMO 7 个章节
1. **Deal Overview** — 3段：公司简介 + 核心业务 + 融资概况
2. **Highlights** — 4-6个 bullet points，粗体标题+证据
3. **Team Composition** — 核心成员，极简信号风格
4. **Market & Competitive Advantage** — 市场(TAM/CAGR) + 竞品对比 + 差异化
5. **Model & Product Details** — 5层：核心产品→产品栈→领先因素→延伸→未来
6. **Financial Projection** — 3段：商业化现状 + 增长预测 + 回报分析
7. **Appendix** — 相关新闻链接

### 设计风格
- **Notion 风格** — 极简、干净、高级感、注重写作体验
- 浅色主题（#ffffff 白 + #fbfbfa 浅灰）
- 文字 #37352f，辅助 #787774，强调 #2383e2 蓝
- 所有 CSS 类名已在 globals.css 中定义好，直接使用即可
- 微交互动画已定义（消息滑入、弹窗缩放、打字指示器等）

### 多模型支持
- 前端：模型选择下拉菜单
- 设置页：配置各供应商的 API Key
- API Route：根据选择的模型调用对应的 LLM
- **简化方案**：所有非 Anthropic 模型都通过 OpenAI SDK 格式（baseURL 适配）调用；Anthropic 单独处理

### 数据持久化
- MVP 阶段使用 **LocalStorage**
- `projectStore.loadFromStorage()` 和 `settingsStore.loadFromStorage()` 在页面加载时调用

## 注意事项
1. **不使用 Tailwind CSS**，所有样式使用 globals.css 中已定义好的类名
2. 所有组件添加 `'use client'` 指令（Next.js App Router）
3. 先让整个流程跑通（创建项目 → 上传文件 → 生成 MEMO → 编辑 → 对话），再优化细节
4. AI 生成 MEMO 时使用流式输出（SSE），边生成边展示
5. 可以删除 `src/app/page.module.css`，不需要了
6. 请先 `cat package.json` 确认依赖，读取已有的 `src/lib/*.ts`、`src/components/*.tsx` 和 `src/app/globals.css` 文件了解现有代码，然后开始创建剩余文件

## 执行顺序建议
1. 创建 `Header.tsx` 和 `SettingsModal.tsx`（被其他页面依赖）
2. 创建 `MemoEditor.tsx` 和 `ChatPanel.tsx`（核心组件）
3. 创建 `FloatingToolbar.tsx`
4. 替换 `page.tsx`（首页）
5. 创建 `create/page.tsx`（创建页）
6. 创建 `editor/[id]/page.tsx`（编辑器页）
7. 创建 `api/generate/route.ts`（API 路由）
8. 运行 `npm run dev` 验证

请开始工作。
