// frontend/src/pages/Projects.tsx
import { useEffect, useMemo, useState } from "react";
import api, { endpoints } from "../api";

type Project = {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
};

function getErrMsg(e: any) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg ?? "").join(", ");
  return e?.message || "Request failed";
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoints.projects);
      setProjects(res.data ?? []);
    } catch (e: any) {
      console.error("Load projects error:", e?.response?.data || e);
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProject = async () => {
    if (!canCreate) return;

    setLoading(true);
    try {
      // ✅ Must match backend schemas.ProjectCreate
      await api.post(endpoints.projects, {
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
      });

      setName("");
      setDescription("");
      await loadProjects();
    } catch (e: any) {
      console.error("Create project error:", e?.response?.data || e);
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id: number) => {
    const ok = window.confirm("Delete this project? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    try {
      // Your backend route is DELETE /projects/{project_id}/
      await api.delete(`/projects/${id}/`);
      await loadProjects();
    } catch (e: any) {
      console.error("Delete project error:", e?.response?.data || e);
      alert(getErrMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-3 py-3">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Projects
            </div>
            <div className="text-xs text-neutral-500">
              Create and manage your projects (per account).
            </div>
          </div>
          <button
            onClick={() => void loadProjects()}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700
                       bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800
                       text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-neutral-600 dark:text-neutral-400">
              Project name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AutoTrac"
              className="mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-800
                         bg-white dark:bg-neutral-950 px-3 py-2 outline-none"
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 dark:text-neutral-400">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note..."
              className="mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-800
                         bg-white dark:bg-neutral-950 px-3 py-2 outline-none"
              disabled={loading}
            />
          </div>

          <button
            onClick={() => void createProject()}
            disabled={loading || !canCreate}
            className="w-full rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
                       px-4 py-2 font-semibold disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Add project"}
          </button>
        </div>

        <div className="mt-6">
          <div className="text-xs text-neutral-500 mb-2">
            Your projects ({projects.length})
          </div>

          <div className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border
                           border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {p.name}
                  </div>
                  {p.description ? (
                    <div className="text-xs text-neutral-500 truncate">
                      {p.description}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => void deleteProject(p.id)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700
                             bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800
                             text-xs font-semibold text-rose-600 dark:text-rose-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}

            {!loading && projects.length === 0 ? (
              <div className="text-sm text-neutral-500 py-4">
                No projects yet. Create your first one above.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
