"use client";

import { ChevronDown } from "lucide-react";
import { PERSONAS } from "@/config/personas";
import { useI18n } from "@/lib/i18n";
import type { Lang, Provider, ServerCapabilities, Stance, Strength } from "@/lib/types";
import { Chip, Label, Segmented, Toggle, cx } from "./ui";

export interface Settings {
  provider: Provider;
  mode: "single" | "debate";
  stance: Stance;
  strength: Strength;
  personas: string[];
  bullPersona: string | null;
  bearPersona: string | null;
  rebuttal: boolean;
  deep: boolean;
  web: boolean;
  temperature: number;
  outputLang: Lang;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "deepseek",
  mode: "debate",
  stance: "neutral",
  strength: "moderate",
  personas: [],
  bullPersona: "growth_seeker",
  bearPersona: "value_investor",
  rebuttal: true,
  deep: false,
  web: false,
  temperature: 0.7,
  outputLang: "zh",
};

export function SettingsPanel({
  value,
  onChange,
  caps,
  disabled,
}: {
  value: Settings;
  onChange: (patch: Partial<Settings>) => void;
  caps: ServerCapabilities | null;
  disabled: boolean;
}) {
  const { t, lang } = useI18n();
  const s = value;

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div>
        <Label>{t("model")}</Label>
        <Segmented<Provider>
          value={s.provider}
          onChange={(provider) => onChange({ provider })}
          options={(["deepseek", "gemini"] as const).map((p) => ({
            value: p,
            label: (
              <span>
                {p === "deepseek" ? "DeepSeek" : "Gemini"}
                {caps && !caps.providers[p] && <span className="ml-1 text-[10px] text-ink-3">({t("notConfigured")})</span>}
              </span>
            ),
            disabled: caps ? !caps.providers[p] : false,
          }))}
        />
        {caps && !caps.providers.deepseek && !caps.providers.gemini && (
          <p className="mt-2 rounded-md bg-warn-soft px-2.5 py-2 text-xs leading-relaxed text-warn">{t("noProviders")}</p>
        )}
      </div>

      <div>
        <Label>{t("mode")}</Label>
        <Segmented
          value={s.mode}
          onChange={(mode) => onChange({ mode })}
          options={[
            { value: "debate", label: t("modeDebate") },
            { value: "single", label: t("modeSingle") },
          ]}
        />
      </div>

      {s.mode === "single" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("stance")}</Label>
              <Segmented<Stance>
                size="sm"
                value={s.stance}
                onChange={(stance) => onChange({ stance })}
                options={(["bullish", "neutral", "bearish"] as const).map((v) => ({ value: v, label: t(v) }))}
              />
            </div>
            <div>
              <Label>{t("strength")}</Label>
              <Segmented<Strength>
                size="sm"
                value={s.strength}
                onChange={(strength) => onChange({ strength })}
                options={(["strong", "moderate", "mild"] as const).map((v) => ({ value: v, label: t(v) }))}
              />
            </div>
          </div>
          <div>
            <Label>{t("personas")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {PERSONAS.map((p) => {
                const on = s.personas.includes(p.id);
                return (
                  <Chip
                    key={p.id}
                    active={on}
                    disabled={!on && s.personas.length >= 3}
                    onClick={() => onChange({ personas: on ? s.personas.filter((x) => x !== p.id) : [...s.personas, p.id] })}
                  >
                    <span title={p.tagline[lang]}>{p.name[lang]}</span>
                  </Chip>
                );
              })}
            </div>
            {s.personas.length === 0 && <p className="mt-1 text-xs text-ink-3">{t("personaNone")}</p>}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PersonaSelect label={t("bullPersona")} value={s.bullPersona} onChange={(bullPersona) => onChange({ bullPersona })} tone="bull" />
            <PersonaSelect label={t("bearPersona")} value={s.bearPersona} onChange={(bearPersona) => onChange({ bearPersona })} tone="bear" />
          </div>
          <div>
            <Label>{t("strength")}</Label>
            <Segmented<Strength>
              size="sm"
              value={s.strength}
              onChange={(strength) => onChange({ strength })}
              options={(["strong", "moderate", "mild"] as const).map((v) => ({ value: v, label: t(v) }))}
            />
          </div>
          <Toggle checked={s.rebuttal} onChange={(rebuttal) => onChange({ rebuttal })} label={t("rebuttal")} hint={t("rebuttalHint")} />
        </>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <Toggle checked={s.deep} onChange={(deep) => onChange({ deep })} label={t("deep")} hint={t("deepHint")} />
        <Toggle
          checked={s.web && Boolean(caps?.webSearch)}
          onChange={(web) => onChange({ web })}
          label={t("web")}
          hint={caps && !caps.webSearch ? `${t("webHint")} · ${t("notConfigured")}` : t("webHint")}
          disabled={!caps?.webSearch}
        />
      </div>

      <details className="group rounded-lg border border-border px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-ink-2">
          {t("advanced")}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-4 pb-1">
          <div>
            <Label hint={t("temperatureHint")}>
              {t("temperature")} <span className="tabular text-ink-3">{s.temperature.toFixed(1)}</span>
            </Label>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.1}
              value={s.temperature}
              onChange={(e) => onChange({ temperature: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div>
            <Label>{t("outputLang")}</Label>
            <Segmented<Lang>
              size="sm"
              value={s.outputLang}
              onChange={(outputLang) => onChange({ outputLang })}
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </div>
      </details>
    </fieldset>
  );
}

function PersonaSelect({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  tone: "bull" | "bear";
}) {
  const { t, lang } = useI18n();
  return (
    <label className="block">
      <span className={cx("mb-1.5 block text-[13px] font-medium", tone === "bull" ? "text-bull" : "text-bear")}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
      >
        <option value="">{t("personaNone")}</option>
        {PERSONAS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
