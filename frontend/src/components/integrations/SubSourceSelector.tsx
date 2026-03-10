'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listSubSources,
  updateImportFilter,
  type ServiceId,
  type SubSource,
} from '@/services/integrations.service';

interface SubSourceSelectorProps {
  serviceId: ServiceId;
  importEverything: boolean;
  selectedSubSourceIds: string[];
  onSave: (filter: { importEverything: boolean; selectedSubSourceIds: string[] }) => Promise<void>;
  onCancel?: () => void;
}

export function SubSourceSelector({
  serviceId,
  importEverything: initialImportEverything,
  selectedSubSourceIds: initialSelectedIds,
  onSave,
  onCancel,
}: SubSourceSelectorProps) {
  const [subSources, setSubSources] = useState<SubSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importEverything, setImportEverything] = useState(initialImportEverything);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSubSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sources = await listSubSources(serviceId);
      setSubSources(sources);
    } catch (err) {
      setError((err as Error).message || 'Failed to load sub-sources');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchSubSources();
  }, [fetchSubSources]);

  const toggleSubSource = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ importEverything, selectedSubSourceIds: selectedIds });
    } finally {
      setSaving(false);
    }
  };

  const isInvalid = !importEverything && selectedIds.length === 0;
  const isSaveDisabled = isInvalid || saving;

  const filteredSources = subSources.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const btnSmall =
    'w-auto border border-zinc-300 bg-white py-1.5 px-3 text-xs font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50';
  const btnPrimary =
    'w-auto bg-black text-white py-1.5 px-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="border border-zinc-200 p-4 bg-zinc-50 mt-3">
      <p className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-black mb-3">
        Import filter
      </p>

      {/* Import everything toggle */}
      <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={importEverything}
          onChange={(e) => setImportEverything(e.target.checked)}
          className="accent-black"
        />
        <span className="text-[0.8rem] text-black font-medium">Import everything</span>
      </label>

      {/* Sub-sources list */}
      {loading ? (
        <div className="space-y-2 mb-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 bg-zinc-200 animate-pulse rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="mb-3">
          <p className="text-[0.75rem] text-red-600 mb-1.5">{error}</p>
          <button type="button" className={btnSmall} onClick={fetchSubSources}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {subSources.length > 10 && (
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-zinc-300 px-2.5 py-1.5 text-xs mb-2 focus:outline-none focus:border-black"
            />
          )}
          <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
            {filteredSources.map((source) => {
              const isAvailable = subSources.some((s) => s.id === source.id);
              return (
                <label
                  key={source.id}
                  className={`flex items-center gap-2 cursor-pointer ${importEverything ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(source.id)}
                    disabled={importEverything}
                    onChange={() => toggleSubSource(source.id)}
                    className="accent-black"
                  />
                  <span className="text-[0.8rem] text-zinc-800">{source.label}</span>
                  {!isAvailable && (
                    <span className="text-[0.65rem] text-zinc-400 border border-zinc-300 px-1">
                      unavailable
                    </span>
                  )}
                </label>
              );
            })}
            {/* Show stale selected IDs not in fetched list */}
            {selectedIds
              .filter((id) => !subSources.some((s) => s.id === id))
              .map((id) => (
                <label
                  key={id}
                  className={`flex items-center gap-2 cursor-pointer ${importEverything ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked
                    disabled={importEverything}
                    onChange={() => toggleSubSource(id)}
                    className="accent-black"
                  />
                  <span className="text-[0.8rem] text-zinc-800">{id}</span>
                  <span className="text-[0.65rem] text-zinc-400 border border-zinc-300 px-1">
                    unavailable
                  </span>
                </label>
              ))}
          </div>
        </>
      )}

      {/* Validation message */}
      {isInvalid && (
        <p className="text-[0.75rem] text-red-600 mb-2">
          Select at least one sub-source, or enable Import everything
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={isSaveDisabled}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" className={btnSmall} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
