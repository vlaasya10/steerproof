"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { readSession, saveSession, clearSession, type WorkspaceSession } from "@/lib/session";

export function WorkspaceAccess({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "login" | "ready" | "error">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [protectedWorkspace, setProtectedWorkspace] = useState(false);

  async function check() {
    setPhase("checking");
    try {
      const config = await apiRequest<{ enabled: boolean }>("/api/auth/config", { silent: true });
      setProtectedWorkspace(config.enabled);
      setPhase(config.enabled && !readSession() ? "login" : "ready");
    } catch {
      setPhase("error");
    }
  }

  useEffect(() => {
    check();
    const signedOut = () => { clearSession(); setPhase("login"); };
    window.addEventListener("steerproof:signout", signedOut);
    return () => window.removeEventListener("steerproof:signout", signedOut);
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = await apiRequest<WorkspaceSession>("/api/auth/login", {
        method: "POST", body: JSON.stringify({ password }), silent: true,
      });
      saveSession(session);
      setPassword("");
      setPhase("ready");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed");
    } finally { setBusy(false); }
  }

  if (phase === "ready") return <>
    {protectedWorkspace && <div className="bg-cream border-b border-blush px-4 py-1 text-right">
      <button onClick={() => { clearSession(); setPhase("login"); }} className="text-xs text-rust underline">Sign out</button>
    </div>}
    {children}
  </>;

  return <div className="min-h-screen flex items-center justify-center p-6">
    <div className="bg-softPaper border border-blush rounded-xl p-6 max-w-md w-full space-y-4">
      <h1 className="font-serif text-3xl text-rust">steer</h1>
      {phase === "checking" ? <p className="text-sm text-clay">Connecting to workspace...</p>
        : phase === "error" ? <>
          <p className="text-sm text-clay">The backend is unavailable. It may still be starting.</p>
          <button onClick={check} className="px-4 py-2 rounded bg-rust text-cream text-sm">Try again</button>
        </> : <form onSubmit={signIn} className="space-y-4">
          <h2 className="font-serif text-2xl text-ink">Sign in to your workspace</h2>
          <label className="block text-sm text-clay">Workspace password
            <input type="password" autoComplete="current-password" autoFocus required value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border border-blush bg-cream p-2 text-ink" />
          </label>
          {error && <p role="alert" className="text-sm text-rust">{error}</p>}
          <button disabled={busy || !password} className="px-4 py-2 rounded bg-rust text-cream text-sm disabled:opacity-50">{busy ? "Signing in..." : "Sign in"}</button>
        </form>}
    </div>
  </div>;
}
