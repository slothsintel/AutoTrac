import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";
import FeedCard from "../components/FeedCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

const FIXED = ["AutoVisuals", "AutoTrac", "AutoStock"] as const;
type FixedProject = (typeof FIXED)[number];

const PROJECT_COLORS: Record<FixedProject, string> = {
  AutoVisuals: "#ec4899",
  AutoTrac: "#3b82f6",
  AutoStock: "#22c55e",
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

function toGBP(
  amount: number,
  currency?: string | null,
  rates?: FxRates
): number | null {
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

function makeLastNDaysKeys(n: number) {
  const keys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(toDayKey(d));
  }
  return keys;
}

type DailyRow = { date: string } & Record<FixedProject, number>;
const emptyDailyRow = (date: string): DailyRow => ({
  date,
  AutoVisuals: 0,
  AutoTrac: 0,
  AutoStock: 0,
});

// ---------- ggplot-ish styling helpers ----------
const GG = {
  grid: "#e5e7eb",
  axis: "#6b7280",
  tooltipBg: "rgba(255,255,255,0.95)",
  tooltipBorder: "#e5e7eb",
};

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const m = d.toLocaleString(undefined, { month: "short" });
  const day = String(d.getDate());
  return `${m} ${day}`;
}

const GgTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((p: any) => ({ name: p.name, value: Number(p.value || 0) }))
    .filter((r: any) => r.value !== 0);

  return (
    <div
      style={{
        background: GG.tooltipBg,
        border: `1px solid ${GG.tooltipBorder}`,
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        color: "#111827",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {formatShortDate(label)}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No data</div>
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
            <span style={{ color: "#374151" }}>{r.name}</span>
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

  const fixedProjects = useMemo(() => {
    const fixed = projects.filter((p) => FIXED.includes(p.name as FixedProject));
    return fixed.length ? fixed : projects;
  }, [projects]);

  const defaultProjectId = useMemo(() => {
    const first = fixedProjects?.[0]?.id;
    return first != null ? String(first) : "";
  }, [fixedProjects]);

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

    // Backend-friendly payload (matches your TimeEntry fields)
    const payload = {
      project_id: parsedProjectId,
      start_time: startISO,
      end_time: endISO,
      note: draft.note?.trim() || null,
      // Optional (if backend ignores, it's fine):
      // source: "manual",
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
          {/* Project */}
          <div>
            <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Project
            </div>
            <select
              value={draft.projectId}
              onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                         text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
            >
              <option value="" disabled>
                Select a project…
              </option>
              {fixedProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date + mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                Date
              </div>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                           text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
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

          {/* Times */}
          {draft.mode === "startEnd" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  Start time
                </div>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                             text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                />
              </div>
              <div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
                  End time
                </div>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                             text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
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
                  onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                             text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
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
                  className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                             text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Note (optional)
            </div>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                         text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
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

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [fxRates, setFxRates] = useState<FxRates>({ GBP: 1 });

  const [manualOpen, setManualOpen] = useState(false);

  const loadAll = async () => {
    try {
      const [pRes, tRes, iRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
        api.get(endpoints.incomes),
      ]);
      setProjects(pRes.data as Project[]);
      setTimeEntries(tRes.data as TimeEntry[]);
      setIncomes(iRes.data as Income[]);
    } catch (err) {
      console.error("Home loadAll failed:", err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const onFocus = () => loadAll();
    const onVis = () => {
      if (!document.hidden) loadAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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

  const lastNDaysKeys = useMemo(() => makeLastNDaysKeys(DAYS), []);

  const dailyTimeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();
    for (const day of lastNDaysKeys) rows.set(day, emptyDailyRow(day));

    for (const e of timeEntries) {
      if (!e.end_time) continue;
      const pname = projectMap[e.project_id] as FixedProject | undefined;
      if (!pname || !(pname in PROJECT_COLORS)) continue;

      const start = new Date(e.start_time);
      const end = new Date(e.end_time);
      const dayKey = toDayKey(start);
      if (!rows.has(dayKey)) continue;

      const durationHours = (end.getTime() - start.getTime()) / 1000 / 3600;
      rows.get(dayKey)![pname] += Math.max(0, durationHours);
    }

    return Array.from(rows.values());
  }, [timeEntries, projectMap, lastNDaysKeys]);

  const dailyIncomeData: DailyRow[] = useMemo(() => {
    const rows = new Map<string, DailyRow>();
    for (const day of lastNDaysKeys) rows.set(day, emptyDailyRow(day));

    for (const inc of incomes) {
      const pname = projectMap[inc.project_id] as FixedProject | undefined;
      if (!pname || !(pname in PROJECT_COLORS)) continue;

      const dayKey = toDayKey(new Date(inc.date));
      if (!rows.has(dayKey)) continue;

      const gbp = toGBP(inc.amount, inc.currency, fxRates);
      rows.get(dayKey)![pname] += gbp ?? 0; // 0 until FX ready
    }

    return Array.from(rows.values());
  }, [incomes, projectMap, lastNDaysKeys, fxRates]);

  function calculateWeeklyTimeTotals(entries: TimeEntry[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const e of entries) {
      if (!e.end_time) continue;
      const start = new Date(e.start_time).getTime();
      if (start < sevenDaysAgo) continue;

      const durationSec = (new Date(e.end_time).getTime() - start) / 1000;
      const name = projectMap[e.project_id] as FixedProject | undefined;
      if (name && totals[name] != null) totals[name] += durationSec;
    }
    return totals;
  }

  function calculateWeeklyIncomeTotals(list: Income[]) {
    const totals: Record<FixedProject, number> = {
      AutoVisuals: 0,
      AutoTrac: 0,
      AutoStock: 0,
    };

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const inc of list) {
      const d = new Date(inc.date).getTime();
      if (d < sevenDaysAgo) continue;

      const name = projectMap[inc.project_id] as FixedProject | undefined;
      if (name && totals[name] != null) {
        const gbp = toGBP(inc.amount, inc.currency, fxRates);
        totals[name] += gbp ?? 0;
      }
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

  const projectColorClass = (name?: string) => {
    if (name === "AutoVisuals") return "text-pink-500";
    if (name === "AutoTrac") return "text-blue-500";
    if (name === "AutoStock") return "text-green-500";
    return "text-neutral-900 dark:text-neutral-100";
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

  return (
    <div className="mx-auto max-w-md px-3 py-3 text-neutral-900 dark:text-neutral-100">
      <div className="flex gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800
                     text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
        >
          <option value="All">All projects</option>
          {FIXED.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={() => setManualOpen(true)}
          className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                     bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          title="Add manual time"
        >
          + Manual
        </button>

        <button
          onClick={loadAll}
          className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                     bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <ManualTimeModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        projects={projects}
        onCreated={loadAll}
      />

      <FeedCard
        title="Totals overview"
        subtitle={`Stacked by date (last ${DAYS} days) • Swipe left/right on charts`}
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Daily time (hours) — stacked by project
            </p>

            {/* Light chart panel + horizontal scroll */}
            <div className="rounded-2xl bg-white p-2 shadow-sm border border-neutral-200">
              <div className="overflow-x-auto">
                <div style={{ width: chartInnerWidthPx(lastNDaysKeys.length) }}>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyTimeData}
                        margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        <CartesianGrid
                          stroke={GG.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={16}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          width={30}
                        />
                        <Tooltip content={<GgTooltip />} />
                        <Legend
                          verticalAlign="top"
                          align="left"
                          iconType="square"
                          wrapperStyle={{
                            fontSize: 12,
                            color: GG.axis,
                            paddingBottom: 8,
                          }}
                        />

                        <Bar
                          dataKey="AutoStock"
                          stackId="time"
                          fill={PROJECT_COLORS.AutoStock}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                        <Bar
                          dataKey="AutoTrac"
                          stackId="time"
                          fill={PROJECT_COLORS.AutoTrac}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                        <Bar
                          dataKey="AutoVisuals"
                          stackId="time"
                          fill={PROJECT_COLORS.AutoVisuals}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Swipe left/right to view more days
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs mb-2 text-neutral-600 dark:text-neutral-400">
              Daily income (£) — stacked by project (auto FX)
            </p>

            {/* Light chart panel + horizontal scroll */}
            <div className="rounded-2xl bg-white p-2 shadow-sm border border-neutral-200">
              <div className="overflow-x-auto">
                <div style={{ width: chartInnerWidthPx(lastNDaysKeys.length) }}>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyIncomeData}
                        margin={{ top: 6, right: 12, bottom: 6, left: 0 }}
                        barCategoryGap={10}
                      >
                        <CartesianGrid
                          stroke={GG.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={16}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: GG.axis }}
                          tickLine={false}
                          axisLine={false}
                          width={30}
                        />
                        <Tooltip content={<GgTooltip />} />
                        <Legend
                          verticalAlign="top"
                          align="left"
                          iconType="square"
                          wrapperStyle={{
                            fontSize: 12,
                            color: GG.axis,
                            paddingBottom: 8,
                          }}
                        />

                        <Bar
                          dataKey="AutoStock"
                          stackId="income"
                          fill={PROJECT_COLORS.AutoStock}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                        <Bar
                          dataKey="AutoTrac"
                          stackId="income"
                          fill={PROJECT_COLORS.AutoTrac}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                        <Bar
                          dataKey="AutoVisuals"
                          stackId="income"
                          fill={PROJECT_COLORS.AutoVisuals}
                          radius={[6, 6, 0, 0]}
                          fillOpacity={0.85}
                        />
                      </BarChart>
                    </ResponsiveContainer>
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
        <ul className="space-y-2 text-sm">
          {FIXED.map((name) => (
            <li key={name} className="flex justify-between items-center">
              <span
                className={
                  name === "AutoVisuals"
                    ? "font-medium text-pink-500"
                    : name === "AutoTrac"
                    ? "font-medium text-blue-500"
                    : "font-medium text-green-500"
                }
              >
                {name}
              </span>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                ⏱ {fmtHours(weeklyTimeTotals[name])} · 💰 £
                {weeklyIncomeTotals[name].toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </FeedCard>

      <FeedCard title="Recent time entries" subtitle="Latest 10">
        <ul className="space-y-2">
          {recentTimeEntries.map((e) => {
            const pname = projectMap[e.project_id] || `Project #${e.project_id}`;
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div className={projectColorClass(pname)}>
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

            return (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-700
                           bg-white dark:bg-neutral-800 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <div className={projectColorClass(pname)}>
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
