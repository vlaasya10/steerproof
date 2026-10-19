export interface SourcePassage {
  passageId: string; page: number; section: string | null; text: string;
  bbox: {l: number; t: number; r: number; b: number}; pageWidth: number; pageHeight: number;
}
export interface ShowcaseClaim {
  claimId: string; scientificClaim: string; consumerDraft: string | null; approvedCopy: string | null; quote: string;
  quoteScore: number; reproducedQuoteScore: number; independentPageScore: number; independentRegionScore: number; numbersOk: boolean; entailment: string;
  risk: string; riskReason: string | null; populationFit: string; populationReason: string | null;
  population: string | null; studyDesign: string | null; findingClass: string; limitations: string[];
  doctorStatus: string; reviewedAt: string | null; reviewNote: string | null; evidence: SourcePassage;
}
export interface MediaFile {url: string; label: string; sha256: string; bytes: number; width?: number; height?: number}
export interface AssetBlock {
  key: string; label: string; headline: string; body: string; kind: string; claimIds: string[];
  startMs?: number; durationMs?: number;
  highlights?: {blockId: string; x: number; y: number; w: number; h: number; claimIds: string[]}[];
}
export interface ShowcaseAsset {
  assetId: string; type: string; status: string; version: number; approvedAt: string | null;
  blocks: AssetBlock[]; media: MediaFile[]; hashtags: string[]; subtitleUrl: string | null;
  downloadAllowed: boolean; availabilityNote: string; adaptations: string[];
  violations: {rule: string; severity: string; detail: string; resolved: boolean; location: string | null}[];
  credits: {creator: string; source: string; url: string}[];
}
export interface ShowcaseCase {
  slug: string; topic: string; title: string; summary: string; summaryClaimId: string;
  snapshotAt: string; snapshotVersion: string;
  curation: {originalClaimCount: number; publishedClaimCount: number; omittedClaims: {claimId: string; reason: string}[]; passageSelection: string};
  paper: {paperId: string; title: string; authors: string; year: number; journal: string; doi: string;
    sourceUrl: string; pdfUrl: string; pdfSha256: string; pdfBytes: number; pageCount: number; license: string; licenseUrl: string;
    metadataNote: string; pages: {page: number; url: string; width: number; height: number; sha256: string; bytes: number}[]};
  review: {kind: 'demonstration' | 'recorded-unverified'; clinicianVerified: false; description: string};
  claims: ShowcaseClaim[]; assets: ShowcaseAsset[]; passages: SourcePassage[];
  stages: {stage: string; status: string; seconds: number | null; model: string | null; llmCalls: number | null; cacheHits: number | null}[];
  downloads: {url: string; label: string; bytes: number; sha256: string}[];
}
