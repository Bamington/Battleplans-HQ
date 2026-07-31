/**
 * LinkPreview.tsx — the card a pack shows under a Tickets or Registration link.
 *
 * Asks the `link-preview` Edge Function what is on the other end of the URL and
 * renders it: artwork, title, description, host. The whole card is the link.
 *
 * IT DEGRADES TO A PLAIN LINK, ALWAYS. A preview is decoration on top of a URL
 * the organiser typed, and plenty of the internet will not give one up — sites
 * that block bots, pages with no tags, links that are simply dead. None of
 * those are worth an error message in the middle of someone's event page, so
 * the fallback is the thing the preview was decorating: a link that works.
 *
 * There is no loading skeleton either. The lookup is usually a cache hit and
 * therefore instant; a skeleton would flash on and off and be worse than the
 * link appearing plainly and then gaining a picture.
 */

import { useEffect, useState } from 'react';
import { Gallery } from '@battleplans/ui';
import { fetchLinkPreview } from '../lib/packs';
import type { LinkPreviewData } from '../lib/packs';

export interface LinkPreviewProps {
  url: string;
  /** What the plain-link fallback says. Defaults to the URL's host. */
  label?: string;
}

/** "www.eventbrite.com.au/e/12345" → "eventbrite.com.au" */
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const LinkPreview = ({ url, label }: LinkPreviewProps) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    let stale = false;
    setPreview(null);
    fetchLinkPreview(url).then(p => { if (!stale) setPreview(p); });
    return () => { stale = true; };
  }, [url]);

  const host = hostOf(url);

  // No preview to be had — the link itself, which is what it was decorating.
  if (!preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="font-body text-base leading-6 text-primary-400 hover:underline break-all"
      >
        {label ?? host}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="w-full flex rounded-xl overflow-hidden border border-gray-700 bg-gray-900
                 hover:border-gray-500 transition-colors"
    >
      {/* Fixed square rather than the image's own shape: a row of previews with
          different artwork should not have ragged heights. */}
      <div className="shrink-0 w-24 h-24 bg-gray-950 flex items-center justify-center overflow-hidden">
        {preview.image_url
          ? (
            <img
              src={preview.image_url}
              alt=""
              className="w-full h-full object-cover"
              /* A broken image URL is common and must not leave a torn icon in
                 the middle of the card. */
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )
          : <Gallery className="w-6 h-6 text-gray-700" />}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 px-4 py-3">
        <p className="font-body font-bold text-base leading-6 text-white line-clamp-1">
          {preview.title}
        </p>
        {preview.description && (
          <p className="font-body text-sm leading-5 text-gray-400 line-clamp-2">
            {preview.description}
          </p>
        )}
        <p className="font-body text-xs leading-4 text-gray-500 truncate">
          {preview.site_name || host}
        </p>
      </div>
    </a>
  );
};

export default LinkPreview;
