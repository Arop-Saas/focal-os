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

interface CityAutocompleteProps {
  /** Comma-separated list of cities */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Color for the city chips */
  chipColor?: string;
}

function generateSessionToken() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Search for a city...",
  className,
  chipColor = "#3B82F6",
}: CityAutocompleteProps) {
  const cities = value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<CityPrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(generateSessionToken());

  const fetchPredictions = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q, session: sessionRef.current });
      const res = await fetch(`/api/places/cities?${params}`);
      const data = await res.json();
      // Filter out already-added cities
      const filtered = (data.predictions ?? []).filter(
        (p: CityPrediction) => !cities.some((c) => c.toLowerCase() === p.name.toLowerCase())
      );
      setPredictions(filtered);
      setIsOpen(filtered.length > 0);
      setActiveIndex(-1);
    } catch {
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [cities]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), 250);
  }

  function addCity(cityName: string) {
    const trimmed = cityName.trim();
    if (!trimmed) return;
    if (cities.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...cities, trimmed].join(", ");
    onChange(updated);
    setQuery("");
    setPredictions([]);
    setIsOpen(false);
    sessionRef.current = generateSessionToken();
    inputRef.current?.focus();
  }

  function removeCity(index: number) {
    const updated = cities.filter((_, i) => i !== index).join(", ");
    onChange(updated);
  }

  function handleSelect(prediction: CityPrediction) {
    addCity(prediction.name);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex]);
      } else if (query.trim()) {
        // Allow manual entry on Enter
        addCity(query);
      }
      return;
    }

    if (e.key === "Backspace" && !query && cities.length > 0) {
      removeCity(cities.length - 1);
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

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* Chip + input row */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-shadow cursor-text",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* City chips */}
        {cities.map((city, i) => (
          <span
            key={`${city}-${i}`}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
            style={{
              backgroundColor: chipColor + "18",
              color: chipColor,
              border: `1px solid ${chipColor}44`,
            }}
          >
            {city}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCity(i);
              }}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input */}
        <div className="relative flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            placeholder={cities.length === 0 ? placeholder : "Add another city..."}
            autoComplete="off"
            className="w-full py-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-400"
          />
          {isLoading && (
            <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[220px] overflow-y-auto"
        >
          {predictions.map((p, i) => (
            <button
              key={p.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
              className={cn(
                "flex items-start gap-3 w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0",
                i === activeIndex && "bg-blue-50"
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Search for cities or type and press Enter to add manually
      </p>
    </div>
  );
}
