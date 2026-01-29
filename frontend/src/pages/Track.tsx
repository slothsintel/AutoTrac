import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";

type Project = { id: number; name: string };
type TimeEntry = {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  note?: string;
};

const TimerIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2" />
    <path d="M9 3h6" />
  </svg>
);

export default function Track() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const [note, setNote] = useState("");

  const projectMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const loadAll = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        api.get(endpoints.projects),
        api.get(endpoints.timeEntries),
      ]);

      const p = pRes.data as Project[];
      const t = tRes.data as TimeEntry[];

      setProjects(p);
      setEntries(t);

      const running = t.find((e) => !e.end_time);
      setActive(running ?? null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const isRunning = !!active;

  // Ensure a project exists in backend for given name
  const ensureProjectByName = async (name: string): Promise<Project | null> => {
    if (!name) return null;

    const existing = projects.find((p) => p.name === name);
    if (existing) return existing;

    try {
      const res = await api.post(endpoints.projects, { name });
      const created = res.data as Project;
      setProjects((prev) => [...prev, created]);
      return created;
    } catch (err) {
      alert("Unable to create project. Please check backend.");
      console.error(err);
      return null;
    }
  };

  // START tracking
  const start = async () => {
    if (!selectedName) return;

    const project = await ensureProjectByName(selectedName);
    if (!project) return;

    try {
      const res = await api.post(endpoints.timeEntries, {
        project_id: project.id,
        start_time: new Date().toISOString(),
        note,
      });

      const created = res.data as TimeEntry;
      setActive(created);
      setEntries((prev) => [created, ...prev]);
      setNote("");
    } catch (err) {
      alert("Failed to start timer.");
      console.error(err);
    }
  };

  // STOP tracking
  const stop = async () => {
    if (!active) return;

    try {
      const res = await api.post(endpoints.stopEntry(active.id));
      const updated = res.data as TimeEntry;

      setActive(null);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      alert("Failed to stop timer.");
      console.error(err);
    }
  };

  // DELETE entry
  const deleteEntry = async (entryId: number) => {
    if (active?.id === entryId) {
      alert("Stop the running timer before deleting it.");
      return;
    }

    const yes = window.confirm(`Delete time entry #${entryId}?`);
    if (!yes) return;

    try {
      await api.delete(`${endpoints.timeEntries}${entryId}/`);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      alert("Failed to delete time entry. Make sure backend DELETE exists.");
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4 text-[var(--si-text)] dark:text-neutral-100">
      {/* HEADER */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--si-text)] dark:text-neutral-300">
          {TimerIcon}
        </span>
        <h1 className="text-lg font-semibold">Time tracker</h1>
      </div>

      {/* PROJECT SELECT */}
      <label className="block text-sm mb-1 text-[var(--si-muted)] dark:text-neutral-400">
        Project
      </label>

      <select
        value={selectedName}
        onChange={(e) => setSelectedName(e.target.value)}
        disabled={isRunning}
        className="w-full border border-[var(--si-border)] dark:border-neutral-700 
                   rounded-xl p-2 mb-3 bg-[var(--si-surface)] dark:bg-neutral-800 
                   text-[var(--si-text)] dark:text-neutral-100"
      >
        <option value="" disabled>
          Select project…
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      {/* NOTE INPUT */}
      <textarea
        placeholder="Note (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isRunning}
        className="w-full border border-[var(--si-border)] dark:border-neutral-700 
                   rounded-xl p-3 mb-4 bg-[var(--si-surface)] dark:bg-neutral-800 
                   text-[var(--si-text)] dark:text-neutral-100 min-h-[90px]"
      />

      {/* START / STOP BUTTON */}
      <button
        onClick={isRunning ? stop : start}
        className={`w-full py-4 rounded-full text-white text-lg font-semibold shadow-lg
          ${isRunning ? "bg-rose-600" : "bg-[var(--si-accent)] hover:opacity-95"}`}
      >
        {isRunning ? "Stop" : "Start"}
      </button>

      {/* RUNNING INFO */}
      {active && (
        <p className="text-sm text-[var(--si-muted)] dark:text-neutral-400 mt-3">
          Running entry #{active.id} since{" "}
          {new Date(active.start_time).toLocaleString()}
        </p>
      )}

      {/* RECENT ENTRIES */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--si-text)] dark:text-neutral-200">
          Recent entries
        </h2>
        <button
          onClick={loadAll}
          className="text-xs px-3 py-2 rounded-xl border border-[var(--si-border)] dark:border-neutral-700
                     bg-[var(--si-surface)] dark:bg-neutral-900 hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800"
        >
          Refresh
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {entries.slice(0, 20).map((e) => {
          const pname = projectMap[e.project_id] ?? `Project #${e.project_id}`;
          return (
            <li
              key={e.id}
              className="bg-[var(--si-surface)] dark:bg-neutral-800 border border-[var(--si-border)] dark:border-neutral-700 rounded-xl p-3
                         flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{pname}</div>
                <div className="text-xs text-[var(--si-muted)] dark:text-neutral-400">
                  #{e.id} · {new Date(e.start_time).toLocaleString()}
                  {e.end_time ? ` → ${new Date(e.end_time).toLocaleString()}` : " (running)"}
                </div>
                {e.note ? (
                  <div className="text-xs text-[var(--si-text)] dark:text-neutral-300 mt-1 break-words">
                    {e.note}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => deleteEntry(e.id)}
                className="px-3 py-2 rounded-xl border border-[var(--si-border)] dark:border-neutral-700 text-sm
                           bg-[var(--si-surface)] dark:bg-neutral-900 hover:bg-[var(--si-surface-2)] dark:hover:bg-neutral-800"
                title="Delete time entry"
              >
                🗑️
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
