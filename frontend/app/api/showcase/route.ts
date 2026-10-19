import {caseSummary,showcaseCases} from '@/showcase/data';
// force-static in this Next version serves the cached GET body for unsupported methods.
// Keep method dispatch active; this tiny handler reads only the bundled allowlist.
export const dynamic='force-dynamic';
export function GET(){return Response.json(showcaseCases.map(caseSummary),{headers:{'Cache-Control':'public, max-age=0, s-maxage=86400'}});}
