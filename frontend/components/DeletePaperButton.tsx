"use client";

import { useState } from "react";
import { useReviewer } from "@/components/ReviewerContext";
import { apiRequest, showToast } from "@/lib/api";

export function DeletePaperButton({ paperId, paperName, processing, onDeleted }: {
  paperId: string;
  paperName: string;
  processing: boolean;
  onDeleted: () => void;
}) {
  const { reviewerName } = useReviewer();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deletePaper() {
    setDeleting(true);
    try {
      await apiRequest(`/api/papers/${paperId}`, {
        method: "DELETE",
        body: JSON.stringify({ actor: reviewerName }),
      });
      setOpen(false);
      onDeleted();
      showToast("Paper deleted", "success");
    } catch {
      // apiRequest displays the server error.
    } finally {
      setDeleting(false);
    }
  }

  return <>
    <button
      type="button"
      disabled={processing}
      title={processing ? "Wait for processing to finish before deleting" : "Delete paper"}
      onClick={() => setOpen(true)}
      className="px-3 py-1.5 rounded-lg border border-blush text-rust text-xs font-medium hover:bg-blush/30 disabled:opacity-50"
    >Delete</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Delete paper">
      <div className="w-full max-w-md rounded-xl border border-blush bg-cream p-6 shadow-xl space-y-4">
        <h2 className="font-serif text-2xl text-ink">Delete paper?</h2>
        <p className="text-sm text-ink">{paperName}</p>
        <p className="text-sm text-clay">This permanently deletes the uploaded PDF, claims, generated assets, and exports. Audit history is retained.</p>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="px-3 py-2 text-sm border border-blush rounded-lg text-ink">Cancel</button>
          <button type="button" disabled={deleting} onClick={deletePaper} className="px-3 py-2 text-sm rounded-lg bg-rust text-cream disabled:opacity-50">{deleting ? "Deleting..." : "Delete paper"}</button>
        </div>
      </div>
    </div>}
  </>;
}
