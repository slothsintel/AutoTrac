import { useEffect, useState } from "react";
import api from "../api";

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
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.get("/projects/").then((r) => setProjects(r.data));
    api.get("/time-entries/").then((r) => {
      const running = r.data.find((e: TimeEntry) => !e.end_time);
      setActive(running ?? null);
    });
  }, []);

  const isRunning = !!active;
  const btnLabel = isRunning ? "Stop" : "Start";

  const start = async () => {
    if (!selected) return;
    const res = await api.post("/time-entries/", {
      project_id: selected,
      start_time: new Date().toISOString(),
      note,
    });
    setActive(res.data);
    setNote("");
  };

  const stop = async () => {
    if (!active) return;
    const res = await api.post(`/time-entries/${active.id}/stop`);
    setActive(res.data);
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4 text-neutral-900 dark:text-neutral-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-neutral-700 dark:text-neutral-300">
          {TimerIcon}
        </span>
        <h1 className="text-lg font-semibold">Time tracker</h1>
      </div>

      <label className="block text-sm mb-1 text-neutral-600 dark:text-neutral-400">
        Project
      </label>

      <select
        value={selected ?? ""}
        onChange={(e) => setSelected(Number(e.target.value))}
        disabled={isRunning}
        className="w-full border border-neutral-200 dark:border-neutral-700 
                   rounded-xl p-2 mb-3 bg-white dark:bg-neutral-800 
                   text-neutral-900 dark:text-neutral-100"
      >
        <option value="" disabled>
          Select project…
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Note (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isRunning}
        className="w-full border border-neutral-200 dark:border-neutral-700 
                   rounded-xl p-3 mb-6 bg-white dark:bg-neutral-800 
                   text-neutral-900 dark:text-neutral-100 min-h-[90px]"
      />

      <button
        onClick={isRunning ? stop : start}
        className={`w-full py-4 rounded-full text-white text-lg font-semibold shadow-lg
          ${isRunning ? "bg-rose-600" : "bg-blue-600"}`}
      >
        {btnLabel}
      </button>

      {active && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">
          Running entry #{active.id} since{" "}
          {new Date(active.start_time).toLocaleString()}
        </p>
      )}
    </div>
  );
}
