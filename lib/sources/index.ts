// Museum open-access sources. Only public-domain works with images are returned.

export type Artwork = {
  source: 'artic' | 'met';
  sourceId: string;
  title: string;
  artist: string;
  date: string;
  credit: string;
  url: string;
  thumbUrl: string;
};

/** Hosts that museum image URLs may point to (checked when importing). */
export const IMAGE_HOSTS = ['www.artic.edu', 'images.metmuseum.org'];

const HEADERS = { 'User-Agent': 'ArtFrame/0.1', 'AIC-User-Agent': 'ArtFrame/0.1' };

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

/** Art Institute of Chicago: https://api.artic.edu/docs/ */
export async function searchArtic(query: string): Promise<Artwork[]> {
  const url =
    'https://api.artic.edu/api/v1/artworks/search?limit=24' +
    '&fields=id,title,artist_title,date_display,image_id,credit_line' +
    '&query[term][is_public_domain]=true&q=' +
    encodeURIComponent(query);
  const data = await getJson(url);
  const iiif: string = data.config?.iiif_url || 'https://www.artic.edu/iiif/2';
  return (data.data as any[])
    .filter((a) => a.image_id)
    .map((a) => ({
      source: 'artic' as const,
      sourceId: String(a.id),
      title: a.title || '',
      artist: a.artist_title || '',
      date: a.date_display || '',
      credit: 'Art Institute of Chicago' + (a.credit_line ? `, ${a.credit_line}` : ''),
      url: `${iiif}/${a.image_id}/full/1686,/0/default.jpg`,
      thumbUrl: `${iiif}/${a.image_id}/full/400,/0/default.jpg`,
    }));
}

/** The Metropolitan Museum of Art: https://metmuseum.github.io/ */
export async function searchMet(query: string): Promise<Artwork[]> {
  const base = 'https://collectionapi.metmuseum.org/public/collection/v1';
  const search = await getJson(`${base}/search?hasImages=true&q=${encodeURIComponent(query)}`);
  const ids: number[] = (search.objectIDs || []).slice(0, 30);
  const objects = await Promise.all(ids.map((id) => getJson(`${base}/objects/${id}`).catch(() => null)));
  return objects
    .filter((o) => o && o.isPublicDomain && o.primaryImage)
    .slice(0, 24)
    .map((o) => ({
      source: 'met' as const,
      sourceId: String(o.objectID),
      title: o.title || '',
      artist: o.artistDisplayName || '',
      date: o.objectDate || '',
      credit: 'The Metropolitan Museum of Art' + (o.creditLine ? `, ${o.creditLine}` : ''),
      url: o.primaryImage,
      thumbUrl: o.primaryImageSmall || o.primaryImage,
    }));
}
