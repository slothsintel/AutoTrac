// frontend/src/pages/Auth.tsx
import { useMemo, useState } from "react";
import api, { endpoints, setToken } from "../api";

function utf8ByteLen(s: string) {
  return new TextEncoder().encode(s).length;
}

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pwBytes = useMemo(() revealed to=file_search.msearch code
