# Bug Fix Prompt — DD Agent

## 项目背景

DD Agent 是一个**投资备忘录（Investment Memo）AI 生成平台**，面向投资机构的分析师使用。用户上传公司的 Pitch Deck（PDF/文本），AI 基于文件内容自动生成一份结构化的投资评估报告。

### 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **状态管理**: Zustand（持久化到 localStorage）
- **样式**: 原生 CSS（`globals.css`），设计风格参考 writer.com，极简、现代、黑白色调
- **LLM 接入**: 支持 OpenAI / Anthropic / Google / 自定义 OpenAI 兼容 API（如 Qwen），通过 `/api/generate` 路由做流式代理转发
- **多语言**: 支持中文 / 英文切换

### 核心工作流（三步流程）

1. **Step 1 — 信息采集 (Info Gathering / Reviewing)**
   - 用户创建项目（填写公司名、行业）并上传 Pitch Deck
   - 进入编辑器后，左侧展示一份**问卷表单**（8 个章节，共 56 个问题）
   - AI 自动从上传的文件中提取信息，**逐题预填**到问卷的文本框中（预填的答案会标记绿色 "AI" 标签）
   - 右侧是 AI Chat 助手，可以对话补充信息
   - 所有问题均为非必填项，用户确认后进入下一步

2. **Step 2 — 生成 MEMO (Generating)**
   - AI 基于问卷中收集到的结构化信息，**逐章节流式生成**投资备忘录
   - 左侧为 Word 风格的文档编辑器，生成的内容实时流入对应章节
   - 右侧仍然是 Chat 助手

3. **Step 3 — 编辑导出 (Editing/Export)**
   - 用户可以在左侧编辑器中直接修改文本
   - 点击某段落可以在右侧 Chat 中输入修改意见，AI 返回新内容后可一键替换

### 8 个章节框架

| 章节 | 英文名 | 中文名 |
|------|--------|--------|
| 1 | Deal Overview | 项目概览 |
| 2 | Team Composition | 团队构成 |
| 3 | Model & Product Details | 模型与产品 |
| 4 | Market & Competitive Advantage | 市场与竞争优势 |
| 5 | Business & Financials | 商业与财务 |
| 6 | Return Analysis | 回报分析 |
| 7 | Reasons to Invest | 投资理由 |
| 8 | Risk Factors | 风险因素 |

### 关键文件结构

```
src/
├── app/
│   ├── globals.css              # 全局样式
│   ├── page.tsx                 # 首页（项目列表）
│   ├── create/page.tsx          # 创建项目页
│   ├── editor/[id]/page.tsx     # 核心编辑器页面（三步流程主逻辑）
│   └── api/generate/route.ts   # LLM 流式代理 API
├── components/
│   ├── Header.tsx               # 顶栏（Logo、模型选择、语言切换、设置）
│   ├── MemoEditor.tsx           # 左侧文档编辑器（逐章节展示内容）
│   ├── ChatPanel.tsx            # 右侧 AI 对话面板
│   ├── QuestionnairePanel.tsx   # Step 1 问卷面板
│   ├── SectionNav.tsx           # 章节导航侧栏
│   ├── FloatingToolbar.tsx      # 选中文本后的浮动操作栏
│   ├── SettingsModal.tsx        # 设置弹窗（API 配置 + 提示词配置）
│   └── Icons.tsx                # SVG 图标组件集
└── lib/
    ├── types.ts                 # TypeScript 类型定义
    ├── constants.ts             # 8 章节定义 + 问卷问题集
    ├── prompts.ts               # 所有 AI 提示词模板
    ├── projectStore.ts          # Zustand 项目状态管理
    └── settingsStore.ts         # Zustand 设置状态管理
```

### 状态管理要点

- **projectStore.ts**: 管理项目列表、问卷数据、Memo 文档内容、Chat 消息。通过 `saveToStorage()` 持久化到 localStorage（已排除大文件内容以避免超限）。
- **settingsStore.ts**: 管理 API Key、模型选择、语言偏好、每章节自定义提示词 (promptOverrides)。
- 项目的 `stage` 字段控制 UI 显示哪个步骤：`'reviewing'` → `'generating'` → `'editing'`

---

请修复以下两个 Bug：

---

