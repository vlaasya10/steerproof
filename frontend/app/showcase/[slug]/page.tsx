import Link from 'next/link';
import {notFound} from 'next/navigation';
import {showcaseCase,showcaseCases} from '@/showcase/data';
import {PublicHeader,PublicFooter,ShowcaseMode} from '@/components/showcase/PublicChrome';
import ShowcaseExplorer from '@/components/showcase/ShowcaseExplorer';
export const dynamicParams=false;
export function generateStaticParams(){return showcaseCases.map(c=>({slug:c.slug}));}
export default async function CasePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const item=showcaseCase(slug); if(!item)notFound();
  return <><PublicHeader/><main className="w-full min-w-0 max-w-7xl mx-auto px-5 md:px-10 pt-9 pb-14"><Link href="/#examples" className="text-xs text-clay hover:text-rust">← All examples</Link><p className="text-xs text-rust mt-8">{item.topic} · read-only case study</p><h1 className="font-serif text-4xl md:text-6xl mt-3 max-w-4xl">{item.title}</h1><p className="text-sm text-clay mt-5 max-w-3xl leading-relaxed">{item.summary} <Link className="underline text-rust" href={`/showcase/${slug}/evidence/${item.summaryClaimId}`}>Source ↗</Link></p><div className="mt-6"><ShowcaseMode/></div><ShowcaseExplorer item={item}/><nav aria-label="Other examples" className="flex flex-wrap gap-4 mt-10">{showcaseCases.filter(c=>c.slug!==slug).map(c=><Link key={c.slug} href={`/showcase/${c.slug}`} className="text-sm text-rust underline">Explore {c.topic} →</Link>)}</nav></main><PublicFooter/></>;
}
