"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/types";

const en = {
  appName: "Stock Commentary Studio",
  appSub: "v2 · rebuilt from the 2025 CityU IS6620 project",
  disclaimer:
    "For learning and research only. Generated commentary can be wrong and is not investment advice. Check every figure against its source.",
  history: "History",
  noHistory: "No saved runs in this browser yet.",
  delete: "Delete",
  close: "Close",
  langToggle: "中文",
  theme: "Theme",

  inputTitle: "Input",
  tabText: "News text",
  tabSearch: "Search news",
  tabPdf: "PDF report",
  demos: "Demo cases",
  demosHint: "Demos open instantly with stored results and use no tokens. Editing the text makes it a custom input.",
  viewDemo: "Show demo result",
  regenerate: "Regenerate (uses API)",
  demoBanner: "Demo result. News dated {news}; generated on {date} with {provider}. Prices, headlines and commentary reflect that date, not today. Shown from a stored file: no API call, no tokens. Edit the input or press Regenerate to run it live.",
  demoDates: "News {news} · generated {date}",
  demoDatesPdf: "Published {news} · generated {date}",
  demosHintSearch: "Opens three pre-selected headlines with their stored result, no tokens. Changing the selection makes it a custom input.",
  demosHintPdf: "Opens the stored analysis of a public report, no tokens. The PDF is not bundled; download it from the source link and upload it to run live or ask questions.",
  pdfDemoMeta: "{publisher} · published {date} · {n} pages",
  pdfDemoSource: "Original PDF (official source)",
  demoBannerPdf: "Demo result for “{title}” ({publisher}, published {news}); generated on {date} with {provider}. Figures reflect that report, and market data reflects the generation date. Shown from a stored file: no API call, no tokens. To ask questions, download the original PDF and upload it.",
  demoSourceLink: "Original document",
  textPlaceholder: "Paste a financial news article or paragraph…",
  searchPlaceholder: "Company, ticker or topic, e.g. Tencent, 0700.HK, NVDA",
  search: "Search",
  searching: "Searching…",
  searchHint: "Pick one or more headlines to analyse together.",
  noResults: "No headlines found.",
  selected: "selected",
  pdfDrop: "Drop a PDF here or click to choose",
  pdfHint: "Parsed in your browser. Large reports use hybrid retrieval (BM25 + embeddings).",
  pdfParsing: "Parsing page {p} of {n}…",
  pdfPages: "{n} pages · {c} chunks · {k}k characters",
  pdfFull: "Fits in context: the whole document is analysed.",
  pdfRag: "Too long for full context: the most relevant chunks are retrieved.",
  pdfEmbedding: "Embedding {d}/{n} chunks…",
  pdfEmbedded: "Embeddings ready",
  pdfNoEmbed: "No Gemini key: lexical BM25 retrieval only.",
  pdfRemove: "Remove",

  settingsTitle: "Analysis",
  model: "Model",
  notConfigured: "not configured",
  noProviders: "No model API key is configured on the server. Add DEEPSEEK_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to .env.local (or Vercel env vars) and restart.",
  mode: "Mode",
  modeSingle: "Single view",
  modeDebate: "Bull vs Bear",
  stance: "Stance",
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
  strength: "Conviction",
  strong: "Strong",
  moderate: "Moderate",
  mild: "Mild",
  personas: "Analyst personas (up to 3)",
  personaNone: "Generalist",
  bullPersona: "Bull analyst style",
  bearPersona: "Bear analyst style",
  rebuttal: "Rebuttal round",
  rebuttalHint: "Each side answers the other's strongest points",
  deep: "Deep reasoning",
  deepHint: "Stronger model with visible thinking; slower",
  web: "Web research",
  webHint: "Tavily, Gemini search or Google News for the latest context",
  advanced: "Advanced",
  temperature: "Temperature",
  temperatureHint: "Only used by DeepSeek with deep reasoning off",
  outputLang: "Output language",
  run: "Generate commentary",
  stop: "Stop",
  accessCode: "Access code",
  accessCodeHint: "This deployment is protected. Enter the access code.",

  emptyTitle: "From one headline to a debated, cited view",
  emptyBody:
    "Paste news, search headlines or upload a report. The pipeline extracts the companies, pulls live prices and related coverage, lets analysts argue, then a reviewer scores the case.",
  step1: "Extract",
  step1d: "Companies, tickers and facts as structured data",
  step2: "Enrich",
  step2d: "Live quotes, related headlines, optional web research",
  step3: "Argue",
  step3d: "Persona analysts stream cited commentary, bull vs bear",
  step4: "Score",
  step4d: "A reviewer weighs the evidence into a scorecard",

  stage_extract: "Extract",
  stage_market: "Market data",
  stage_news: "Related news",
  stage_web: "Web research",
  stage_context: "Label sentiment",
  stage_analysts: "Analysts",
  stage_rebuttal: "Rebuttals",
  stage_kpis: "KPIs",
  stage_pm: "Scorecard",

  story: "The story",
  entities: "Entities",
  keyFacts: "Key facts",
  market: "Market snapshot",
  noQuotes: "No tradable symbol identified.",
  pe: "P/E",
  mcap: "Mkt cap",
  range52: "52w",
  evidence: "Evidence",
  evidenceHint: "Click a citation chip in the text to jump here.",
  lowRelevance: "low relevance",
  analysts: "Analysts",
  debate: "The debate",
  openings: "Opening statements",
  rebuttals: "Rebuttals",
  thinking: "Thinking",
  writing: "Writing…",
  waiting: "Waiting…",
  agentError: "This analyst failed",
  document: "Document review",
  kpis: "Key figures",
  kpiMetric: "Metric",
  kpiValue: "Value",
  kpiPeriod: "Period",
  kpiChange: "Change",
  kpiSource: "Source",
  ask: "Ask the document",
  askPlaceholder: "e.g. What drove the change in operating margin?",
  askSend: "Ask",
  askDemoNote: "Demo: these questions were answered ahead of time from the report, with page citations.",
  askDemoLocked: "Upload the original PDF to ask your own questions",
  scorecard: "Reviewer scorecard",
  verdict: "Verdict",
  conviction: "Conviction",
  dim_fundamentals: "Fundamentals",
  dim_momentum: "Momentum",
  dim_sentiment: "Sentiment",
  dim_valuation: "Valuation",
  dim_risk: "Risk",
  agreements: "Where they agree",
  disagreements: "Where they disagree",
  betterSupported: "Better supported",
  even: "Even",
  bull: "Bull",
  bear: "Bear",
  keyRisks: "Key risks",
  catalysts: "Catalysts",
  dataGaps: "Data gaps",
  exportMd: "Export Markdown",
  copied: "Copied",
  runMeta: "{s}s · {provider} · {models}",
  errorPrefix: "Something went wrong",
  err_invalid_access_code: "Access code is missing or wrong.",
  err_rate_limited: "Too many requests from this network. Try again later.",
  err_embeddings_unavailable: "Embeddings need a Gemini key on the server.",
  err_ascii_only: "Chinese search terms need a model key to translate. Try an English name or ticker, e.g. Tencent or 0700.HK.",
  err_quota: "API quota exceeded. Free-tier Gemini keys have low per-minute limits, and Google Search grounding may not be included. Wait a minute, turn off web research, or enable billing in Google AI Studio.",
  err_overloaded: "The model is overloaded right now. Try again shortly or switch model.",
  err_location: "Gemini is not available from this network location. Run with `npm run dev:proxy` (see README).",
};