## Bug 1: AI 预填问卷后，答案没有显示在 Info Gathering 的输入框中

### 问题根因

`src/lib/projectStore.ts` 中的 `updateQuestionAnswer` 函数（约第121行）在更新答案时硬编码了 `autoFilled: false`：

```typescript
// 当前代码（有 bug）:
questions: sq.questions.map((q) =>
  q.id === questionId ? { ...q, answer, autoFilled: false } : q
),
```

而 `src/components/QuestionnairePanel.tsx` 中用 `autoFilled` 来判断是否显示 "AI" 标签。更关键的是，当 AI 预填调用 `updateQuestionAnswer` 时，`autoFilled` 被设置为 `false`，这导致 UI 无法正确标记 AI 填充的内容。

### 修复方案

1. **修改 `projectStore.ts` 的接口和实现**：给 `updateQuestionAnswer` 添加一个可选的 `autoFilled` 参数（默认 `false`，这样用户手动编辑时不受影响）：

```typescript
// 接口定义（约第38行）:
updateQuestionAnswer: (projectId: string, sectionType: MemoSectionType, questionId: string, answer: string, autoFilled?: boolean) => void;

// 实现（约第121行）:
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
```

2. **修改 `src/app/editor/[id]/page.tsx` 中的预填调用**：在 `preFillQuestionnaire` 函数里调用 `updateQuestionAnswer` 时，传入 `true` 作为第五个参数：

```typescript
// 约第196行，将:
updateQuestionAnswer(projectId, q.sectionType, q.id, answer);
// 改为:
updateQuestionAnswer(projectId, q.sectionType, q.id, answer, true);
```

---

## Bug 2: Previous / Next 按钮太丑，需要删除，改为步骤数字可点击切换

### 当前问题

`src/app/editor/[id]/page.tsx` 中的 step-indicator 区域（约第392-432行）有两个 `<button className="step-nav-btn">` 按钮（"上一步" / "下一步"），样式不好看。

### 修复方案

删除这两个 button，去掉外层包裹的 `<div className="step-indicator-steps">`，把导航逻辑直接放到每个 step 的 `<div>` 上，让用户点击步骤数字 1/2/3 即可跳转。

将整个 step-indicator 替换为：

```tsx
{/* Step indicator */}
<div className="step-indicator">
  <div
    className={`step clickable ${isReviewing ? 'active' : (isGenerating || isEditing) ? 'done' : ''}`}
    onClick={() => updateProjectStage(projectId, 'reviewing')}
  >
    <span className="step-number">{(isGenerating || isEditing) ? <IconCheck size={12} /> : '1'}</span>
    <span className="step-label">{isZh ? '信息采集' : 'Info Gathering'}</span>
  </div>
  <div className="step-divider" />
  <div
    className={`step clickable ${isGenerating ? 'active' : isEditing ? 'done' : ''}`}
    onClick={() => {
      if (isReviewing) {
        generateAllSections();
      } else {
        updateProjectStage(projectId, 'generating');
      }
    }}
  >
    <span className="step-number">{isEditing ? <IconCheck size={12} /> : '2'}</span>
    <span className="step-label">{isZh ? '生成 MEMO' : 'Generate MEMO'}</span>
  </div>
  <div className="step-divider" />
  <div
    className={`step clickable ${isEditing ? 'active' : ''}`}
    onClick={() => {
      if (isGenerating || isReviewing) {
        updateProjectStage(projectId, 'editing');
      }
    }}
  >
    <span className="step-number">3</span>
    <span className="step-label">{isZh ? '导出' : 'Export'}</span>
  </div>
</div>
```

同时在 `src/app/globals.css` 的 step-indicator 样式区域追加：

```css
.step.clickable {
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease);
}

.step.clickable:hover {
  opacity: 0.7;
}
```

并删除 `.step-nav-btn` 和 `.step-indicator-steps` 相关的所有 CSS（如果存在的话）。

---

## 验证方式

1. 创建一个新项目并上传 PDF 文件
2. 进入 Info Gathering 页面后，确认 AI 预填的答案出现在各个输入框中，并且旁边有绿色 "AI" 标签
3. 确认没有 Previous / Next 按钮，步骤数字 1、2、3 可以直接点击切换
