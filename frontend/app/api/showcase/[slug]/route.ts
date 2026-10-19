import {showcaseCase} from '@/showcase/data';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
  const item=showcaseCase((await params).slug);
  return item?Response.json(item,{headers:{'Cache-Control':'public, max-age=0, s-maxage=86400'}}):Response.json({error:'NOT_FOUND'},{status:404});
}
