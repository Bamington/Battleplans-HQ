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
  // A dead image URL is common — hotlinked artwork rots, CDNs move. Hiding the
  // element rather than leaving a torn-icon placeholder in the card, and
  // tracked in state rather than mutated in the DOM so a re-render cannot
  // resurrect it.
  const [imageBroken, setImageBroken] = useState(false);
  const [iconBroken,  setIconBroken]  = useState(false);

  useEffect(() => {
    let stale = false;
    setPreview(null);
    setImageBroken(false);
    setIconBroken(false);
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
      className="w-full flex items-stretch rounded-xl overflow-hidden border border-gray-700
                 bg-gray-900 hover:border-gray-500 transition-colors"
    >
      {/* Text first in the DOM as well as on screen — it is what the link is
          about, and it is what a screen reader should reach first. */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-4 py-3">
        <p className="font-body font-bold text-base leading-6 text-white line-clamp-1">
          {preview.title}
        </p>

        {preview.description && (
          <p className="font-body text-sm leading-5 text-gray-400 line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* Favicon and domain, the way a browser tab identifies a site. A
            domain alone is a string to read; the mark is recognised. */}
        <div className="flex items-center gap-1.5 min-w-0">
          {preview.favicon_url && !iconBroken && (
            <img
              src={preview.favicon_url}
              alt=""
              className="w-4 h-4 rounded-sm shrink-0 object-contain"
              onError={() => setIconBroken(true)}
            />
          )}
          <span className="font-body text-xs leading-4 text-gray-500 truncate">
            {host}
          </span>
        </div>
      </div>

      {/* Fills its column edge to edge and takes its height from the text
          beside it, so the artwork is cropped rather than letterboxed and the
          card has no dead space. Dropped entirely when there is no image —
          a placeholder tile would be a box of nothing a third of the card wide. */}
      {preview.image_url && !imageBroken && (
        <div className="shrink-0 w-[28%] max-w-[200px] self-stretch relative bg-gray-950">
          {/* ABSOLUTE, so the artwork contributes nothing to layout. Left in
              flow with h-full it silently drove the row instead: a percentage
              height against an auto-height parent is ignored, so a square image
              made the card as tall as it was wide — 190px for two lines of
              text. The height comes from the text; the image fills whatever
              that turns out to be. */}
          <img
            src={preview.image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageBroken(true)}
          />
        </div>
      )}
    </a>
  );
};

export default LinkPreview;
