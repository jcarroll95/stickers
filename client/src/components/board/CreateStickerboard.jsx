import React, { useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';

/**
 * CreateStickerboard Component
 * Flow to choose background, name, and tags to create a new stickerboard.
 */
export default function CreateStickerboard() {
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedBg, setSelectedBg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Available backgrounds: concrete Konva canvas backgrounds sb0.png - sb8.png
  // Located at /client/public/assets/sb0.png ... sb8.png and served from /assets/...
  const backgrounds = useMemo(() => (
    Array.from({ length: 9 }, (_, i) => ({
      id: `sb${i}.png`,               // store exact file name in the photo field
      label: `Background sb${i}`,
      url: `/assets/sb${i}.png`,      // public URL used for preview and Konva background
    }))
  ), []);

  const canSubmit = !!selectedBg && name.trim().length > 0 && !submitting;

  const tags = useMemo(() => (
    tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  ), [tagsInput]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: `Stickerboard: ${name.trim()}`,
        tags,
        // Save the selected background filename into the photo field
        photo: selectedBg.id,
      };

      const data = await apiClient.post('/stickerboards', payload);

      // apiClient returns response.data (the body)
      // Body is { success: true, data: board }
      const board = data.data || data;
      const tokenForRoute = board?._id || board?.id || board?.slug;
      if (tokenForRoute) {
        window.location.hash = `#/board/${tokenForRoute}`;
      } else {
        window.location.hash = '#/board';
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create stickerboard';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Create my stickerboard</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label htmlFor="sb-name" style={styles.label}>Board name</label>
          <input
            id="sb-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My inspiration wall"
            style={styles.input}
            maxLength={50}
            required
          />
        </div>

        <div style={styles.field}>
          <div style={styles.label}>Choose a background</div>
          <div style={styles.grid}>
            {backgrounds.map(bg => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSelectedBg(bg)}
                aria-pressed={selectedBg?.id === bg.id}
                style={{
                  ...styles.tile,
                  outline: selectedBg?.id === bg.id ? '3px solid #2563eb' : '1px solid #cbd5e1',
                  background: `url(${bg.url}) center/cover no-repeat`,
                }}
                title={bg.label}
              >
                <span style={styles.tileLabel}>{bg.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <label htmlFor="sb-tags" style={styles.label}>Tags (comma-separated)</label>
          <input
            id="sb-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g., travel, quotes, art"
            style={styles.input}
          />
          {tags.length > 0 && (
            <div style={styles.tagsPreview}>
              {tags.map((t, idx) => (
                <span key={`${t}-${idx}`} style={styles.tagChip}>#{t}</span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div role="alert" style={styles.error}>{error}</div>
        )}

        <div style={styles.actions}>
          <button type="submit" disabled={!canSubmit} style={{
            ...styles.submit,
            backgroundColor: canSubmit ? '#2563eb' : '#94a3b8',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
            {submitting ? 'Creating…' : 'Create stickerboard'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: { maxWidth: 900, margin: '0 auto', padding: '1rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' },
  form: { display: 'grid', gap: '1rem' },
  field: { display: 'grid', gap: 6 },
  label: { fontWeight: 600 },
  input: {
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 12,
  },
  tile: {
    width: '100%',
    aspectRatio: '1 / 1',
    maxHeight: 180,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#334155',
    backgroundSize: 'cover',
  },
  tileLabel: { fontSize: 14, fontWeight: 600 },
  tagsPreview: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    background: '#e2e8f0',
    color: '#0f172a',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '8px 12px',
    borderRadius: 8,
  },
  actions: { display: 'flex', justifyContent: 'flex-end' },
  submit: {
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 700,
  },
};
