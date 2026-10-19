import Link from 'next/link';
import {notFound} from 'next/navigation';
import {showcaseCase,showcaseCases} from '@/showcase/data';
import {PublicHeader,PublicFooter} from '@/components/showcase/PublicChrome';
import {Evidence} from '@/components/showcase/Evidence';
export const dynamicParams=false;
export function generateStaticParams(){return showcaseCases.flatMap(c=>c.claims.map(claim=>({slug:c.slug,claimId:claim.claimId})));}
export default async function EvidencePage({params}:{params:Promise<{slug:string;claimId:string}>}){
  const {slug,claimId}=await params;const item=showcaseCase(slug);const claim=item?.claims.find(c=>c.claimId===claimId);if(!item||!claim)notFound();
  return <><PublicHeader/><main className="w-full min-w-0 max-w-7xl mx-auto px-5 md:px-10 py-9"><Link href={`/showcase/${slug}`} className="text-sm text-rust">← Back to {item.topic}</Link><h1 className="font-serif text-4xl md:text-5xl mt-8 mb-8">Follow the evidence.</h1><Evidence item={item} claim={claim}/></main><PublicFooter/></>;
}
