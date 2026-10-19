import Link from 'next/link';
import type {ShowcaseCase, ShowcaseClaim} from '@/showcase/types';

export function Evidence({item, claim}: {item: ShowcaseCase; claim: ShowcaseClaim}) {
  const p = claim.evidence;
  const image = item.paper.pages.find(x => x.page === p.page);
  return <div className="grid lg:grid-cols-2 gap-8 min-w-0 break-words">
    <div className="space-y-5 min-w-0">
      <p className="text-xs text-rust font-medium">{claim.claimId} · {claim.findingClass}</p>
      <h2 className="font-serif text-3xl">{claim.scientificClaim}</h2>
      <div className="border-l-2 border-rust pl-5"><p className="text-xs text-clay mb-2">Original quotation · page {p.page}</p><blockquote className="text-sm leading-relaxed whitespace-pre-wrap">{claim.quote}</blockquote></div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-softPaper border border-blush p-4 rounded-xl">Recorded quote match <strong className="block text-xl mt-1">{claim.quoteScore}/100</strong></div>
        <div className="bg-softPaper border border-blush p-4 rounded-xl">Reproduced passage match <strong className="block text-xl mt-1">{claim.reproducedQuoteScore}/100</strong></div>
      </div>
      <p className="text-xs text-clay">A match ≥90 checks the quotation against the extracted passage. It does not establish clinical validity. Numerical check: <b>{claim.numbersOk ? 'passed' : 'FAILED'}</b>. Entailment: <b>{claim.entailment}</b>.</p>
      <p className="text-xs text-clay">Independent PDF publication check: page {claim.independentPageScore}/100; recorded Docling region {claim.independentRegionScore}/100. {item.curation.passageSelection}</p>
      <div className="bg-blush/25 border border-blush rounded-xl p-5 space-y-3 text-sm">
        <p><b>Risk: {claim.risk}.</b> {claim.riskReason}</p><p><b>Indian population fit: {claim.populationFit}.</b> {claim.populationReason}</p><p><b>Population:</b> {claim.population || 'Not recorded'}</p><p><b>Study design:</b> {claim.studyDesign || 'Not recorded'}</p>
        {claim.limitations.length ? <ul className="list-disc pl-5">{claim.limitations.map((v,i) => <li key={i}>{v}</li>)}</ul> : <p className="text-clay">No claim-specific limitations were extracted; this does not mean the evidence has no limitations. Read the full paper.</p>}
      </div>
      <p className="text-xs text-clay">Recorded Gate 1 state: <b>{claim.doctorStatus}</b>. {item.review.description} {claim.reviewNote}</p>
      <details className="text-sm border border-blush rounded-xl p-4"><summary className="cursor-pointer">Full extracted passage · {p.passageId}</summary><p className="mt-4 whitespace-pre-wrap leading-relaxed">{p.text}</p><p className="text-xs text-clay mt-3">Docling coordinates: {JSON.stringify(p.bbox)}; page {p.pageWidth} × {p.pageHeight}. Section: {p.section || 'Not recorded'}.</p></details>
    </div>
    <div><p className="text-xs text-clay mb-3">Original PDF page · highlighted Docling passage region</p>
      {image && <div className="relative border border-blush bg-white shadow-sm"><img src={image.url} width={image.width} height={image.height} alt={`Source PDF page ${p.page}`} className="w-full h-auto"/><div aria-label="Original Docling passage bounding box" className="absolute border-2 border-rust bg-rust/15 pointer-events-none" style={{left:`${p.bbox.l/p.pageWidth*100}%`,top:`${p.bbox.t/p.pageHeight*100}%`,width:`${(p.bbox.r-p.bbox.l)/p.pageWidth*100}%`,height:`${(p.bbox.b-p.bbox.t)/p.pageHeight*100}%`}}/></div>}
      <a href={`${item.paper.pdfUrl}#page=${p.page}`} target="_blank" rel="noreferrer" className="inline-block text-sm text-rust underline mt-4">Open original PDF, page {p.page} ↗</a>
      <p className="text-xs text-clay mt-3">{item.paper.authors}. {item.paper.title}. {item.paper.journal} ({item.paper.year}). <a href={item.paper.sourceUrl} className="underline" target="_blank" rel="noreferrer">DOI {item.paper.doi}</a>. <a href={item.paper.licenseUrl} className="underline">{item.paper.license}</a>.</p>
    </div>
  </div>;
}

export function ClaimLinks({item, ids}: {item: ShowcaseCase; ids: string[]}) {
  return <div className="flex flex-wrap gap-2 mt-3">{ids.map(id => <Link key={id} href={`/showcase/${item.slug}/evidence/${id}`} className="text-xs text-rust border border-rust/25 rounded-full px-3 py-1 hover:bg-blush/30">{id} · evidence ↗</Link>)}</div>;
}
