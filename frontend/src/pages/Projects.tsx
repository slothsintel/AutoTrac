import { useEffect, useState } from "react";
import { api, endpoints } from "../api";

interface Project {
  id: number;
  name: string;
  description?: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadProjects = async () => {
    const res = await api.get(endpoints.projects);
    setProjects(res.data);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const createProject = async () => {
    if (!name.trim()) return;

    try {
      setLoading(true);

      await api.post(endpoints.projects, {
        name: name.trim(),          // ✅ REQUIRED
        description: "",            // ✅ OPTIONAL but explicit
      });

      setName("");
      await loadProjects();
    } catch (err: any) {
      console.error(err?.response?.data || err);
      alert(
        err?.response?.data?.detail ||
          "Failed to create project. Please check backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Projects</h2>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
      />

      <button onClick={createProject} disabled={loading}>
        Add
      </button>

      <ul>
        {projects.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
