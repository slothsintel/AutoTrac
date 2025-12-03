import { useEffect, useState } from "react";
import api from "../api";

type Project = { id:number; name:string; description?:string };

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { api.get("/projects/").then(r => setProjects(r.data)); }, []);

  const add = async () => {
    if (!name.trim()) return;
    const res = await api.post("/projects/", { name });
    setProjects([res.data, ...projects]);
    setName("");
  };

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="text-lg font-semibold mb-3">Projects</h1>

      <div className="flex gap-2 mb-4">
        <input className="flex-1 border rounded-xl p-2" placeholder="New project"
               value={name} onChange={e => setName(e.target.value)} />
        <button onClick={add} className="px-4 rounded-xl bg-blue-600 text-white">Add</button>
      </div>

      <ul className="space-y-2">
        {projects.map(p => (
          <li key={p.id} className="bg-white border rounded-xl p-3">
            <div className="font-medium">{p.name}</div>
            {p.description && <div className="text-sm text-neutral-600">{p.description}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
