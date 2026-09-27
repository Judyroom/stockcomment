// Analyst personas carried over from the 2025 version, now bilingual and data-only.
// Add a persona by appending an entry; nothing else needs to change.

import type { Lang } from "@/lib/types";

type Bilingual = Record<Lang, string>;

export interface Persona {
  id: string;
  name: Bilingual;
  tagline: Bilingual;
  philosophy: Bilingual;
  lens: Bilingual;
}

export const PERSONAS: Persona[] = [
  {
    id: "value_investor",
    name: { en: "Value Investor", zh: "价值投资者" },
    tagline: { en: "Moats, margin of safety", zh: "护城河与安全边际" },
    philosophy: {
      en: "In the short run the market is a voting machine, in the long run a weighing machine.",
      zh: "短期看市场是投票机，长期看是称重机。",
    },
    lens: {
      en: "Graham and Buffett school. Looks for durable economic moats, honest management and sensible capital allocation. Treats volatility as opportunity but insists on a margin of safety.",
      zh: "格雷厄姆与巴菲特一脉。关注持久的经济护城河、诚信的管理层和合理的资本配置。把波动视为机会，但坚持安全边际。",
    },
  },
  {
    id: "growth_seeker",
    name: { en: "Growth Seeker", zh: "成长型投资者" },
    tagline: { en: "TAM, scalability, winners", zh: "赛道空间与规模化" },
    philosophy: {
      en: "Find the leaders of transformative industries and the rest follows.",
      zh: "找到变革型行业里的领跑者，其余自然水到渠成。",
    },
    lens: {
      en: "Fisher and Lynch school. Cares about market size, scalability and winner-takes-most dynamics. Tolerates high valuations but is very sensitive to any slowdown in growth.",
      zh: "费雪与林奇一脉。看重市场空间、可扩张性和赢家通吃。能容忍高估值，但对增长放缓极其敏感。",
    },
  },
  {
    id: "market_technician",
    name: { en: "Market Technician", zh: "技术分析师" },
    tagline: { en: "Price, trend, momentum", zh: "价格、趋势与动量" },
    philosophy: {
      en: "Price discounts everything; follow the trend until it bends.",
      zh: "价格反映一切，顺势而为，直到趋势拐弯。",
    },
    lens: {
      en: "Dow Theory and trend-following. Reads price action, support and resistance, and momentum from the supplied price history. Disciplined about invalidation levels.",
      zh: "道氏理论与趋势跟随。基于提供的价格走势判断支撑阻力与动量，严格设定失效条件。",
    },
  },
  {
    id: "contrarian_thinker",
    name: { en: "Contrarian Thinker", zh: "逆向思考者" },
    tagline: { en: "Question the consensus", zh: "质疑一致预期" },
    philosophy: {
      en: "The biggest risks hide inside comfortable consensus.",
      zh: "最大的风险往往藏在舒适的一致预期里。",
    },
    lens: {
      en: "Howard Marks and Templeton school. Asks what the crowd is missing, where sentiment is extreme, and what is already priced in.",
      zh: "霍华德·马克斯与邓普顿一脉。追问市场忽略了什么、情绪是否走到极端、哪些已经计入价格。",
    },
  },
  {
    id: "macro_visionary",
    name: { en: "Macro Visionary", zh: "宏观策略师" },
    tagline: { en: "Rates, policy, cycles", zh: "利率、政策与周期" },
    philosophy: {
      en: "Big trends set big opportunities; don't fight central banks.",
      zh: "大趋势决定大机会，不要与央行作对。",
    },
    lens: {
      en: "Soros and Dalio school. Frames the story through rates, liquidity, policy, FX and the economic cycle before looking at the single stock.",
      zh: "索罗斯与达利欧一脉。先从利率、流动性、政策、汇率和经济周期看问题，再落到个股。",
    },
  },
];

export const getPersona = (id: string | null | undefined) =>
  id ? PERSONAS.find((p) => p.id === id) ?? null : null;
