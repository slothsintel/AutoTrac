import { useEffect, useState } from "react";

const API_BASE = "https://autotrac-35sx.onrender.com"; // keep or change later

interface Project {
  id: number;
  name: string;
  client?: string | null;
  hourly_rate?: number | null;
  notes?: string | null;
}

interface TimeEntry {
  id: number;
  project_id: number;
  start_time: string;
  end_time?: string | null;
  note?: string | null;
}

interface IncomeRecord {
  id: number;
  project_id: number;
  date: string;
  amount: number;
  source?: string | null;
  note?: string | null;
}

interface ProjectSummary {
  project: Project;
  total_minutes: number;
  total_income: number;
  effective_hourly_rate?: number | null;
}

type RangeType = "all" | "this_month" | "last_30" | "custom";

type PendingKind = "time" | "income";

interface PendingItem {
  id: string;
  type: PendingKind;
  payload: any; // TimeEntryCreate or IncomeCreate shape
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = "autotrac_offline_queue";

function formatMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remaining = Math.round(mins - hours * 60);
  if (hours === 0) return `${remaining} min`;
  return `${hours} h ${remaining} min`;
}

function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

// --- Offline queue helpers ---

function loadQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingItem[];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingItem[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToQueue(item: PendingItem): PendingItem[] {
  const q = loadQueue();
  q.push(item);
  saveQueue(q);
  return q;
}

function setQueue(queue: PendingItem[]): PendingItem[] {
  saveQueue(queue);
  return queue;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [creatingProject, setCreatingProject] = useState(false);
  const [timerNote, setTimerNote] = useState("");
  const [isStartingTimer, setIsStartingTimer] = useState(false);
  const [isStoppingTimer, setIsStoppingTimer] = useState(false);

  // Income form
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState<string>("");
  const [incomeSource, setIncomeSource] = useState("");
  const [incomeNote, setIncomeNote] = useState("");
  const [creatingIncome, setCreatingIncome] = useState(false);

  // Filters
  const [rangeType, setRangeType] = useState<RangeType>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Offline / sync state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(loadQueue().length);
  const [syncing, setSyncing] = useState(false);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || null;

  async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }
    return res.json();
  }

  // --- Filter helpers ---

  function getRangeDates(): { dateFromIso?: string; dateToIso?: string } {
    if (rangeType === "all") return {};
    const now = new Date();

    if (rangeType === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { dateFromIso: start.toISOString(), dateToIso: now.toISOString() };
    }

    if (rangeType === "last_30") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { dateFromIso: start.toISOString(), dateToIso: now.toISOString() };
    }

    let dateFromIso: string | undefined;
    let dateToIso: string | undefined;

    if (customStart) {
      const start = new Date(customStart + "T00:00:00");
      dateFromIso = start.toISOString();
    }
    if (customEnd) {
      const end = new Date(customEnd + "T23:59:59");
      dateToIso = end.toISOString();
    }

    return { dateFromIso, dateToIso };
  }

  function buildQueryParams(
    includeProjectId: boolean,
    projectId?: number
  ): string {
    const params: string[] = [];
    const { dateFromIso, dateToIso } = getRangeDates();

    if (includeProjectId && projectId != null) {
      params.push(`project_id=${projectId}`);
    }
    if (dateFromIso) {
      params.push(`date_from=${encodeURIComponent(dateFromIso)}`);
    }
    if (dateToIso) {
      params.push(`date_to=${encodeURIComponent(dateToIso)}`);
    }

    return params.join("&");
  }

  // --- Sync offline queue to backend ---
  // mode = "manual"  → show alerts
  // mode = "auto"    → be quiet (used when coming online)
  const syncQueueToServer = async (mode: "manual" | "auto" = "manual") => {
    if (!navigator.onLine) {
      if (mode === "manual") {
        alert("You are offline – connect to the internet first.");
      }
      return;
    }

    const queue = loadQueue();
    if (queue.length === 0) {
      if (mode === "manual") {
        alert("Nothing to sync – offline queue is empty.");
      }
      return;
    }

    setSyncing(true);
    let remaining: PendingItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === "time") {
          await fetchJson(`${API_BASE}/time-entries/`, {
            method: "POST",
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === "income") {
          await fetchJson(`${API_BASE}/incomes/`, {
            method: "POST",
            body: JSON.stringify(item.payload),
          });
        }
      } catch (err) {
        console.error("Failed to sync item", item, err);
        remaining.push(item);
      }
    }

    setQueue(remaining);
    setPendingCount(remaining.length);

    if (selectedProjectId != null) {
      await loadProjectDetails(selectedProjectId);
    }
    setSyncing(false);

    if (mode === "manual") {
      if (remaining.length === 0) {
        alert("Offline items synced successfully.");
      } else {
        alert(`Some items could not be synced (${remaining.length} left).`);
      }
    } else {
      // auto mode: log to console only
      if (remaining.length === 0) {
        console.log("[AutoTrac] Auto-sync complete.");
      } else {
        console.warn(
          `[AutoTrac] Auto-sync incomplete, ${remaining.length} items still pending.`
        );
      }
    }
  };

  // --- Load projects ---

  const loadProjects = async () => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const data = await fetchJson<Project[]>(`${API_BASE}/projects/`);
      setProjects(data);
      if (!selectedProjectId && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err: any) {
      setProjectError(err.message ?? "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  // --- Load details for selected project (server + pending offline items) ---

  const loadProjectDetails = async (projectId: number) => {
    setLoadingDetails(true);
    try {
      const timeParams = buildQueryParams(true, projectId);
      const dateParams = buildQueryParams(false);

      const timeUrl = `${API_BASE}/time-entries/${
        timeParams ? "?" + timeParams : ""
      }`;
      const incomeUrl = `${API_BASE}/incomes/${
        timeParams ? "?" + timeParams : ""
      }`;
      const summaryUrl = `${API_BASE}/projects/${projectId}/summary${
        dateParams ? "?" + dateParams : ""
      }`;

      const [entries, incomesData, summaryData] = await Promise.all([
        fetchJson<TimeEntry[]>(timeUrl),
        fetchJson<IncomeRecord[]>(incomeUrl),
        fetchJson<ProjectSummary>(summaryUrl),
      ]);

      // Merge pending offline items
      const queue = loadQueue();

      const pendingTimes = queue
        .filter((q) => q.type === "time" && q.payload.project_id === projectId)
        .map((q, index) => {
          const p = q.payload;
          const id = -100000 - index; // negative id
          return {
            id,
            project_id: p.project_id,
            start_time: p.start_time,
            end_time: p.end_time ?? null,
            note: (p.note || "") + " (pending)",
          } as TimeEntry;
        });

      const pendingIncomes = queue
        .filter((q) => q.type === "income" && q.payload.project_id === projectId)
        .map((q, index) => {
          const p = q.payload;
          const id = -200000 - index;
          return {
            id,
            project_id: p.project_id,
            date: p.date,
            amount: p.amount,
            source: (p.source || "") + " (pending)",
            note: p.note,
          } as IncomeRecord;
        });

      setTimeEntries([...pendingTimes, ...entries]);
      setIncomes([...pendingIncomes, ...incomesData]);
      setSummary(summaryData);
      setPendingCount(queue.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // initial load
  useEffect(() => {
    loadProjects();
  }, []);

  // reload details when project or filter changes
  useEffect(() => {
    if (selectedProjectId != null) {
      loadProjectDetails(selectedProjectId);
    } else {
      setTimeEntries([]);
      setIncomes([]);
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, rangeType]);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);

      // refresh pendingCount from local queue
      const q = loadQueue();
      setPendingCount(q.length);

      // if there is anything to sync, do it automatically (quietly)
      if (q.length > 0) {
        syncQueueToServer("auto");
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // --- Create project ---

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const proj = await fetchJson<Project>(`${API_BASE}/projects/`, {
        method: "POST",
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      setNewProjectName("");
      await loadProjects();
      setSelectedProjectId(proj.id);
    } catch (err) {
      console.error(err);
      alert("Failed to create project (backend needed for this).");
    } finally {
      setCreatingProject(false);
    }
  };

  // --- Timer actions with offline support ---

  const handleStartTimer = async () => {
    if (!selectedProject) return;

    const nowIso = new Date().toISOString();

    // If offline: create a local active entry only
    if (!navigator.onLine) {
      const tempId = -Math.floor(Math.random() * 1000000);
      const newEntry: TimeEntry = {
        id: tempId,
        project_id: selectedProject.id,
        start_time: nowIso,
        end_time: null,
        note: timerNote || null,
      };
      setTimeEntries((prev) => [newEntry, ...prev]);
      setTimerNote("");
      alert("Timer started offline – will be saved when you stop & sync.");
      return;
    }

    setIsStartingTimer(true);
    try {
      await fetchJson<TimeEntry>(`${API_BASE}/time-entries/`, {
        method: "POST",
        body: JSON.stringify({
          project_id: selectedProject.id,
          start_time: nowIso,
          end_time: null,
          note: timerNote || null,
        }),
      });
      setTimerNote("");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
      alert("Backend unreachable; starting timer offline instead.");
      const tempId = -Math.floor(Math.random() * 1000000);
      const newEntry: TimeEntry = {
        id: tempId,
        project_id: selectedProject.id,
        start_time: nowIso,
        end_time: null,
        note: timerNote || null,
      };
      setTimeEntries((prev) => [newEntry, ...prev]);
      setTimerNote("");
    } finally {
      setIsStartingTimer(false);
    }
  };

  const handleStopTimer = async () => {
    if (!selectedProject) return;

    // Find any active entry (server or local)
    const runningEntry =
      timeEntries.find(
        (e) => !e.end_time && e.project_id === selectedProject.id
      ) || null;

    if (!runningEntry) {
      alert("No running timer to stop.");
      return;
    }

    const endIso = new Date().toISOString();

    // If this is a local-only entry (id negative OR offline), queue it
    if (runningEntry.id < 0 || !navigator.onLine) {
      // update local state
      setTimeEntries((prev) =>
        prev.map((e) =>
          e.id === runningEntry.id ? { ...e, end_time: endIso } : e
        )
      );

      // build payload and push into offline queue
      const payload = {
        project_id: runningEntry.project_id,
        start_time: runningEntry.start_time,
        end_time: endIso,
        note: runningEntry.note,
      };
      const item: PendingItem = {
        id: "time-" + Date.now(),
        type: "time",
        payload,
        createdAt: new Date().toISOString(),
      };
      const q = addToQueue(item);
      setPendingCount(q.length);
      alert("Timer stopped offline – entry queued for sync.");
      return;
    }

    // Normal online stop for server entry
    setIsStoppingTimer(true);
    try {
      await fetchJson<TimeEntry>(
        `${API_BASE}/time-entries/${runningEntry.id}/stop`,
        {
          method: "POST",
        }
      );
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
      alert("Backend unreachable; marking this session offline and queuing.");

      setTimeEntries((prev) =>
        prev.map((e) =>
          e.id === runningEntry.id ? { ...e, end_time: endIso } : e
        )
      );
      const payload = {
        project_id: runningEntry.project_id,
        start_time: runningEntry.start_time,
        end_time: endIso,
        note: runningEntry.note,
      };
      const item: PendingItem = {
        id: "time-" + Date.now(),
        type: "time",
        payload,
        createdAt: new Date().toISOString(),
      };
      const q = addToQueue(item);
      setPendingCount(q.length);
    } finally {
      setIsStoppingTimer(false);
    }
  };

  // --- Income creation with offline support ---

  const handleCreateIncome = async () => {
    if (!selectedProject) return;
    const amountNum = parseFloat(incomeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    let isoDate: string;
    if (incomeDate) {
      isoDate = new Date(incomeDate + "T00:00:00").toISOString();
    } else {
      isoDate = new Date().toISOString();
    }

    const payload = {
      project_id: selectedProject.id,
      date: isoDate,
      amount: amountNum,
      source: incomeSource || null,
      note: incomeNote || null,
    };

    // If offline, queue directly
    if (!navigator.onLine) {
      const item: PendingItem = {
        id: "income-" + Date.now(),
        type: "income",
        payload,
        createdAt: new Date().toISOString(),
      };
      const q = addToQueue(item);
      setPendingCount(q.length);

      // also show locally as pending
      const localIncome: IncomeRecord = {
        id: -Math.floor(Math.random() * 1000000),
        project_id: selectedProject.id,
        date: isoDate,
        amount: amountNum,
        source: (incomeSource || "") + " (pending)",
        note: incomeNote || null,
      };
      setIncomes((prev) => [localIncome, ...prev]);

      setIncomeAmount("");
      setIncomeSource("");
      setIncomeNote("");
      alert("Income saved offline – queued for sync.");
      return;
    }

    setCreatingIncome(true);
    try {
      await fetchJson<IncomeRecord>(`${API_BASE}/incomes/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setIncomeAmount("");
      setIncomeSource("");
      setIncomeNote("");
      await loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error(err);
      alert("Backend unreachable; income will be saved offline and synced later.");

      const item: PendingItem = {
        id: "income-" + Date.now(),
        type: "income",
        payload,
        createdAt: new Date().toISOString(),
      };
      const q = addToQueue(item);
      setPendingCount(q.length);

      const localIncome: IncomeRecord = {
        id: -Math.floor(Math.random() * 1000000),
        project_id: selectedProject.id,
        date: isoDate,
        amount: amountNum,
        source: (incomeSource || "") + " (pending)",
        note: incomeNote || null,
      };
      setIncomes((prev) => [localIncome, ...prev]);

      setIncomeAmount("");
      setIncomeSource("");
      setIncomeNote("");
    } finally {
      setCreatingIncome(false);
    }
  };

  // --- CSV export (unchanged, but now uses current filters) ---

  const handleExportCsv = async (kind: "time" | "incomes") => {
    if (!selectedProject) return;
    const dateParams = buildQueryParams(false);
    const url = `${API_BASE}/projects/${selectedProject.id}/export/${
      kind === "time" ? "time.csv" : "incomes.csv"
    }${dateParams ? "?" + dateParams : ""}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = selectedProject.name.replace(/\s+/g, "_").toLowerCase();
      a.href = href;
      a.download = `autotrac_${safeName}_${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error(err);
      alert("CSV export failed. Check console for details.");
    }
  };

  const handleApplyCustomRange = () => {
    if (selectedProjectId != null) {
      loadProjectDetails(selectedProjectId);
    }
  };

  // --- Render helpers (UI) ---

  const renderProjectList = () => (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Projects</h2>
        {loadingProjects && (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
        {projectError && (
          <p className="text-sm text-red-400">Error: {projectError}</p>
        )}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                p.id === selectedProjectId
                  ? "bg-sky-500/80 text-white"
                  : "bg-slate-800/70 text-slate-100 hover:bg-slate-700"
              }`}
            >
              <div className="font-medium">{p.name}</div>
              {p.client && (
                <div className="text-xs text-slate-300">{p.client}</div>
              )}
            </button>
          ))}
          {projects.length === 0 && !loadingProjects && (
            <p className="text-sm text-slate-400">No projects yet.</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-700 pt-3">
        <h3 className="text-sm font-medium text-slate-200 mb-2">Add project</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={handleCreateProject}
            disabled={creatingProject || !newProjectName.trim()}
            className="px-3 py-2 rounded-lg bg-sky-500 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-400 transition"
          >
            {creatingProject ? "Saving…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSummary = () => {
    if (!summary) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Total time
          </div>
          <div className="text-xl font-semibold text-slate-50">
            {formatMinutes(summary.total_minutes)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Total income
          </div>
          <div className="text-xl font-semibold text-emerald-400">
            {formatCurrency(summary.total_income)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Effective hourly
          </div>
          <div className="text-xl font-semibold text-sky-400">
            {summary.effective_hourly_rate != null
              ? formatCurrency(summary.effective_hourly_rate)
              : "—"}
          </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-wrap gap-2">
        {(["all", "this_month", "last_30"] as RangeType[]).map((type) => (
          <button
            key={type}
            onClick={() => setRangeType(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              rangeType === type
                ? "bg-sky-500 text-white border-sky-400"
                : "bg-slate-900 text-slate-200 border-slate-700 hover:border-sky-400/60"
            }`}
          >
            {type === "all"
              ? "All time"
              : type === "this_month"
              ? "This month"
              : "Last 30 days"}
          </button>
        ))}
        <button
          onClick={() => setRangeType("custom")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            rangeType === "custom"
              ? "bg-sky-500 text-white border-sky-400"
              : "bg-slate-900 text-slate-200 border-slate-700 hover:border-sky-400/60"
          }`}
        >
          Custom range
        </button>
      </div>

      {rangeType === "custom" && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            onClick={handleApplyCustomRange}
            className="px-3 py-1.5 rounded-lg bg-sky-500 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );

  const renderTimer = () => {
    if (!selectedProject) {
      return (
        <p className="text-sm text-slate-400">
          Select or create a project to start tracking time.
        </p>
      );
    }

    const isRunning =
      timeEntries.some(
        (e) => !e.end_time && e.project_id === selectedProject.id
      ) || false;

    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4 mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Timer – {selectedProject.name}
            </div>
            <div className="text-sm text-slate-200">
              {isRunning
                ? "Running… click Stop to finish this session."
                : "Idle – add a note and click Start to begin."}
            </div>
          </div>
          <div
            className={`h-3 w-3 rounded-full ${
              isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
            }`}
          ></div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Optional note (e.g. coding, admin)…"
            value={timerNote}
            onChange={(e) => setTimerNote(e.target.value)}
            disabled={isRunning}
            className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
          />

          {!isRunning ? (
            <button
              onClick={handleStartTimer}
              disabled={isStartingTimer}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isStartingTimer ? "Starting…" : "Start"}
            </button>
          ) : (
            <button
              onClick={handleStopTimer}
              disabled={isStoppingTimer}
              className="px-4 py-2 rounded-xl bg-rose-500 text-sm font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isStoppingTimer ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderTimeEntries = () => {
    if (!selectedProject) return null;

    return (
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100">
            Recent sessions
          </h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={() =>
                selectedProject && loadProjectDetails(selectedProject.id)
              }
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Refresh
            </button>
            <button
              onClick={() => handleExportCsv("time")}
              className="text-xs text-slate-200 px-2 py-1 rounded-lg border border-slate-600 hover:border-sky-400 hover:text-sky-300"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loadingDetails && (
          <p className="text-sm text-slate-400 mb-2">Loading…</p>
        )}

        {timeEntries.length === 0 && !loadingDetails && (
          <p className="text-sm text-slate-400">
            No time entries for this range.
          </p>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {timeEntries.map((e) => {
            const start = new Date(e.start_time);
            const end = e.end_time ? new Date(e.end_time) : null;
            let durationText = "Running…";
            if (end) {
              const diffMs = end.getTime() - start.getTime();
              const mins = diffMs / 1000 / 60;
              durationText = formatMinutes(mins);
            }

            const isPending = e.id < 0;

            return (
              <div
                key={e.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 flex justify-between gap-3"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {start.toLocaleString()}
                  </div>
                  {e.note && (
                    <div className="text-slate-300">{e.note}</div>
                  )}
                  {isPending && (
                    <div className="text-[10px] text-amber-300 mt-1">
                      Pending sync
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-slate-300">
                    {end ? end.toLocaleTimeString() : "…"}
                  </div>
                  <div className="text-sky-400 font-medium">
                    {durationText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderIncomeSection = () => {
    if (!selectedProject) return null;

    const quickPlatforms = [
      "Adobe Stock",
      "Shutterstock",
      "Freepik",
      "Client",
      "Other",
    ];

    return (
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100">
            Income records
          </h3>
          <div className="flex gap-2 items-center">
            <button
              onClick={() =>
                selectedProject && loadProjectDetails(selectedProject.id)
              }
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Refresh
            </button>
            <button
              onClick={() => handleExportCsv("incomes")}
              className="text-xs text-slate-200 px-2 py-1 rounded-lg border border-slate-600 hover:border-emerald-400 hover:text-emerald-300"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Add income form */}
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr,1fr,1fr,auto]">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">Amount (£)</label>
            <input
              type="number"
              step="0.01"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 25.00"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">Date</label>
            <input
              type="date"
              value={incomeDate}
              onChange={(e) => setIncomeDate(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-300">
              Source / platform
            </label>
            <input
              type="text"
              value={incomeSource}
              onChange={(e) => setIncomeSource(e.target.value)}
              placeholder="Shutterstock, Adobe, client name…"
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <label className="text-xs text-transparent md:text-xs md:text-slate-300">
              &nbsp;
            </label>
            <button
              onClick={handleCreateIncome}
              disabled={creatingIncome || !incomeAmount.trim()}
              className="w-full md:w-auto px-4 py-2 rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {creatingIncome ? "Adding…" : "Add income"}
            </button>
          </div>
        </div>

        {/* Quick platform tags */}
        <div className="mb-4 flex flex-wrap gap-2">
          {quickPlatforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setIncomeSource(p)}
              className={`px-3 py-1 rounded-full text-xs border ${
                incomeSource === p
                  ? "bg-emerald-500 text-slate-950 border-emerald-400"
                  : "bg-slate-950 text-slate-200 border-slate-700 hover:border-emerald-400/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Optional note */}
        <div className="mb-4">
          <label className="text-xs text-slate-300 mb-1 block">
            Note (optional)
          </label>
          <input
            type="text"
            value={incomeNote}
            onChange={(e) => setIncomeNote(e.target.value)}
            placeholder="Invoice no., batch, platform detail…"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Income list */}
        {incomes.length === 0 && (
          <p className="text-sm text-slate-400">
            No income records for this range.
          </p>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {incomes.map((inc) => {
            const d = new Date(inc.date);
            const isPending = inc.id < 0;
            return (
              <div
                key={inc.id}
                className="flex justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {d.toLocaleDateString()} – {formatCurrency(inc.amount)}
                  </div>
                  {inc.source && (
                    <div className="text-slate-300">{inc.source}</div>
                  )}
                  {inc.note && (
                    <div className="text-slate-400">{inc.note}</div>
                  )}
                  {isPending && (
                    <div className="text-[10px] text-amber-300 mt-1">
                      Pending sync
                    </div>
                  )}
                </div>
                <div className="text-right text-slate-500">
                  #{Math.abs(inc.id)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-6xl py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
              AutoTrac – Time & Income
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Track your project hours and income across Sloths Intel projects.
            </p>
          </div>

          {/* Online / offline + pending indicator */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOnline ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                ></span>
                {isOnline ? "Online" : "Offline"}
              </span>
              <span className="text-xs text-slate-400">
                Pending: {pendingCount}
              </span>
            </div>
            <button
              onClick={() => syncQueueToServer("manual")}
              disabled={syncing || pendingCount === 0}
              className="text-xs px-2 py-1 rounded-lg border border-slate-600 text-slate-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </header>

        <div className="grid md:grid-cols-[260px,1fr] gap-6">
          <aside className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            {renderProjectList()}
          </aside>

          <main className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
            {selectedProject ? (
              <>
                <div className="mb-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Selected project
                  </div>
                  <div className="text-lg font-semibold text-slate-50">
                    {selectedProject.name}
                  </div>
                  {selectedProject.notes && (
                    <p className="text-sm text-slate-300 mt-1">
                      {selectedProject.notes}
                    </p>
                  )}
                </div>

                {renderFilters()}
                {renderSummary()}
                {renderTimer()}
                {renderTimeEntries()}
                {renderIncomeSection()}
              </>
            ) : (
              <div className="text-sm text-slate-400">
                No project selected. Choose one from the left or create a new
                project.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
