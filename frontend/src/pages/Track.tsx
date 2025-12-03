import { useEffect, useMemo, useState } from "react";
import api from "../api";

type Project = { id:number; name:string };
type TimeEntry = { id:number; project_id:number; start_time:string; end_time:string|null; note?:string };

export default function Track() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive]   = useState<TimeEntry|null>(null);
  const [selected, setSelected] = useState<number|undefined>(undefined);
  const [note, setNote] = useState("");

  // load projects and latest entries
  useEffect(() => {
    api.get("/projects/").then(r => setProjects(r.data));
    api.get("/time-entries/").then(r => {
      const running = r.data.find((e:TimeEntry) => !e.end_time);
      setActive(running ?? null);
    });
  }, []);

  const isRunning = !!active;
  const btnLabel  = isRunning ? "Stop" : "Start";

  const start = async () => {
    if (!selected) return;
    const res = await api.post("/time-entries/", {
      project_id: selected, start_time: new Date().toISOString(), note
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
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="text-lg font-semibold mb-3">Time tracker</h1>

      <label className="block text-sm mb-1">Project</label>
      <select
        value={selected ?? ""}
        onChange={e => setSelected(Number(e.target.value))}
        disabled={isRunning}
        className="w-full border rounded-xl p-2 mb-3 bg-white"
      >
        <option value="" disabled>Select project…</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <textarea
        placeholder="Note (optional)…"
        value={note}
        onChange={e => setNote(e.target.value)}
        disabled={isRunning}
        className="w-full border rounded-xl p-3 mb-6 bg-white min-h-[90px]"
      />

      <button
        onClick={isRunning ? stop : start}
        className={`w-full py-4 rounded-full text-white text-lg font-semibold shadow-lg
          ${isRunning ? "bg-rose-600" : "bg-blue-600"}`}
      >
        {btnLabel}
      </button>

      {active && (
        <p className="text-sm text-neutral-600 mt-3">
          Running entry #{active.id} since {new Date(active.start_time).toLocaleString()}
        </p>
      )}
    </div>
  );
}
