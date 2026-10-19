import Link from 'next/link';
import {ArrowUpRight, LockKeyhole} from 'lucide-react';

export function PublicHeader() {
  return <header className="border-b border-blush bg-cream/95 sticky top-0 z-40 backdrop-blur">
    <div className="max-w-7xl mx-auto px-5 md:px-10 h-20 flex items-center justify-between gap-4">
      <Link href="/" aria-label="SteerProof showcase home" className="flex items-baseline gap-3"><span className="font-serif text-4xl text-rust">steer</span><span className="text-sm text-clay border-l border-blush pl-3">Proof</span></Link>
      <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
        <Link href="/#examples" className="hover:text-rust">The examples</Link>
        <Link href="/#how-it-works" className="hidden sm:block hover:text-rust">The paper trail</Link>
        <Link href="/workspace" className="text-clay hover:text-rust flex items-center gap-1.5"><LockKeyhole size={13}/><span className="hidden sm:inline">Private workspace</span><span className="sm:hidden">Workspace</span><ArrowUpRight size={14}/></Link>
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
  return <details className="border border-blush rounded-2xl bg-softPaper px-5 py-4 text-sm">
    <summary className="cursor-pointer text-ink font-medium">Interactive showcase mode <span className="text-clay font-normal ml-2">Read-only, no login</span></summary>
    <p className="text-clay leading-relaxed mt-3 max-w-3xl">Explore completed research-to-content projects, including source-linked claims, generated posts and reels. Live processing is unavailable in this hosted demonstration. These curated snapshots and media are served by the frontend independently of Render. The private API remains authenticated and runs in its 512 MB API-only mode.</p>
  </details>;
}