type Dict = typeof en;

const zh: Dict = {
  appName: "股评工作台",
  appSub: "v2 · 基于 2025 年城大 IS6620 课程项目重制",
  disclaimer: "仅供学习研究。生成内容可能有误，不构成任何投资建议，请以原始来源核对每一个数字。",
  history: "历史",
  noHistory: "这个浏览器里还没有保存的记录。",
  delete: "删除",
  close: "关闭",
  langToggle: "EN",
  theme: "主题",

  inputTitle: "输入",
  tabText: "新闻文本",
  tabSearch: "搜索新闻",
  tabPdf: "PDF 报告",
  demos: "演示案例",
  demosHint: "演示案例直接展示已存好的结果，不消耗 token。修改文本后就变成自定义输入。",
  viewDemo: "查看演示结果",
  regenerate: "重新生成（调用 API）",
  demoBanner: "演示结果。新闻日期 {news}，于 {date} 用 {provider} 生成。其中的股价、新闻和观点都反映当时情况，不是今天的实时数据。结果读取自已存好的文件，不调用 API、不消耗 token。修改输入或点「重新生成」才会实时调用。",
  demoDates: "新闻 {news} · 生成于 {date}",
  demoDatesPdf: "发布于 {news} · 生成于 {date}",
  demosHintSearch: "打开后直接显示预先选好的 3 条新闻和已存好的结果，不消耗 token。改动选择后就变成自定义输入。",
  demosHintPdf: "打开后直接显示一份公开财报的分析结果，不消耗 token。PDF 原文没有打包，可从原文链接下载后上传，实时分析或提问。",
  pdfDemoMeta: "{publisher} · 发布于 {date} · 共 {n} 页",
  pdfDemoSource: "原文 PDF（官方来源）",
  demoBannerPdf: "演示结果：《{title}》（{publisher}，发布于 {news}），于 {date} 用 {provider} 生成。财务数字以该报告为准，行情数据反映生成当天。结果读取自已存好的文件，不调用 API、不消耗 token。想向文档提问，请下载原文 PDF 后上传。",
  demoSourceLink: "原文文档",
  textPlaceholder: "粘贴一段财经新闻或文章……",
  searchPlaceholder: "公司名、代码或主题，例如 腾讯、0700.HK、NVDA",
  search: "搜索",
  searching: "搜索中……",
  searchHint: "可选一条或多条标题一起分析。",
  noResults: "没有找到相关标题。",
  selected: "已选",
  pdfDrop: "拖入 PDF，或点击选择文件",
  pdfHint: "在浏览器本地解析。长报告使用混合检索（BM25 + 向量）。",
  pdfParsing: "正在解析第 {p} / {n} 页……",
  pdfPages: "{n} 页 · {c} 个分块 · {k}k 字符",
  pdfFull: "篇幅在上下文范围内：整篇文档都会被分析。",
  pdfRag: "篇幅超出上下文：只检索最相关的分块。",
  pdfEmbedding: "正在向量化 {d}/{n} 个分块……",
  pdfEmbedded: "向量已就绪",
  pdfNoEmbed: "未配置 Gemini key：仅使用 BM25 关键词检索。",
  pdfRemove: "移除",

  settingsTitle: "分析设置",
  model: "模型",
  notConfigured: "未配置",
  noProviders: "服务器还没有配置任何模型 API key。请在 .env.local（或 Vercel 环境变量）里填写 DEEPSEEK_API_KEY 或 GOOGLE_GENERATIVE_AI_API_KEY，然后重启。",
  mode: "模式",
  modeSingle: "单一观点",
  modeDebate: "多空辩论",
  stance: "立场",
  bullish: "看多",
  bearish: "看空",
  neutral: "中性",
  strength: "信心强度",
  strong: "强",
  moderate: "中",
  mild: "弱",
  personas: "分析师风格（最多 3 位）",
  personaNone: "通用分析师",
  bullPersona: "多方分析师风格",
  bearPersona: "空方分析师风格",
  rebuttal: "反驳轮",
  rebuttalHint: "双方各自回应对方最有力的论点",
  deep: "深度推理",
  deepHint: "更强的模型，显示思考过程，速度较慢",
  web: "联网检索",
  webHint: "用 Tavily、Gemini 搜索或 Google News 获取最新背景",
  advanced: "高级",
  temperature: "温度",
  temperatureHint: "仅在 DeepSeek 且未开启深度推理时生效",
  outputLang: "输出语言",
  run: "生成股评",
  stop: "停止",
  accessCode: "访问码",
  accessCodeHint: "此部署已加保护，请输入访问码。",

  emptyTitle: "从一条新闻，到有来源、有交锋的观点",
  emptyBody:
    "粘贴新闻、搜索标题或上传报告。系统先抽取公司和事实，拉取实时行情与相关报道，再让分析师展开辩论，最后由评审给出评分卡。",
  step1: "抽取",
  step1d: "把公司、代码和事实变成结构化数据",
  step2: "补充",
  step2d: "实时行情、相关标题，可选联网检索",
  step3: "辩论",
  step3d: "不同风格的分析师流式输出带引用的观点",
  step4: "评分",
  step4d: "评审权衡证据，给出评分卡",

  stage_extract: "抽取",
  stage_market: "行情",
  stage_news: "相关新闻",
  stage_web: "联网检索",
  stage_context: "情感标注",
  stage_analysts: "分析师",
  stage_rebuttal: "反驳",
  stage_kpis: "关键指标",
  stage_pm: "评分卡",

  story: "事件",
  entities: "相关标的",
  keyFacts: "关键事实",
  market: "行情快照",
  noQuotes: "没有识别到可交易的标的。",
  pe: "市盈率",
  mcap: "市值",
  range52: "52 周",
  evidence: "证据",
  evidenceHint: "点击正文里的引用标签可以跳到这里。",
  lowRelevance: "相关性低",
  analysts: "分析师",
  debate: "多空辩论",
  openings: "开场陈述",
  rebuttals: "反驳",
  thinking: "思考过程",
  writing: "撰写中……",
  waiting: "等待中……",
  agentError: "这位分析师生成失败",
  document: "文档解读",
  kpis: "关键数据",
  kpiMetric: "指标",
  kpiValue: "数值",
  kpiPeriod: "期间",
  kpiChange: "变动",
  kpiSource: "来源",
  ask: "向文档提问",
  askPlaceholder: "例如：经营利润率变化的主要原因是什么？",
  askSend: "提问",
  askDemoNote: "演示：以下问题已根据财报预先回答，回答中标注了引用页码。",
  askDemoLocked: "上传原文 PDF 后即可自由提问",
  scorecard: "评审评分卡",
  verdict: "结论",
  conviction: "信心",
  dim_fundamentals: "基本面",
  dim_momentum: "动量",
  dim_sentiment: "情绪",
  dim_valuation: "估值",
  dim_risk: "风险",
  agreements: "共识",
  disagreements: "分歧",
  betterSupported: "证据更充分",
  even: "持平",
  bull: "多方",
  bear: "空方",
  keyRisks: "主要风险",
  catalysts: "催化因素",
  dataGaps: "信息缺口",
  exportMd: "导出 Markdown",
  copied: "已复制",
  runMeta: "{s} 秒 · {provider} · {models}",
  errorPrefix: "出错了",
  err_invalid_access_code: "访问码缺失或不正确。",
  err_rate_limited: "当前网络请求过多，请稍后再试。",
  err_embeddings_unavailable: "向量检索需要服务器配置 Gemini key。",
  err_ascii_only: "中文关键词需要配置模型 key 才能自动翻译。可以先用英文名或代码搜索，例如 Tencent、0700.HK。",
  err_quota: "API 额度不足。Gemini 免费档每分钟请求数很低，而且可能不包含 Google 搜索检索。可以等一分钟再试、关闭联网检索，或在 Google AI Studio 开通付费。",
  err_overloaded: "模型当前繁忙，请稍后再试或切换模型。",
  err_location: "当前网络所在地区无法使用 Gemini。请用 npm run dev:proxy 启动（见 README）。",
};

export type TKey = keyof Dict;
const DICTS: Record<Lang, Dict> = { en, zh };
const LANG_KEY = "sc.lang";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_KEY);
    } catch {}
    const initial: Lang = stored === "en" || stored === "zh" ? stored : navigator.language.startsWith("zh") ? "zh" : "en";
    // Sync from browser storage after hydration; the server always renders the default.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
