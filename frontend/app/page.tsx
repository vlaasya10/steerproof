import Link from 'next/link';
import {ArrowRight, ArrowUpRight, BookOpen, Quote, Layers, ShieldCheck} from 'lucide-react';
import {showcaseCases} from '@/showcase/data';
import {PublicHeader, PublicFooter, ShowcaseMode} from '@/components/showcase/PublicChrome';

export default function HomePage() {
  const total = showcaseCases.reduce((n, item) => n + item.claims.length, 0);
  const featured = showcaseCases[0];
  const poster = featured?.assets.find(a => a.type === 'CAROUSEL')?.media[0];
  return <><PublicHeader/><main>
    <section className="max-w-7xl mx-auto px-5 md:px-10 pt-12 md:pt-20 pb-14 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
      <div><p className="text-sm text-rust flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rust"/> The evidence comes with it</p>
        <h1 className="font-serif text-6xl sm:text-7xl xl:text-8xl leading-[0.98] tracking-tight mt-6">Explore SteerProof<br/><em className="font-normal text-rust">in action.</em></h1>
        <p className="text-lg text-clay leading-relaxed mt-7 max-w-xl">From scientific research to evidence-linked, reviewable Instagram content. Open a project. Follow a claim. See exactly where the words came from.</p>
        <div className="mt-8 flex flex-wrap items-center gap-5"><a href="#examples" className="bg-rust text-cream px-6 py-3.5 rounded-full text-sm inline-flex items-center gap-5 hover:bg-maroon transition-colors">Explore the examples <ArrowRight size={17}/></a><span className="text-xs text-clay">No login. No upload. A real paper trail.</span></div>
        <div className="mt-10 flex gap-8 border-t border-blush pt-6"><div><p className="font-serif text-4xl">{showcaseCases.length}</p><p className="text-xs text-clay mt-1">research projects</p></div><div><p className="font-serif text-4xl">{total}</p><p className="text-xs text-clay mt-1">source-linked claims</p></div><div><p className="font-serif text-4xl">2</p><p className="text-xs text-clay mt-1">review stages</p></div></div>
      </div>
      <div className="relative bg-blush/30 rounded-[2rem] p-7 sm:p-10 min-h-[420px] flex items-center justify-center">
        {poster && <Link href={`/showcase/${featured.slug}`} aria-label={`Explore ${featured.title}`} className="block max-w-[260px] w-full rotate-[-5deg] shadow-xl rounded-lg overflow-hidden border border-blush"><img src={poster.url} width={1080} height={1350} alt="A generated Steer carousel from the featured research project" className="w-full h-auto" fetchPriority="high"/></Link>}
        <div className="absolute right-3 sm:right-0 top-12 bg-softPaper border border-blush rounded-xl px-4 py-3 shadow-sm max-w-[200px]"><Quote size={20} className="text-rust mb-2"/><p className="text-sm font-medium">A post you can trace.</p><p className="text-xs text-clay mt-1">Copy → claim → passage → page</p></div>
        <p className="absolute left-6 bottom-5 font-hand text-2xl text-rust rotate-[-4deg]">the source stays attached ↗</p>
      </div>
    </section>
    <div className="max-w-7xl mx-auto px-5 md:px-10"><ShowcaseMode/></div>
    <section id="examples" className="max-w-7xl mx-auto px-5 md:px-10 py-16 scroll-mt-24">
      <div className="flex items-end justify-between gap-5 mb-8"><div><p className="text-sm text-rust mb-2">The case studies</p><h2 className="font-serif text-4xl md:text-5xl">Different questions. The same care.</h2></div><span className="hidden sm:block text-xs text-clay">{showcaseCases.length} genuine papers · read-only snapshots</span></div>
      <div className="grid md:grid-cols-3 gap-6">{showcaseCases.map((item, index) => {
        const image = item.assets.find(a => a.type === 'STATIC')?.media[0];
        const matched = item.claims.filter(c => c.quoteScore >= 90 && c.reproducedQuoteScore >= 90).length;
        return <article key={item.slug} data-testid="case-card" className="border border-blush rounded-2xl overflow-hidden bg-softPaper flex flex-col">
          <Link href={`/showcase/${item.slug}`} className="block border-b border-blush bg-cream relative h-64 overflow-hidden group" aria-label={`Preview ${item.title}`}>
            {image && <img src={image.url} alt={`Generated static post for ${item.topic}`} width={1080} height={1350} loading="lazy" className="h-full w-full object-cover object-[50%_40%] transition-transform duration-500 group-hover:scale-[1.03]"/>}
            <span className="absolute top-4 left-4 bg-softPaper border border-blush rounded-full px-3 py-1 text-xs text-rust">0{index + 1} / {item.topic}</span>
          </Link>
          <div className="p-6 flex flex-col flex-1"><p className="text-xs text-clay">{item.paper.journal} · {item.paper.year}</p><h3 className="font-serif text-3xl leading-tight mt-3"><Link href={`/showcase/${item.slug}`}>{item.title}</Link></h3>
            <p className="text-xs text-ink/70 leading-relaxed mt-3 line-clamp-2">{item.paper.title}</p>
            <p className="text-sm text-clay leading-relaxed mt-4 line-clamp-4">{item.summary}</p>
            <div className="mt-5 space-y-2 text-xs"><p className="flex items-center gap-2"><Quote size={14} className="text-rust"/>{matched}/{item.claims.length} quotations match their passages</p><p className="flex items-center gap-2 text-clay"><ShieldCheck size={14}/>{item.review.kind === 'demonstration' ? 'Demonstration review recorded' : 'Workspace approvals recorded; credentials unverified'}</p></div>
            <div className="flex flex-wrap gap-1.5 mt-5 mb-6">{item.assets.filter(a => a.type === 'CAPTION' || a.media.length).map(a => <span key={a.assetId} className="text-[11px] rounded-full border border-blush px-2 py-1 text-clay">{({CAROUSEL:'Carousel',STATIC:'Static',CAPTION:'Caption',REEL:'Reel'} as Record<string,string>)[a.type]}</span>)}</div>
            <Link href={`/showcase/${item.slug}`} className="mt-auto pt-4 border-t border-blush flex items-center justify-between text-sm text-rust">Explore case study <ArrowUpRight size={18}/></Link>
          </div>
        </article>;
      })}</div>
    </section>
    <section id="how-it-works" className="border-y border-blush bg-softPaper scroll-mt-24"><div className="max-w-7xl mx-auto px-5 md:px-10 py-16">
      <p className="text-sm text-rust">Follow the paper trail</p><h2 className="font-serif text-4xl md:text-5xl mt-3 max-w-2xl">The interesting part isn’t just the post.<br/><em className="text-rust">It’s what sits behind it.</em></h2>
      <div className="grid md:grid-cols-4 gap-8 mt-10">{[
        [BookOpen,'Start with the paper','Original source, page-level passages and document coordinates.'],
        [Quote,'Inspect the evidence','Recorded quotation, number and meaning checks, with limitations intact.'],
        [ShieldCheck,'Understand the reviews','See recorded decisions, policy flags and what has not been clinically verified.'],
        [Layers,'Explore the content','Follow generated copy back to claims; play reels and inspect sample exports.'],
      ].map(([Icon,title,copy]) => {const Glyph=Icon as typeof BookOpen;return <div key={String(title)}><Glyph className="text-rust" size={23}/><h3 className="font-medium mt-4 text-sm">{String(title)}</h3><p className="text-sm text-clay leading-relaxed mt-2">{String(copy)}</p></div>;})}</div>
      <Link href="/showcase/credits" className="inline-flex items-center gap-2 mt-9 text-sm text-rust underline underline-offset-4">Read the methodology and reuse notes <ArrowUpRight size={15}/></Link>
    </div></section>
  </main><PublicFooter/></>;
}
