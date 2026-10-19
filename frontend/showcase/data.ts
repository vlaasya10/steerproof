import raw from './generated/cases.json';
import type {ShowcaseCase} from './types';

// Deliberately imports only reviewed public snapshots. No workspace/API/environment access.
export const showcaseCases = raw as ShowcaseCase[];
export function showcaseCase(slug: string): ShowcaseCase | undefined {
  return showcaseCases.find(item => item.slug === slug);
}
export function caseSummary(item: ShowcaseCase) {
  return {slug: item.slug, topic: item.topic, title: item.title, summary: item.summary,
    paper: {authors: item.paper.authors, year: item.paper.year, journal: item.paper.journal, doi: item.paper.doi},
    review: item.review, claims: item.claims.length,
    matchedQuotes: item.claims.filter(c => c.quoteScore >= 90 && c.reproducedQuoteScore >= 90).length,
    formats: item.assets.filter(a => a.type === 'CAPTION' || a.media.length).map(a => a.type)};
}
