"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityPrediction {
  placeId: string;
  name: string;
  description: string;
  fullText: string;
}

export interface SelectedCity {
  city: string;
  /** State / province code parsed from the prediction, e.g. "TN" */
  state: string;
}

interface SingleCityAutocompleteProps {
  /** ISO 3166-1 alpha-2 country code the search is restricted to */
  country: string;
  value: SelectedCity | null;
  onChange: (value: SelectedCity | null) => void;
  placeholder?: string;
  className?: string;
}

function generateSessionToken() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Single-city picker backed by Google Places. Only real Google results can be
 * selected — free-typed text is never committed as a value.
 */
export function SingleCityAutocomplete({
  country,
  value,
  onChange,
  placeholder = "Search for your city…",
  className,
}: SingleCityAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<CityPrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(generateSessionToken());

  const fetchPredictions = useCallback(
    async (q: string) => {
      if (q.trim().length < 1) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q, session: sessionRef.current, country });
        const res = await fetch(`/api/places/cities?${params}`);
        const data = await res.json();
        const results: CityPrediction[] = data.predictions ?? [];
        setPredictions(results);
        setIsOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [country]
  );

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), 250);
  }

  function handleSelect(p: CityPrediction) {
    // description is e.g. "TN, USA" or "ON, Canada" — first segment is the region code
    const state = p.description.split(",")[0]?.trim() ?? "";
    onChange({ city: p.name, state });
    setQuery("");
    setPredictions([]);
    setIsOpen(false);
    sessionRef.current = generateSessionToken();
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex]);
      }
      return;
    }
    if (e.key === "Backspace" && !query && value) {
      clearSelection();
      return;
    }
    if (!isOpen || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3",
            className
          )}
        >
          <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 truncate text-sm text-gray-900">
            {value.city}
            {value.state ? <span className="text-gray-400">, {value.state}</span> : null}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear city"
            className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(
              "h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
              className
            )}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      )}

      {isOpen && predictions.length > 0 && !value && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[240px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {predictions.map((p, i) => (
            <button
              key={p.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
              className={cn(
                "flex w-full items-start gap-2.5 border-b border-gray-50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-gray-50",
                i === activeIndex && "bg-gray-50"
              )}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                <p className="truncate text-[11px] text-gray-400">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
