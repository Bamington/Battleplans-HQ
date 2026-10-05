/**
 * PhotoFinder.tsx — Pick photos for a model or collection that doesn't exist
 * yet: upload from the device, or search the web by its name and game and tap
 * the right picture. Nothing is saved here — picks are staged as
 * PendingPhotos, and the Add form uploads them once the row is created (see
 * uploadPendingPhotos). The first photo becomes the cover.
 *
 * Compare ImageEditor, which manages photos on a row that already exists.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Input, Magnifer } from '@battleplans/ui';
import { StarIcon, TrashIcon, PlusIcon } from './ImageEditor';
import { searchWebImages } from '../lib/imageSearch';
import type { PendingPhoto, WebImage } from '../lib/imageSearch';

const CheckIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 10 8" fill="none" className={className}><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

let nextId = 0;
const newId = () => `pending-${++nextId}`;

export function PhotoFinder({ value, onChange, suggestedQuery, searchHint, initialResults }: {
  value: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
  /** What to search for by default — the name, plus the game when known. */
  suggestedQuery: string;
  /** Shown when there's nothing to search for yet, e.g. "Enter a name first". */
  searchHint?: string;
  /** Gallery only: start with the search panel open on these results. */
  initialResults?: WebImage[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(!!initialResults);
  const [query, setQuery] = useState(suggestedQuery);
  /** Once the user edits the query it's theirs; until then it follows the name. */
  const [queryEdited, setQueryEdited] = useState(false);
  const [results, setResults] = useState<WebImage[]>(initialResults ?? []);
  const [searched, setSearched] = useState(!!initialResults);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!queryEdited) setQuery(suggestedQuery); }, [suggestedQuery, queryEdited]);

  const runSearch = async (q = query) => {
    const term = q.trim();
    if (!term) return;
    setSearching(true); setError(null);
    const { results: found, error: err } = await searchWebImages(term);
    setResults(found); setError(err); setSearched(true); setSearching(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    // Search straight away for the suggestion — the common case is that the
    // name alone finds it, and the box can still be edited to refine.
    if (!searched && query.trim()) runSearch();
  };

  // ── Staged photos ──
  const pickedImages = new Set(value.flatMap(p => (p.source.kind === 'web' ? [p.source.image.image] : [])));

  const toggleWeb = (img: WebImage) => {
    if (pickedImages.has(img.image)) {
      onChange(value.filter(p => !(p.source.kind === 'web' && p.source.image.image === img.image)));
    } else {
      onChange([...value, { id: newId(), preview: img.thumbnail, source: { kind: 'web', image: img } }]);
    }
  };

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    onChange([...value, ...files.map(file => ({
      id: newId(), preview: URL.createObjectURL(file), source: { kind: 'file' as const, file },
    }))]);
  };

  const remove = (photo: PendingPhoto) => {
    if (photo.source.kind === 'file') URL.revokeObjectURL(photo.preview);
    onChange(value.filter(p => p.id !== photo.id));
  };

  /** The cover is simply the first photo, so making one the cover moves it up. */
  const makeCover = (photo: PendingPhoto) => onChange([photo, ...value.filter(p => p.id !== photo.id)]);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-sm font-medium text-white">Photos <span className="text-neutral-500 font-normal">(optional)</span></span>

      <div className="grid grid-cols-3 gap-2">
        {value.map((photo, i) => (
          <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700">
            <img src={photo.preview} alt="" className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-body">
                <StarIcon filled className="w-2.5 h-2.5" /> Cover
              </span>
            )}
            <div className="absolute bottom-1 right-1 flex gap-1">
              {i > 0 && (
                <button type="button" onClick={() => makeCover(photo)} aria-label="Make cover photo" title="Make cover photo"
                  className="p-1 rounded-md bg-black/60 text-white hover:bg-black/80">
                  <StarIcon />
                </button>
              )}
              <button type="button" onClick={() => remove(photo)} aria-label="Remove photo" title="Remove photo"
                className="p-1 rounded-md bg-black/60 text-red-400 hover:bg-black/80">
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}

        <button type="button" onClick={() => fileRef.current?.click()}
          className="aspect-square rounded-lg border border-dashed border-neutral-600 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-white hover:border-neutral-400 transition-colors">
          <PlusIcon />
          <span className="font-body text-[11px]">Upload</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />

      {!searchOpen ? (
        <Button variant="outline" color="primary" size="sm" leftIcon={<Magnifer className="w-4 h-4" />}
          className="w-full justify-center" disabled={!query.trim()} onClick={openSearch}>
          Find a photo online
        </Button>
      ) : (
        <div className="flex flex-col gap-2 bg-neutral-800/60 border border-neutral-700 rounded-lg p-2.5">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); runSearch(); }}>
            <Input
              size="sm" type="search" className="flex-1 min-w-0" aria-label="Search the web for a photo"
              leftIcon={<Magnifer className="w-4 h-4" />}
              value={query}
              onChange={e => { setQuery(e.target.value); setQueryEdited(true); }}
            />
            <Button type="submit" size="sm" color="primary" loading={searching} disabled={!query.trim() || searching}>Search</Button>
          </form>

          {searching && results.length === 0 ? (
            <p className="font-body text-xs text-neutral-400 text-center py-4">Searching…</p>
          ) : error ? (
            <p className="font-body text-xs text-red-400 text-center py-3">{error}</p>
          ) : searched && results.length === 0 ? (
            <p className="font-body text-xs text-neutral-400 text-center py-3">No photos found. Try different words.</p>
          ) : results.length > 0 && (
            <>
              <p className="font-body text-xs text-neutral-400">Tap the photos you want to use.</p>
              <div className={`grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto${searching ? ' opacity-50' : ''}`}>
                {results.map(img => {
                  const picked = pickedImages.has(img.image);
                  return (
                    <button key={img.image} type="button" onClick={() => toggleWeb(img)}
                      aria-pressed={picked} title={img.source ? `${img.title} — ${img.source}` : img.title}
                      className={`relative aspect-square rounded-md overflow-hidden bg-neutral-950 border-2 transition-colors ${
                        picked ? 'border-primary-500' : 'border-transparent hover:border-neutral-500'}`}>
                      <img src={img.thumbnail} alt={img.title} loading="lazy" className="w-full h-full object-cover" />
                      {picked && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center">
                          <CheckIcon className="w-2.5 h-2.5" />
                        </span>
                      )}
                      {img.source && (
                        <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/60 font-body text-[10px] text-neutral-300 truncate text-left">{img.source}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="font-body text-[10px] text-neutral-500">Results from Brave Search. Only use photos you’re happy to keep in your own collection.</p>
            </>
          )}
        </div>
      )}

      {!query.trim() && searchHint && !searchOpen && (
        <span className="font-body text-xs text-neutral-500">{searchHint}</span>
      )}
    </div>
  );
}
