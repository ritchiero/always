'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface SearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
  };
}

interface SearchProps {
  onSelectRecording?: (recordingId: string) => void;
}

export function SemanticSearch({ onSelectRecording }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      console.log('Searching for:', query);
      const searchFn = httpsCallable(functions, 'searchTranscripts');
      const response = await searchFn({ query });
      
      console.log('Search results:', response.data);
      setResults(response.data as SearchResult[]);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Error al buscar');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header con buscador */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
          <span className="text-blue-500">🔍</span> Búsqueda Semántica
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Busca en todas tus conversaciones usando lenguaje natural
        </p>

        {/* Search input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="¿Qué dijiste sobre...? (Ej: reunión con María sobre presupuesto)"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500/20 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Buscando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">❌ {error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {results.length === 0 && !isSearching ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-400 mb-2">Busca en tus conversaciones</h3>
            <p className="text-sm text-gray-600">
              Usa lenguaje natural para encontrar cualquier tema que hayas mencionado
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              <button
                onClick={() => {
                  setQuery('¿De qué hablé sobre el proyecto?');
                  setTimeout(handleSearch, 100);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors group"
              >
                <p className="text-sm text-gray-400 group-hover:text-white">💼 Sobre el proyecto</p>
              </button>
              <button
                onClick={() => {
                  setQuery('Action items de la última reunión');
                  setTimeout(handleSearch, 100);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors group"
              >
                <p className="text-sm text-gray-400 group-hover:text-white">✅ Action items</p>
              </button>
              <button
                onClick={() => {
                  setQuery('Conversaciones sobre presupuesto');
                  setTimeout(handleSearch, 100);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors group"
              >
                <p className="text-sm text-gray-400 group-hover:text-white">💰 Presupuesto</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-400">
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setError(null);
                }}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Limpiar
              </button>
            </div>

            {results.map((result, idx) => (
              <div
                key={result.id}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
                onClick={() => onSelectRecording?.(result.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-medium">#{idx + 1}</span>
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                      {(result.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecording?.(result.id);
                    }}
                    className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                  >
                    Ver completo →
                  </button>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {result.metadata.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
