import Link from 'next/link';

export function PublicHeader() {
  return <header className="border-b border-blush bg-cream/95 sticky top-0 z-40 backdrop-blur">
    <div className="max-w-7xl mx-auto px-5 md:px-10 h-20 flex items-center justify-between gap-4">
      <Link href="/" aria-label="SteerProof showcase home" className="flex items-baseline gap-3"><span className="font-serif text-4xl text-rust">steer</span><span className="text-sm text-clay border-l border-blush pl-3">Proof</span></Link>
      <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
        <Link href="/#examples" className="hover:text-rust">The examples</Link>
        <Link href="/#how-it-works" className="hidden sm:block hover:text-rust">The paper trail</Link>
      </nav>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="border-t border-blush mt-auto bg-softPaper">
    <div className="max-w-7xl mx-auto px-5 md:px-10 py-10 grid md:grid-cols-3 gap-6">
      <div><Link href="/" className="font-serif text-4xl text-rust">steer</Link><p className="text-sm text-clay mt-2">Research with a paper trail.</p></div>
      <p className="text-xs text-clay leading-relaxed">An educational software demonstration. Automated evidence checks and recorded workspace reviews are not medical advice or proof of clinician endorsement.</p>
      <div className="text-xs text-clay leading-relaxed md:text-right"><p>Read-only samples, bundled with this website.</p><p>No account or live processing required.</p><Link className="underline underline-offset-4" href="/showcase/credits">Sources, rights & methodology</Link></div>
    </div>
  </footer>;
}

export function ShowcaseMode() {
  return <aside aria-label="Interactive showcase mode" className="border border-blush rounded-2xl bg-softPaper px-5 py-4 text-sm">
    <p className="text-ink font-medium">Interactive Showcase Mode <span className="text-clay font-normal ml-2">Read-only, no login</span></p>
    <p className="text-clay leading-relaxed mt-2 max-w-3xl">Explore completed research-to-content examples with source-linked claims and generated media. Live processing is not available in this hosted demonstration.</p>
    <details className="text-xs mt-3 text-clay"><summary className="cursor-pointer">Hosting details</summary><p className="leading-relaxed mt-2 max-w-3xl">These curated snapshots and media are served by the frontend independently of Render. The private API remains authenticated and runs in its 512 MB API-only mode. Full processing remains available in the local application.</p></details>
  </aside>;
}
