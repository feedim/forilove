"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Music, Check, Link2, Loader2 } from "lucide-react";
import { MUSIC_LIBRARY } from "@/lib/musicLibrary";

interface MusicPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (youtubeUrl: string) => void;
  currentUrl?: string;
  onRemove?: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

function extractVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export default function MusicPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentUrl,
  onRemove,
}: MusicPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Default curated list (shown when no search query)
  const defaultTracks: SearchResult[] = MUSIC_LIBRARY.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    thumbnail: `https://img.youtube.com/vi/${t.id}/mqdefault.jpg`,
  }));

  // Initialize selectedId from currentUrl
  useEffect(() => {
    if (isOpen && currentUrl) {
      const vid = extractVideoId(currentUrl);
      if (vid) {
        setSelectedId(vid);
        setCustomMode(false);
      }
    }
  }, [isOpen, currentUrl]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setCustomMode(false);
      setCustomUrl("");
      setSearchResults([]);
      setSearching(false);
    }
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // YouTube search with debounce
  const searchYouTube = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    try {
      const res = await fetch(
        `/api/youtube-search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!controller.signal.aborted) {
        setSearchResults(data.items || []);
      }
    } catch {
      if (!controller.signal.aborted) {
        setSearchResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => searchYouTube(value), 400);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ─── Handlers ────────────────────────────────────────────
  const handleSelect = () => {
    if (customMode && customUrl) {
      const isValid =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}/.test(
          customUrl
        );
      if (!isValid) return;
      onSelect(customUrl);
    } else if (selectedId) {
      onSelect(`https://www.youtube.com/watch?v=${selectedId}`);
    }
  };

  const handleTrackClick = (track: SearchResult) => {
    setSelectedId(track.id);
    setCustomMode(false);
    setCustomUrl("");
  };

  if (!isOpen) return null;

  const hasSelection = customMode
    ? !!customUrl &&
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}/.test(
        customUrl
      )
    : !!selectedId;
  const customUrlValid = customUrl
    ? /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}/.test(
        customUrl
      )
    : false;

  // Show search results if searching, otherwise curated list
  const displayTracks = searchQuery.length >= 2 ? searchResults : defaultTracks;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 w-full sm:w-[500px] rounded-t-3xl sm:rounded-3xl animate-slide-up sm:animate-scale-in flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Music className="h-5 w-5 text-pink-400" />
              Müzik Seç
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              YouTube&apos;da arayın veya listeden seçin
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full p-2 bg-white/10 text-gray-400 hover:text-white hover:bg-white/15 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-all"
              placeholder="YouTube'da şarkı ara..."
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Song List */}
        <div
          className="flex-1 overflow-y-auto px-5 py-3 space-y-1"
          style={{ minHeight: 0 }}
        >
          {searching && displayTracks.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 text-gray-500 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-500">Aranıyor...</p>
            </div>
          ) : displayTracks.length === 0 && searchQuery.length >= 2 ? (
            <div className="text-center py-8">
              <Music className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Sonuç bulunamadı</p>
            </div>
          ) : (
            displayTracks.map((track) => {
              const isSelected = selectedId === track.id && !customMode;

              return (
                <button
                  key={track.id}
                  onClick={() => handleTrackClick(track)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    isSelected ? "bg-pink-500/15" : "hover:bg-white/5"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                    <img
                      src={track.thumbnail || `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {track.artist}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Custom URL Section */}
        <div className="px-5 pt-2 shrink-0 border-t border-white/5">
          <button
            onClick={() => {
              setCustomMode(!customMode);
              if (!customMode) setSelectedId(null);
            }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors py-2 w-full"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>
              {customMode ? "Listeden seç" : "veya YouTube linki yapıştır"}
            </span>
          </button>

          {customMode && (
            <div className="pb-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-all"
                placeholder="https://www.youtube.com/watch?v=..."
                autoFocus
              />
              {customUrl && !customUrlValid && (
                <p className="text-xs text-red-400 mt-1.5">
                  Geçerli bir YouTube linki girin
                </p>
              )}
              {customUrl && customUrlValid && (
                <div
                  className="flex items-center gap-3 mt-2 rounded-xl p-2.5"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${extractVideoId(customUrl)}/mqdefault.jpg`}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      YouTube Video
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">Özel link</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 p-5 pt-3 shrink-0">
          {(currentUrl || onRemove) && (
            <button
              onClick={() => onRemove?.()}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/5 text-red-400 hover:bg-white/10 transition-all"
            >
              Müziği Kaldır
            </button>
          )}
          <button
            onClick={handleSelect}
            disabled={!hasSelection}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: hasSelection
                ? "lab(49.5493% 79.8381 2.31768)"
                : "rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            Seç
          </button>
        </div>
      </div>
    </div>
  );
}
