"use client";

import {useEffect, useState} from "react";
import {apiRequest} from "@/lib/api";

interface Capabilities {processingEnabled: boolean; storageEphemeral: boolean; message: string}

export function ProcessingNotice() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    apiRequest<Capabilities>("/api/capabilities", {silent: true})
      .then(setCapabilities).catch(() => setUnavailable(true));
  }, []);
  if (unavailable) return <p role="status" className="bg-cream border-b border-blush px-6 py-3 text-sm text-clay">Unable to check processing availability. Try refreshing the page.</p>;
  if (!capabilities || (capabilities.processingEnabled && !capabilities.storageEphemeral)) return null;
  return <div role="status" className="bg-cream border-b border-blush px-6 py-3 text-sm text-clay">
    {!capabilities.processingEnabled && <p>{capabilities.message}</p>}
    {capabilities.processingEnabled && capabilities.storageEphemeral && <p>Files and caches use temporary storage and can be lost when this server restarts. Download your exports before leaving.</p>}
  </div>;
}
