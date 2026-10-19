"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE, apiRequest, showToast } from "@/lib/api";
import { Info } from "lucide-react";
import { DeletePaperButton } from "@/components/DeletePaperButton";

interface PaperSummary {
  paperId: string;
  title?: string | null;
  displayName?: string | null;
  authors?: string | null;
  year?: number | null;
  journal?: string | null;
  status: string;
  createdAt?: string;
  pdfPath?: string | null;
  originalFilename?: string | null;
}

/** Title, else the uploaded PDF's filename, else the paper ID. Never a made-up placeholder. */
function displayTitle(p: PaperSummary): string {
  if (p.displayName) return p.displayName;
  if (p.title && p.title.trim()) return p.title.trim();
  const file = p.originalFilename || p.pdfPath?.split("/").pop();
  return file || p.paperId;
}

function shortAuthors(authors?: string | null): string | null {
  if (!authors) return null;
  const list = authors.split(",").map((a) => a.trim()).filter(Boolean);
  return list.length > 3 ? `${list[0]} et al.` : list.join(", ");
}

function byNewest(a: PaperSummary, b: PaperSummary) {
  return (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0);
}

export default function StudioPapers({privateWorkspace = false, reviewerName = "Studio visitor"}: {privateWorkspace?: boolean; reviewerName?: string}) {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [capabilities, setCapabilities] = useState<{mode: string; processingEnabled: boolean; authenticationRequired?: boolean} | null>(null);
  const [availability, setAvailability] = useState<'checking' | 'ready' | 'offline'>('checking');
  const [actionError, setActionError] = useState('');
  const canProcess = availability === 'ready' && capabilities?.processingEnabled === true
    && (privateWorkspace || capabilities.authenticationRequired === false);
  const helper = availability === 'checking' ? 'Checking processing availability…'
    : availability === 'offline' ? 'Processing availability could not be confirmed. Actions are disabled until the backend is reachable.'
    : !capabilities?.processingEnabled ? 'New uploads, PDF URL fetching and sample processing need the full processing environment.'
    : !canProcess ? 'This processing environment requires authorized workspace access. Public previews remain available without login.'
    : 'PDF files up to 25 MB. Choose a file, drop it here, or fetch a paper URL.';
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (privateWorkspace) fetchPapers();
    else setLoading(false);
    let active = true;
    const request = privateWorkspace
      ? apiRequest<{mode: string; processingEnabled: boolean}>("/api/capabilities", {silent: true})
      : fetch(`${API_BASE}/api/public/capabilities`, {credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000)})
        .then(async response => {if (!response.ok) throw new Error('Capabilities unavailable'); return response.json();});
    request.then(data => {
      if (typeof data.processingEnabled !== 'boolean' || !['api','full'].includes(data.mode)
          || (!privateWorkspace && typeof data.authenticationRequired !== 'boolean')) throw new Error('Invalid capabilities');
      if (active) {setCapabilities(data); setAvailability('ready');}
    }).catch(() => {if (active) setAvailability('offline');});
    return () => {active = false;};
  }, [privateWorkspace]);

  const fetchPapers = async () => {
    try {
      const data = (await apiRequest<PaperSummary[]>("/api/papers")).slice().sort(byNewest);
      setPapers(data);
      // Older list payloads carry only the title; fill authors/year/journal from each paper's detail
      const missing = data.filter((p) => p.authors === undefined).slice(0, 25);
      if (missing.length > 0) {
        const details = await Promise.all(
          missing.map((p) => apiRequest<PaperSummary>(`/api/papers/${p.paperId}`, { silent: true }).catch(() => null))
        );
        const byId = new Map(details.filter(Boolean).map((d) => [d!.paperId, d!]));
        setPapers((prev) =>
          prev.map((p) => {
            const d = byId.get(p.paperId);
            return d ? { ...p, title: p.title ?? d.title, authors: d.authors, year: d.year, journal: d.journal } : p;
          })
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!canProcess || uploading) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {setActionError('Please select a PDF file.'); return;}
    if (file.size > 25 * 1024 * 1024) {setActionError('PDF files must be 25 MB or smaller.'); return;}
    setActionError('');
    setUploading(true);
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (theme.trim()) {
        formData.append("theme", theme.trim());
      }

      const data = await apiRequest<{ paperId: string }>("/api/papers", { method: "POST", body: formData });
      showToast(`Paper ${data.paperId} uploaded`, "success");

      await apiRequest(`/api/papers/${data.paperId}/human-events`, {
        method: "POST",
        body: JSON.stringify({ kind: "UPLOAD", actor: reviewerName, seconds: elapsedSeconds }),
        silent: true,
      }).catch(() => {});

      router.push(`/papers/${data.paperId}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProcess || uploading || !urlInput.trim()) return;
    setActionError('');
    setUploading(true);
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    try {
      const formData = new FormData();
      formData.append("url", urlInput.trim());
      if (theme.trim()) formData.append("theme", theme.trim());
      const data = await apiRequest<{ paperId: string }>("/api/papers", { method: "POST", body: formData });
      showToast(`Paper ${data.paperId} registered`, "success");

      await apiRequest(`/api/papers/${data.paperId}/human-events`, {
        method: "POST",
        body: JSON.stringify({ kind: "UPLOAD", actor: reviewerName, seconds: elapsedSeconds }),
        silent: true,
      }).catch(() => {});

      router.push(`/papers/${data.paperId}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Paper fetch failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSamplePaper = () => {
    if (!canProcess || uploading) return;
    // If P-0001 exists in database, go directly to it
    const existingP1 = papers.find((p) => p.paperId === "P-0001" && /hall|kahan/i.test(`${p.authors || ''} ${p.title || ''}`));
    if (existingP1) {
      router.push("/papers/P-0001");
    } else {
      setUrlInput("https://doi.org/10.1016/j.mcna.2017.08.012");
      setTheme("Weight regain biology & metabolic adaptation");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXPORTED":
        return "bg-emerald-900/10 text-emerald-800 border-emerald-300";
      case "AWAITING_CLAIM_REVIEW":
        return "bg-amber-900/10 text-amber-800 border-amber-300 font-semibold";
      case "AWAITING_ASSET_REVIEW":
        return "bg-blue-900/10 text-blue-800 border-blue-300 font-semibold";
      case "PARSING":
      case "EXTRACTING":
      case "VERIFYING":
      case "WRITING":
      case "RENDERING":
        return "bg-purple-900/10 text-purple-800 border-purple-300 animate-pulse";
      case "FAILED":
        return "bg-red-900/10 text-red-800 border-red-300";
      default:
        return "bg-blush/40 text-ink border-blush";
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto px-4 py-8">
      {/* Hero Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-ink mb-3 tracking-tight">
          Clinical metabolic evidence, <span className="italic text-rust">verified</span>.
        </h1>
        <p className="text-clay text-sm sm:text-base leading-relaxed">
          Upload clinical research papers to extract and audit claims with doctor oversight,
          then turn the approved ones into carousel, static, reel and caption drafts that link back to the paper.
        </p>
      </div>

      {/* Upload Box */}
      <div data-testid="studio-upload" className="bg-softPaper border border-blush rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Drag & Drop Area */}
          <div
            role="button"
            aria-label="Choose or drop a clinical PDF"
            aria-disabled={!canProcess || uploading}
            aria-describedby="studio-processing-help"
            tabIndex={canProcess && !uploading ? 0 : -1}
            onKeyDown={event => {if (canProcess && !uploading && ['Enter',' '].includes(event.key)) {event.preventDefault(); document.getElementById('file-upload')?.click();}}}
            onDragOver={(e) => {
              e.preventDefault();
              if (canProcess && !uploading) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.[0]) {
                handleUploadFile(e.dataTransfer.files[0]);
              }
            }}
            className={`flex-1 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer w-full ${
              dragActive ? "border-rust bg-cream" : "border-blush hover:border-clay bg-cream/50"
            } ${!canProcess || uploading ? 'cursor-not-allowed opacity-60' : ''}`}
            onClick={() => {
              if (!canProcess || uploading) return;
              const fileInput = document.getElementById("file-upload") as HTMLInputElement;
              fileInput?.click();
            }}
          >
            <input
              id="file-upload"
              type="file"
              disabled={!canProcess || uploading}
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-2 text-rust">📄</span>
              <p className="text-sm font-medium text-ink mb-1">
                {uploading ? "Processing PDF..." : "Drag & drop clinical PDF paper here"}
              </p>
              <p className="text-xs text-clay">or click to browse your computer</p>
            </div>
          </div>

          {/* Form options & URL input */}
          <div className="w-full md:w-80 flex flex-col gap-4">
            <div>
              <label htmlFor="editorial-theme" className="block text-xs uppercase tracking-wider text-clay font-medium mb-1">
                Optional Editorial Theme
              </label>
              <input
                id="editorial-theme"
                type="text"
                placeholder="e.g. Weight regain biology"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-blush rounded-lg bg-cream text-ink focus:outline-none focus:border-rust"
              />
            </div>

            <div>
              <label htmlFor="paper-url" className="block text-xs uppercase tracking-wider text-clay font-medium mb-1">
                Or paste PDF URL
              </label>
              <form onSubmit={handleUrlSubmit} className="flex gap-2">
                <input
                  id="paper-url"
                  aria-describedby="studio-processing-help"
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2 text-xs border border-blush rounded-lg bg-cream text-ink focus:outline-none focus:border-rust"
                />
                <button
                  type="submit"
                  disabled={!canProcess || uploading || !urlInput.trim()}
                  aria-describedby="studio-processing-help"
                  className="px-3 py-2 text-xs bg-rust text-cream font-medium rounded-lg hover:bg-rust/90 disabled:opacity-50 transition-colors"
                >
                  Fetch
                </button>
              </form>
            </div>

            <div className="pt-2 border-t border-blush">
              <button
                type="button"
                onClick={handleSamplePaper}
                disabled={!canProcess || uploading}
                aria-describedby="studio-processing-help"
                className="w-full py-2 px-3 text-xs text-rust font-medium bg-cream border border-rust/30 rounded-lg hover:bg-blush/30 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sample: Hall & Kahan (2018)
              </button>
            </div>
          </div>
        </div>
        <p id="studio-processing-help" role="status" className="text-xs text-clay mt-4">{helper}</p>
        {actionError && <p role="alert" className="text-sm text-rust mt-3">{actionError}</p>}
      </div>

      {availability !== 'checking' && !canProcess && <aside data-testid="studio-disclaimer" className="mt-5 mb-10 border border-blush rounded-xl bg-cream px-5 py-5 flex items-start gap-3">
        <Info size={18} aria-hidden="true" className="text-clay shrink-0 mt-1"/>
        <div><h2 className="font-serif text-xl text-maroon">{availability === 'offline' ? 'Processing availability could not be confirmed' : capabilities?.processingEnabled ? 'Live processing requires authorized workspace access' : 'Live processing is unavailable in this deployment'}</h2>
          <p className="text-sm text-clay mt-2 leading-relaxed">{availability === 'offline' ? 'The backend may be starting or temporarily unreachable. Processing actions remain disabled until availability can be confirmed. You can still explore completed examples.' : capabilities?.processingEnabled ? 'This full processing environment protects new jobs and private records. Processing actions remain available in the authorized workspace; the public examples need no login.' : 'This hosted version allows you to explore completed research-to-content examples. Uploading and processing new papers, AI content generation, and reel rendering require the full processing environment.'}</p>
          <Link href="/#examples" className="inline-block text-sm text-rust mt-3 underline underline-offset-4">Explore Completed Examples →</Link>
        </div>
      </aside>}

      {/* Papers List */}
      {privateWorkspace && <div className="mt-12">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-2xl text-ink font-normal">Active Papers in SteerProof</h2>
          <span className="text-xs text-clay">{papers.length} paper{papers.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-clay text-sm">Loading papers...</div>
        ) : papers.length === 0 ? (
          <div className="bg-softPaper border border-blush rounded-xl p-8 text-center text-clay text-sm">
            No papers registered yet. Upload your first clinical study above.
          </div>
        ) : (
          <div className="grid gap-3">
            {papers.map((p) => (
              <div
                key={p.paperId}
                data-testid="paper-row"
                className="bg-softPaper hover:bg-cream border border-blush hover:border-clay rounded-xl p-4 sm:p-5 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 group"
              >
                <Link href={`/papers/${p.paperId}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-clay">{p.paperId}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getStatusBadge(p.status)}`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="font-sans font-medium text-ink group-hover:text-rust transition-colors text-base line-clamp-1">
                    {displayTitle(p)}
                  </h3>
                  <p className="text-xs text-clay mt-1">
                    {[shortAuthors(p.authors), p.year, p.journal].filter(Boolean).join(" · ")}
                  </p>
                </Link>

                <div className="flex items-center gap-3">
                  <Link href={`/papers/${p.paperId}`} className="text-xs text-rust font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Pipeline →
                  </Link>
                  <DeletePaperButton paperId={p.paperId} paperName={displayTitle(p)} processing={["PARSING", "EXTRACTING", "VERIFYING", "WRITING", "RENDERING"].includes(p.status)} onDeleted={() => setPapers((previous) => previous.filter((paper) => paper.paperId !== p.paperId))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}
