"use client";

import StudioPapers from "@/components/StudioPapers";
import {useReviewer} from "@/components/ReviewerContext";

export default function WorkspacePapers() {
  const {reviewerName} = useReviewer();
  return <StudioPapers privateWorkspace reviewerName={reviewerName}/>;
}
