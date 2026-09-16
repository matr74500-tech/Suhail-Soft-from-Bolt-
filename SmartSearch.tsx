import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SuggestionItem {
  id: string;
  primary: string;
  secondary?: string;
  badge?: string;
  badgeColor?: string;
  data: unknown;
}

interface SmartSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  onSuggestionSelect?: (item: SuggestionItem) => void;
  fetchSuggestions?: (query: string) => Promise<SuggestionItem[]>;
  placeholder?: string;
  debounceMs?: number;
  minChars?: number;
  renderSuggestion?: (item: SuggestionItem) => ReactNode;
  autoFocus?: boolean;
  dir?: 'rtl' | 'ltr';
}

export default function SmartSearch({
  value,
  onChange,
  onSearch,
  onSuggestionSelect,
  fetchSuggestions,
  placeholder = 'بحث...',
  debounceMs = 300,
  minChars = 1,
  renderSuggestion,
  autoFocus,
  dir = 'rtl',
}: SmartSearchProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchIdRef = useRef(0);

  const doFetch = useCallback(async (query: string) => {
    if (!fetchSuggestions || query.trim().length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoading(true);
    const myId = ++fetchIdRef.current;
    try {
      const results = await fetchSuggestions(query.trim());
      if (myId === fetchIdRef.current) {
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setHighlightedIndex(-1);
      }
    } catch {
      if (myId === fetchIdRef.current) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      if (myId === fetchIdRef.current) setLoading(false);
    }
  }, [fetchSuggestions, minChars]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(value), debounceMs);
    return () => clearTimeout(debounceRef.current);
  }, [value, doFetch, debounceMs]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        onSearch(value);
        setShowSuggestions(false);
      }
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }

  function selectSuggestion(item: SuggestionItem) {
    onChange(item.primary);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    if (onSuggestionSelect) {
      onSuggestionSelect(item);
    } else {
      onSearch(item.primary);
    }
  }

  function clearInput() {
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
    onSearch('');
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        dir={dir}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        className="input pr-9 pl-8"
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
      )}
      {!loading && value && (
        <button
          onClick={clearInput}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 card shadow-lg z-50 max-h-72 overflow-y-auto animate-fade-in">
          {suggestions.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectSuggestion(item)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0 ${
                highlightedIndex === idx
                  ? 'bg-teal-50 dark:bg-teal-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {renderSuggestion ? (
                renderSuggestion(item)
              ) : (
                <>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.primary}</p>
                    {item.secondary && (
                      <p className="text-xs text-gray-400 truncate" dir="ltr">{item.secondary}</p>
                    )}
                  </div>
                  {item.badge && (
                    <span className={`badge flex-shrink-0 ${item.badgeColor || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
