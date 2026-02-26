import { useEffect, useMemo, useRef, useState } from "react";
import api, { endpoints } from "../api";
import FeedCard from "../components/FeedCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";


type Project = { id: number; name: string };
type TimeEntry = {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  note?: string;
};
type Income = {
  id: number;
  project_id: number;
  date: string;
  amount: number;
  currency?: string | null;
  source?: string | null;
};

const DAYS = 30;

// ---------- FX (Frankfurter, browser-friendly) ----------
type FxRates = Record<string, number>;
const FX_TTL_MS = 12 * 60 * 60 * 1000;
const fxKey = (cur: string) => `fx_${cur.toUpperCase()}_GBP_v2`;

function normCur(c?: string | null) {
  return (c || "GBP").toUpperCase();
}

async function fetchRateToGBP(curRaw: string): Promise<number> {
  const cur = normCur(curRaw);
  if (cur === "GBP") return 1;

  try {
    const cached = localStorage.getItem(fxKey(cur));
    if (cached) {
      const parsed = JSON.parse(cached) as { rate: number; ts: number };
      if (
        parsed &&
        Number.isFinite(parsed.rate) &&
        parsed.rate > 0 &&
        Date.now() - parsed.ts < FX_TTL_MS
      ) {
        return parsed.rate;
      }
    }
  } catch {
    // ignore cache errors
  }

  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(cur)}&to=GBP`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const data = await res.json();

  const rate = Number(data?.rates?.GBP);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Bad FX rate");

  try {
    localStorage.setItem(fxKey(cur), JSON.stringify({ rate, ts: Date.now() }));
  } catch {
    // ignore
  }

  return rate;
}

function toGBP(amount: number, currency?: string | null, rates?: FxRates): number | null {
  const cur = normCur(currency);
  const v = Number(amount) || 0;
  if (cur === "GBP") return v;
  const r = rates?.[cur];
  if (!r) return null; // never fake-convert
  return v * r;
}

// ---------- Dates ----------
const pad2 = (n: number) => String(n).padStart(2, "0");
const toDayKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const toMonthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  const mon = d.toLocaleString(undefined, { month: "short" });
  return `${mon} ${y}`;
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function makeMonthDaysKeys(year: number, month1to12: number) {
  const n = daysInMonth(year, month1to12);
  const keys: string[] = [];
  for (let d = 1; d <= n; d++) {
    keys.push(`${year}-${pad2(month1to12)}-${pad2(d)}`);
  }
  return keys;
}

function makeYearMonthsKeys(year: number) {
  const keys: string[] = [];
  for (let m = 1; m <= 12; m++) keys.push(`${year}-${pad2(m)}`);
  return keys;
}



type DailyRow = { date: string } & Record<string, number | string>;

const emptyDailyRow = (date: string, projectNames: string[]): DailyRow => {
  const row: DailyRow = { date };
  for (const n of projectNames) row[n] = 0;
  return row;
};

// ---------- ggplot-ish styling helpers ----------
// We support both light + dark themes so charts match the rest of the UI.
const GG_LIGHT = {
  grid: "#e5e7eb",
  axis: "#6b7280",
  tooltipBg: "rgba(255,255,255,0.95)",
  tooltipBorder: "#e5e7eb",
  tooltipText: "#111827",
  tooltipMuted: "#374151",
};

const GG_DARK = {
  grid: "#374151",
  axis: "#9ca3af",
  tooltipBg: "rgba(17,24,39,0.95)",
  tooltipBorder: "#374151",
  tooltipText: "#f9fafb",
  tooltipMuted: "#d1d5db",
};

function getIsDarkNow() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

// Keep charts in sync with Tailwind's `.dark` class.
function useIsDark() {
  const [isDark, setIsDark] = useState(getIsDarkNow());

  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(getIsDarkNow()));
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

// Stable palette + deterministic mapping by project name
const DEFAULT_COLORS = [
  "#ff0000",
  "#ff6003",
  "#ffe600",
  "#1eff00",
  "#00ff9d",
  "#71ccc1",
  "#0400ff",
  "#f700ff",
  "#ff7c7c",
  "#ffb477",
  "#fbfd83",
  "#83ff83",
];

function colorForProject(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const m = d.toLocaleString(undefined, { month: "short" });
  const day = String(d.getDate());
  return `${m} ${day}`;
}

const NoCursor = () => null;

const GgTooltip = ({ active, payload, label, gg }: any) => {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((p: any) => ({ name: p.name, value: Number(p.value || 0) }))
    .filter((r: any) => r.value !== 0);

  return (
    <div
      style={{
        background: gg?.tooltipBg || GG_LIGHT.tooltipBg,
        border: `1px solid ${gg?.tooltipBorder || GG_LIGHT.tooltipBorder}`,
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        color: gg?.tooltipText || GG_LIGHT.tooltipText,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {formatShortDate(label)}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: gg?.axis || GG_LIGHT.axis }}>No data</div>
      ) : (
        rows.map((r: any) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ color: gg?.tooltipMuted || GG_LIGHT.tooltipMuted }}>{r.name}</span>
            <span style={{ fontWeight: 700 }}>{r.value.toFixed(2)}</span>
          </div>
        ))
      )}
    </div>
  );
};

// Make the chart wider than the viewport so user can swipe left/right
function chartInnerWidthPx(daysCount: number) {
  const pxPerDay = 28; // increase for wider bars / easier reading
  const minWidth = 520; // avoid tiny charts on desktop
  return Math.max(minWidth, daysCount * pxPerDay);
}

// ---------- Manual time helpers ----------
type ManualMode = "startEnd" | "duration";
type ManualDraft = {
  projectId: string;
  date: string; // YYYY-MM-DD
  mode: ManualMode;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMin: string; // numeric string
  note: string;
};

function todayYMD() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function toLocalISO(dateStr: string, hhmm: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0); // local time
  return dt.toISOString();
}

function addMinutesLocalISO(dateStr: string, hhmm: string, mins: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  dt.setMinutes(dt.getMinutes() + mins);
  return dt.toISOString();
}

function ManualTimeModal(props: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  onCreated: () => void;
}) {
  const { open, onClose, projects, onCreated } = props;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultProjectId = useMemo(() => {
    const first = projects?.[0]?.id;
    return first != null ? String(first) : "";
  }, [projects]);

  const [draft, setDraft] = useState<ManualDraft>(() => ({
    projectId: "",
    date: todayYMD(),
    mode: "startEnd",
    startTime: "09:00",
    endTime: "10:00",
    durationMin: "60",
    note: "",
  }));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft((d) => ({
      ...d,
      projectId: d.projectId || defaultProjectId,
    }));
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsedProjectId = Number(draft.projectId);
  const projectOk = Number.isFinite(parsedProjectId) && parsedProjectId > 0;

  function validate():
    | { startISO: string; endISO: string; payload: any }
    | null {
    setError(null);

    if (!projectOk) {
      setError("Please choose a project.");
      return null;
    }
    if (!draft.date) {
      setError("Please choose a date.");
      return null;
    }
    if (!draft.startTime) {
      setError("Please enter a start time.");
      return null;
    }

    const startISO = toLocalISO(draft.date, draft.startTime);
    let endISO = "";

    if (draft.mode === "startEnd") {
      if (!draft.endTime) {
        setError("Please enter an end time.");
        return null;
      }
      endISO = toLocalISO(draft.date, draft.endTime);
      if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
        setError("End time must be after start time (same day).");
        return null;
      }
    } else {
      const mins = Number(draft.durationMin);
      if (!Number.isFinite(mins) || mins <= 0) {
        setError("Duration must be a positive number of minutes.");
        return null;
      }
      endISO = addMinutesLocalISO(draft.date, draft.startTime, mins);
    }

    const payload = {
      project_id: parsedProjectId,
      start_time: startISO,
      end_time: endISO,
      note: draft.note?.trim() || null,
    };

    return { startISO, endISO, payload };
  }

  async function save() {
    const v = validate();
    if (!v) return;

    setSaving(true);
    setError(null);
    try {
      await api.post(endpoints.timeEntries, v.payload);
      onCreated();
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to save manual time entry.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-700
                   bg-white dark:bg-neutral-900 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">Add manual time</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              Create a completed entry without using the timer.
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700
                       bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Project
            </div>
            <select
              value={draft.projectId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, projectId: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border
                        bg-[var(--si-surface)]
                        text-[var(--si-text)]
                        border-[var(--si-border)]
                        hover:bg-[var(--si-surface-2)]
                        dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <option value="" disabled>
                Select a project…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                Date
              </div>
              <input
                type="date"
                value={draft.date}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border
                          bg-[var(--si-surface)]
                          text-[var(--si-text)]
                          border-[var(--si-border)]
                          hover:bg-[var(--si-surface-2)]
                          dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
              />
            </div>

            <div>
              <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                Input type
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDraft((d) => ({ ...d, mode: "startEnd" }))}
                  className={`flex-1 px-3 py-2 rounded-xl border ${
                    draft.mode === "startEnd"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                      : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                  title="Enter start and end time"
                >
                  Start/End
                </button>
                <button
                  onClick={() => setDraft((d) => ({ ...d, mode: "duration" }))}
                  className={`flex-1 px-3 py-2 rounded-xl border ${
                    draft.mode === "duration"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                      : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                  title="Enter start time and duration"
                >
                  Duration
                </button>
              </div>
            </div>
          </div>

          {draft.mode === "startEnd" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  Start time
                </div>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, startTime: e.target.value }))
                  }
                      className="w-full px-3 py-2 rounded-xl border
                                bg-[var(--si-surface)]
                                text-[var(--si-text)]
                                border-[var(--si-border)]
                                hover:bg-[var(--si-surface-2)]
                                dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
                />
              </div>
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  End time
                </div>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, endTime: e.target.value }))
                  }
                          className="w-full ppx-3 py-2 rounded-xl border
                                    bg-[var(--si-surface)]
                                    text-[var(--si-text)]
                                    border-[var(--si-border)]
                                    hover:bg-[var(--si-surface-2)]
                                    dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  Start time
                </div>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, startTime: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border
                            bg-[var(--si-surface)]
                            text-[var(--si-text)]
                            border-[var(--si-border)]
                            hover:bg-[var(--si-surface-2)]
                            dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
                />
              </div>
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  Duration (minutes)
                </div>
                <input
                  inputMode="numeric"
                  value={draft.durationMin}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      durationMin: e.target.value.replace(/[^\d]/g, ""),
                    }))
                  }
                  placeholder="e.g. 45"
                  className="w-full px-3 py-2 rounded-xl border
                            bg-[var(--si-surface)]
                            text-[var(--si-text)]
                            border-[var(--si-border)]
                            hover:bg-[var(--si-surface-2)]
                            dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
                />
              </div>
            </div>
          )}

          <div>
            <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Note (optional)
            </div>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, note: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border
                        bg-[var(--si-surface)]
                        text-[var(--si-text)]
                        border-[var(--si-border)]
                        hover:bg-[var(--si-surface-2)]
                        dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700
                       bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl border border-neutral-900 dark:border-white
                       bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
                       hover:opacity-95 disabled:opacity-70 font-semibold"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FixedLegend({ projects, gg }: { projects: Project[]; gg: typeof GG_LIGHT }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: gg.axis }}>
      {projects.map((p) => (
        <div key={p.id} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: colorForProject(p.name) }}
          />
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  );
}


export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [period, setPeriod] = useState<"Month" | "Year">("Month");
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); 
  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const [manualOpen, setManualOpen] = useState(false);

  const isDark = useIsDark();
  const gg = isDark ? GG_DARK : GG_LIGHT;

  // ✅ chart scroll containers
  const timeScrollRef = useRef<HTMLDivElement | null>(null);
  const incomeScrollRef = useRef<HTMLDivElement | null>(null);

  // ✅ when this changes, we auto-scroll both charts to the far right
  const [scrollToRightToken, setScrollToRightToken] = useState(0);

  const scrollChartsToRight = () => {
    requestAnimationFrame(() => {
      const t = timeScrollRef.current;
      const i = incomeScrollRef.current;
      if (t) t.scrollLeft = t.scrollWidth;
      if (i) i.scrollLeft = i.scrollWidth;
    });
  };

  const loadAll = async (opts?: { scrollCharts?: boolean }) => {
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
        api.get(endpoints.incomes),
      ]);
      setProjects(pRes.data as Project[]);
      setTimeEntries(tRes.data as TimeEntry[]);
      setIncomes(iRes.data as Income[]);

      if (opts?.scrollCharts) {
        setScrollToRightToken((n) => n + 1);
      }
    } catch (err) {
      console.error("Home loadAll failed:", err);
    }
  };

  // ✅ initial load: scroll to most recent (right)
  useEffect(() => {
    loadAll({ scrollCharts: true });
  }, []);

  // background refreshes should NOT yank the user to the right
  useEffect(() => {
    const onFocus = () => loadAll({ scrollCharts: false });
    const onVis = () => {
      if (!document.hidden) loadAll({ scrollCharts: false });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ✅ whenever token bumps (initial load, Refresh button, manual save), jump to right
  useEffect(() => {
    if (scrollToRightToken <= 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollChartsToRight();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToRightToken]);

  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const matchesFilter = (projectName?: string) =>
    filter === "All" || (projectName && filter === projectName);

  // Load FX rates for currencies appearing in incomes
  useEffect(() => {
    let cancelled = false;

    const currencies = Array.from(
      new Set((incomes || []).map((i) => normCur(i.currency)))
    );
    const missing = currencies.filter((c) => c !== "GBP" && !fxRates[c]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const pairs = await Promise.all(
          missing.map(async (c) => [c, await fetchRateToGBP(c)] as const)
        );
        if (cancelled) return;
        setFxRates((prev) => {
          const next = { ...prev };
          for (const [c, r] of pairs) next[c] = r;
          return next;
        });
      } catch (e) {
        console.error("FX load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes]);

  const xKeys = useMemo(() => {
    return period === "Year"
      ? makeYearMonthsKeys(selectedYear)
      : makeMonthDaysKeys(selectedYear, selectedMonth);
  }, [period, selectedYear, selectedMonth]);

  const xKeyCount = xKeys.length;

  const xTickFormatter = (label: string) =>
    period === "Year" ? formatMonthLabel(label) : formatShortDate(label);



  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);

  const dailyTimeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();
    for (const k of xKeys) rows.set(k, emptyDailyRow(k, projectNames));

    for (const e of timeEntries) {
      if (!e.end_time) continue;

      const pname = projectMap[e.project_id];
      if (!pname) continue;

      const start = new Date(e.start_time);
      const end = new Date(e.end_time);

      const key = period === "Year" ? toMonthKey(start) : toDayKey(start);
      if (!rows.has(key)) continue;

      const durationHours = (end.getTime() - start.getTime()) / 1000 / 3600;
      const row = rows.get(key)!;
      const prev = typeof row[pname] === "number" ? row[pname] : 0;
      row[pname] = prev + Math.max(0, durationHours);
    }

    return Array.from(rows.values());
  }, [timeEntries, projectMap, xKeys, projectNames, period]);


    const dailyIncomeData: DailyRow[] = useMemo(() => {
      const rows = new Map<string, DailyRow>();
      for (const k of xKeys) rows.set(k, emptyDailyRow(k, projectNames));

      for (const inc of incomes) {
        const pname = projectMap[inc.project_id];
        if (!pname) continue;

        const d = new Date(inc.date);
        const key = period === "Year" ? toMonthKey(d) : toDayKey(d);
        if (!rows.has(key)) continue;

        const gbp = toGBP(inc.amount, inc.currency, fxRates);
        const row = rows.get(key)!;
        const prev = typeof row[pname] === "number" ? row[pname] : 0;
        row[pname] = prev + (gbp ?? 0);
      }

      return Array.from(rows.values());
    }, [incomes, projectMap, xKeys, fxRates, projectNames, period]);

    const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1]; // adjust if you want more history
  }, []);

    const monthOptions = useMemo(
      () => [
        { v: 1, label: "Jan" }, { v: 2, label: "Feb" }, { v: 3, label: "Mar" },
        { v: 4, label: "Apr" }, { v: 5, label: "May" }, { v: 6, label: "Jun" },
        { v: 7, label: "Jul" }, { v: 8, label: "Aug" }, { v: 9, label: "Sep" },
        { v: 10, label: "Oct" }, { v: 11, label: "Nov" }, { v: 12, label: "Dec" },
      ],
      []
    );



  function calculateWeeklyTimeTotals(entries: TimeEntry[]) {
    const totals: Record<string, number> = {};
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const e of entries) {
      if (!e.end_time) continue;
      const startMs = new Date(e.start_time).getTime();
      if (startMs < sevenDaysAgo) continue;

      const name = projectMap[e.project_id];
      if (!name) continue;

      const durationSec = (new Date(e.end_time).getTime() - startMs) / 1000;
      totals[name] = (totals[name] || 0) + Math.max(0, durationSec);
    }
    return totals;
  }

  function calculateWeeklyIncomeTotals(list: Income[]) {
    const totals: Record<string, number> = {};
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const inc of list) {
      const d = new Date(inc.date).getTime();
      if (d < sevenDaysAgo) continue;

      const name = projectMap[inc.project_id];
      if (!name) continue;

      const gbp = toGBP(inc.amount, inc.currency, fxRates);
      totals[name] = (totals[name] || 0) + (gbp ?? 0);
    }
    return totals;
  }

  const weeklyTimeTotals = calculateWeeklyTimeTotals(timeEntries);
  const weeklyIncomeTotals = calculateWeeklyIncomeTotals(incomes);

  const fmtHours = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const recentIncomes = useMemo(() => {
    return [...incomes]
      .sort((a, b) => b.id - a.id)
      .filter((i) => matchesFilter(projectMap[i.project_id]))
      .slice(0, 10);
  }, [incomes, filter, projectMap]);

  const recentTimeEntries = useMemo(() => {
    return [...timeEntries]
      .sort((a, b) => b.id - a.id)
      .filter((e) => matchesFilter(projectMap[e.project_id]))
      .slice(0, 10);
  }, [timeEntries, filter, projectMap]);

  const deleteIncome = async (incomeId: number) => {
    const yes = window.confirm(`Delete income #${incomeId}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.incomes}${incomeId}/`);
      setIncomes((prev) => prev.filter((i) => i.id !== incomeId));
    } catch (err) {
      alert("Failed to delete income.");
      console.error(err);
    }
  };

  const deleteTimeEntry = async (entryId: number) => {
    const yes = window.confirm(`Delete time entry #${entryId}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.timeEntries}${entryId}/`);
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      alert("Failed to delete time entry.");
      console.error(err);
    }
  };

    // ✅ export payload
    const exportPayload = useMemo(() => {
    const projectIdByName: Record<string, number> = {};
    for (const p of projects) projectIdByName[p.name] = p.id;

    const allowedProjectIds =
      filter === "All"
        ? new Set(projects.map((p) => p.id))
        : new Set([projectIdByName[filter]].filter((x) => Number.isFinite(x)));

    const keySet = new Set(xKeys);

    const timeFiltered = timeEntries.filter((e) => {
      if (!allowedProjectIds.has(e.project_id)) return false;

      const start = new Date(e.start_time);
      const key = period === "Year" ? toMonthKey(start) : toDayKey(start);
      return keySet.has(key);
    });

    const incomesFiltered = incomes.filter((i) => {
      if (!allowedProjectIds.has(i.project_id)) return false;

      const d = new Date(i.date);
      const key = period === "Year" ? toMonthKey(d) : toDayKey(d);
      return keySet.has(key);
    });

    return {
      meta: {
        exported_at: new Date().toISOString(),
        filter,
        period,
        selectedYear,
        selectedMonth: period === "Year" ? null : selectedMonth,
      },
      projects: projects.filter((p) => allowedProjectIds.has(p.id)),
      time_entries: timeFiltered,
      incomes: incomesFiltered,
    };
  }, [projects, timeEntries, incomes, filter, period, selectedYear, selectedMonth, xKeys]);

  const makeExportBaseName = () => {
    const label =
      period === "Year"
        ? `${selectedYear}`
        : `${selectedYear}-${pad2(selectedMonth)}`;

    const proj = filter === "All" ? "" : `_${filter.replace(/\s+/g, "_")}`;
    return `autotrac_export_${period.toLowerCase()}_${label}${proj}`;
  };

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // escape quotes and wrap if needed
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const toCsv = (headers: string[], rows: any[][]) => {
    const head = headers.map(csvEscape).join(",");
    const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    return `${head}\n${body}\n`;
  };

  const exportJson = () => {
    try {
      const base = makeExportBaseName();
      downloadTextFile(
        `${base}.json`,
        JSON.stringify(exportPayload, null, 2),
        "application/json"
      );
    } catch (e) {
      console.error("Export JSON failed:", e);
      alert("Export failed. Please try again.");
    }
  };

  const exportCsv = () => {
    try {
      const base = makeExportBaseName();

      // Projects
      const projectsCsv = toCsv(
        ["id", "name"],
        exportPayload.projects.map((p: any) => [p.id, p.name])
      );
      downloadTextFile(`${base}_projects.csv`, projectsCsv, "text/csv");

      // Time entries
      const projectNameById: Record<number, string> = {};
      for (const p of exportPayload.projects as any[]) projectNameById[p.id] = p.name;

      const timeRows = (exportPayload.time_entries as any[]).map((e) => {
        const start = e.start_time ? new Date(e.start_time).getTime() : null;
        const end = e.end_time ? new Date(e.end_time).getTime() : null;
        const hours =
          start !== null && end !== null ? Math.max(0, (end - start) / 3600000) : "";
        return [
          e.id,
          e.project_id,
          projectNameById[e.project_id] || "",
          e.start_time,
          e.end_time ?? "",
          hours,
        ];
      });

      const timeCsv = toCsv(
        ["id", "project_id", "project_name", "start_time", "end_time", "duration_hours"],
        timeRows
      );
      downloadTextFile(`${base}_time_entries.csv`, timeCsv, "text/csv");

      // Incomes
      const incomeRows = (exportPayload.incomes as any[]).map((i) => {
        const gbp = toGBP(i.amount, i.currency, fxRates);
        return [
          i.id,
          i.project_id,
          projectNameById[i.project_id] || "",
          i.date,
          i.amount,
          i.currency ?? "",
          gbp ?? "",
        ];
      });

      const incomesCsv = toCsv(
        ["id", "project_id", "project_name", "date", "amount", "currency", "amount_gbp"],
        incomeRows
      );
      downloadTextFile(`${base}_incomes.csv`, incomesCsv, "text/csv");
    } catch (e) {
      console.error("Export CSV failed:", e);
      alert("Export failed. Please try again.");
    }
  };



  return (
    <div className="mx-auto max-w-md px-3 py-3 text-[var(--si-text)] dark:text-neutral-100">
      <style>{`
        /* Scrollbars for the chart panes (match the card/panel in both themes) */
        .chart-scroll{ scrollbar-gutter: stable both-edges; }
        .chart-scroll::-webkit-scrollbar{ height: 10px; }
        .chart-scroll::-webkit-scrollbar-track{
          background: rgba(0,0,0,0.06);
          border-radius: 9999px;
        }
        .chart-scroll::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,0.22);
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .dark .chart-scroll::-webkit-scrollbar-track{
          background: rgba(255,255,255,0.08);
        }
        .dark .chart-scroll::-webkit-scrollbar-thumb{
          background: rgba(255,255,255,0.22);
        }
        .chart-scroll{
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.22) rgba(0,0,0,0.06);
        }
        .dark .chart-scroll{
          scrollbar-color: rgba(255,255,255,0.22) rgba(255,255,255,0.08);
        }
      `}</style>
      <div className="mb-4 space-y-2">
        {/* Row 1: filters */}
        <div className="flex gap-2 flex-nowrap">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setScrollToRightToken((n) => n + 1);
            }}
            className="min-w-0 w-[120px] max-w-[120px] px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      truncate"
          >
            <option value="All">All</option>
            {projects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as "Month" | "Year");
              setScrollToRightToken((n) => n + 1);
            }}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      truncate"
            title="Period"
          >
            <option value="Month">By month</option>
            <option value="Year">By year</option>
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="min-w-0 w-[85px] max-w-[85px] px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      truncate"
            title="Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            disabled={period === "Year"}
            className="min-w-0 w-[70px] max-w-[70px] px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      disabled:opacity-50 truncate"
            title="Month"
          >
            {monthOptions.map((m) => (
              <option key={m.v} value={m.v}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setManualOpen(true)}
            className="min-w-0 w-[85px] max-w-[100px] px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      disabled:opacity-50 truncate"
            title="Add manual time"
          >
            Manual
          </button>

          <button
          onClick={exportJson}
          className="px-4 py-2 rounded-xl border
                    bg-[var(--si-surface)]
                    text-[var(--si-text)]
                    border-[var(--si-border)]
                    hover:bg-[var(--si-surface-2)]
                    dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                    disabled:opacity-50 truncate"
          title="Export filtered data as JSON"
        >
          Export JSON
        </button>

        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl border
                    bg-[var(--si-surface)]
                    text-[var(--si-text)]
                    border-[var(--si-border)]
                    hover:bg-[var(--si-surface-2)]
                    dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                    disabled:opacity-50 truncate"
          title="Export filtered data as CSV"
        >
          Export CSV
        </button>

          <button
            onClick={() => loadAll({ scrollCharts: true })}
            className="min-w-0 w-[85px] max-w-[100px] px-3 py-2 rounded-xl border
                      bg-[var(--si-surface)]
                      text-[var(--si-text)]
                      border-[var(--si-border)]
                      hover:bg-[var(--si-surface-2)]
                      dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700 dark:text-neutral-100
                      disabled:opacity-50 truncate"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      <ManualTimeModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        projects={projects}
        onCreated={() => loadAll({ scrollCharts: true })}
      />

      <FeedCard
        title="Totals overview"
        subtitle={`Stacked by date (last ${DAYS} days) • Swipe left/right on charts`}
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs mb-2 text-[var(--si-muted)] dark:text-neutral-400">
              Daily time (hours) — stacked by project
            </p>

           <div className="rounded-2xl p-2 shadow-sm border bg-[var(--si-surface)] border-[var(--si-border)] dark:bg-neutral-800 dark:border-neutral-700">
              {/* ✅ Fixed legend */}
              <div
                className="sticky top-0 z-10 pb-2
                          bg-[var(--si-surface)] dark:bg-neutral-800"
              >
                <FixedLegend projects={projects} gg={gg} />
              </div>

              <div className="flex items-stretch">
                {/* ✅ Fixed Y-axis */}
                <div className="sticky left-0 z-10 bg-[var(--si-surface)] dark:bg-neutral-800 pr-2 border-[var(--si-border)] dark:border-neutral-700">
                  <div className="h-56 w-[40px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyTimeData}
                        margin={{ top: 6, right: 0, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        {/* Keep scale identical by including the same stacked bars, but invisible */}
                        {projects.map((p) => (
                          <Bar
                            key={p.id}
                            dataKey={p.name}
                            stackId="time"
                            fill="transparent"
                            fillOpacity={0}
                            isAnimationActive={false}
                            activeBar={false}
                          />
                        ))}

                        <YAxis
                          tick={{ fontSize: 11, fill: gg.axis }}
                          tickLine={false}
                          axisLine={{ stroke: gg.grid }}
                          width={40}
                        />

                        {/* Hide everything else in this axis-only chart */}
                        <XAxis dataKey="date" hide />
                        <Tooltip content={<></>} cursor={<NoCursor />} wrapperStyle={{ outline: "none" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ✅ Scrollable plot area */}
                <div className="overflow-x-auto chart-scroll" ref={timeScrollRef}>
                  <div style={{ width: chartInnerWidthPx(xKeyCount) }}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyTimeData}
                          margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                          barCategoryGap={10}
                        >
                          <CartesianGrid
                            stroke={gg.grid}
                            strokeDasharray="3 3"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="date"
                            tickFormatter={xTickFormatter}
                            tick={{ fontSize: 11, fill: gg.axis }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />

                          {/* Hide YAxis here (it’s fixed on the left) */}
                          <YAxis hide />

                          <Tooltip content={<GgTooltip gg={gg} />} cursor={<NoCursor />} wrapperStyle={{ outline: "none" }} />

                          {projects.map((p) => (
                            <Bar
                              key={p.id}
                              dataKey={p.name}
                              stackId="time"
                              fill={colorForProject(p.name)}
                              radius={[6, 6, 0, 0]}
                              fillOpacity={0.85}
                              activeBar={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Swipe left/right to view more days
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs mb-2 text-[var(--si-muted)] dark:text-neutral-400">
              Daily income (£) — stacked by project (auto FX)
            </p>

            <div className="rounded-2xl p-2 shadow-sm border bg-[var(--si-surface)] border-[var(--si-border)] dark:bg-neutral-800 dark:border-neutral-700">
              {/* ✅ Fixed legend */}
              <div
                className="sticky top-0 z-10 pb-2
                          bg-[var(--si-surface)] dark:bg-neutral-800"
              >
                <FixedLegend projects={projects} gg={gg} />
              </div>

              <div className="flex items-stretch">
                {/* ✅ Fixed Y-axis */}
                <div className="sticky left-0 z-10 bg-[var(--si-surface)] dark:bg-neutral-800 pr-2 border-[var(--si-border)] dark:border-neutral-700">
                  <div className="h-56 w-[40px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyIncomeData}
                        margin={{ top: 6, right: 0, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        {/* Keep scale identical by including the same stacked bars, but invisible */}
                        {projects.map((p) => (
                          <Bar
                            key={p.id}
                            dataKey={p.name}
                            stackId="income"
                            fill="transparent"
                            fillOpacity={0}
                            isAnimationActive={false}
                            activeBar={false}
                          />
                        ))}

                        <YAxis
                          tick={{ fontSize: 11, fill: gg.axis }}
                          tickLine={false}
                          axisLine={{ stroke: gg.grid }}
                          width={40}
                        />

                        {/* Hide everything else in this axis-only chart */}
                        <XAxis dataKey="date" hide />
                        <Tooltip content={<></>} cursor={<NoCursor />} wrapperStyle={{ outline: "none" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ✅ Scrollable plot area */}
                <div className="overflow-x-auto chart-scroll" ref={incomeScrollRef}>
                  <div style={{ width: chartInnerWidthPx(xKeyCount) }}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyIncomeData}
                          margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                          barCategoryGap={10}
                        >
                          <CartesianGrid
                            stroke={gg.grid}
                            strokeDasharray="3 3"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="date"
                            tickFormatter={xTickFormatter}
                            tick={{ fontSize: 11, fill: gg.axis }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />

                          {/* Hide YAxis here (it’s fixed on the left) */}
                          <YAxis hide />

                          <Tooltip content={<GgTooltip gg={gg} />} cursor={<NoCursor />} wrapperStyle={{ outline: "none" }} />

                          {projects.map((p) => (
                            <Bar
                              key={p.id}
                              dataKey={p.name}
                              stackId="income"
                              fill={colorForProject(p.name)}
                              radius={[6, 6, 0, 0]}
                              fillOpacity={0.85}
                              activeBar={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Swipe left/right to view more days
              </div>
            </div>
          </div>
        </div>
      </FeedCard>

      <FeedCard title="This week (last 7 days)">
        {projects.length === 0 ? (
          <div className="text-sm text-neutral-500">No projects yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {projects.map((p) => (
              <li key={p.id} className="flex justify-between items-center">
                <span
                  className="font-medium"
                  style={{ color: colorForProject(p.name) }}
                >
                  {p.name}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  ⏱ {fmtHours(weeklyTimeTotals[p.name] || 0)} · 💰 £
                  {(weeklyIncomeTotals[p.name] || 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </FeedCard>

      <FeedCard title="Recent time entries" subtitle="Latest 10">
        <ul className="space-y-2">
          {recentTimeEntries.map((e) => {
            const pname = projectMap[e.project_id] || `Project #${e.project_id}`;
            const color = projectMap[e.project_id] ? colorForProject(pname) : undefined;

            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div style={color ? { color } : undefined}>
                    {pname} · #{e.id}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {e.end_time ? "stopped" : "running"} ·{" "}
                    {new Date(e.start_time).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteTimeEntry(e.id)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title="Delete time entry"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      </FeedCard>

      <FeedCard title="Recent incomes" subtitle="Latest 10 (shows GBP)">
        <ul className="space-y-2">
          {recentIncomes.map((i) => {
            const pname = projectMap[i.project_id] || `Project #${i.project_id}`;
            const cur = normCur(i.currency);
            const gbp = toGBP(i.amount, i.currency, fxRates);
            const color = projectMap[i.project_id] ? colorForProject(pname) : undefined;

            return (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div style={color ? { color } : undefined}>
                    {pname} · #{i.id}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {new Date(i.date).toLocaleDateString()} ·{" "}
                    {cur === "GBP"
                      ? `£${Number(i.amount).toFixed(2)}`
                      : `${cur} ${Number(i.amount).toFixed(2)}  ≈  ${
                          gbp == null ? "—" : `£${gbp.toFixed(2)}`
                        }`}
                  </div>
                </div>

                <button
                  onClick={() => deleteIncome(i.id)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  title="Delete income"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      </FeedCard>
    </div>
  );
}
