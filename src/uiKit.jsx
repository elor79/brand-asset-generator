// ── SHARED UI PRIMITIVES ─────────────────────────────────────────────
// Lives outside the monolith so extracted sections (GenerateSection.jsx)
// can import BRAND/Section/imgToDataUrl without a circular import back into
// the 12k-line file. Moved verbatim; the monolith imports from here — one
// source of truth, no copies to drift.

// ── BRAND TOKENS ─────────────────────────────────────────────────────
export const BRAND = {
  name: 'medartis',
  claim: 'Artful.',
  ink:     '#1d1d1b',
  ink800:  '#2A2A26',
  ink600:  '#555550',
  ink300:  '#9A9A8E',
  ink100:  '#D8D6CA',
  paper:   '#FFFFFF',
  bone:    '#F4F2EA',
  bone00:  '#FAF8F0',
  coal:    '#131310',
  coal800: '#1C1C17',
  coal700: '#2A2A23',
  cream50:  '#F6F4EC',
  cream100: '#E6E3D5',
  cream300: '#9E9B8B',
  gold:    '#CFAB5C',
  gold500: '#B8923D',
  // Accessible gold — the brand gold is only 1.9–2.2:1 on light surfaces, which
  // fails WCAG. This deepened gold keeps the hue and clears AA (4.6–5.1:1) on
  // paper/bone/cream. Used when "safe accent" is on (see the BRAND CHECK panel).
  goldDeep: '#8A6828',
  plateBlue: '#BBD7F3',
  display: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:    '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

/** An <img> (upload, Canto, generated) → a PNG data URL we can post to the server. */
export function imgToDataUrl(img, maxEdge = 1024) {
  if (!img) return null;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  try { return c.toDataURL('image/png'); }
  catch { return null; }   // a cross-origin image taints the canvas — say nothing, offer upload
}

export const Section = ({ label, children, collapsed, onToggle }) => {
  const isCollapsible = typeof onToggle === 'function';
  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={isCollapsible ? onToggle : undefined}
        disabled={!isCollapsible}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.16em', fontWeight: 500,
          color: BRAND.ink, marginBottom: collapsed ? 0 : 12, fontFamily: BRAND.mono,
          textTransform: 'uppercase', background: 'transparent', border: 'none',
          padding: 0, cursor: isCollapsible ? 'pointer' : 'default', textAlign: 'left'
        }}
      >
        {isCollapsible && (
          <span style={{
            display: 'inline-block', width: 8,
            transition: 'transform 0.12s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
          }}>▾</span>
        )}
        <span style={{ flex: 1 }}>{label}</span>
      </button>
      {!collapsed && children}
    </div>
  );
};
