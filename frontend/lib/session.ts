export interface WorkspaceSession {
  token: string;
  mediaToken: string;
  expiresAt: string;
}

const KEY = "steerproof_workspace_session";

export function readSession(): WorkspaceSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null") as WorkspaceSession | null;
    return value && typeof value.token === "string" && typeof value.mediaToken === "string"
      && Date.parse(value.expiresAt) > Date.now() ? value : null;
  } catch { return null; }
}

export function saveSession(session: WorkspaceSession) { sessionStorage.setItem(KEY, JSON.stringify(session)); }
export function clearSession() { sessionStorage.removeItem(KEY); }
