// Playing card — actual playing-card shape, position color band, initials as the "rank"
// Sizes: 'sm' (community), 'md' (hole), 'lg' (showdown), 'xs' (mini)

function PlayingCard({ player, size = 'md', face = true, glow = null, dealt = true, dealDelay = 0, valueOverride = null, animClass = '', live = false }) {
  const p = window.ROSTER[player];
  const sizes = {
    xs: { w: 44,  h: 64,  initials: 11, pts: 9,  label: 7,  pad: 4 },
    sm: { w: 64,  h: 92,  initials: 16, pts: 12, label: 8,  pad: 6 },
    md: { w: 96,  h: 138, initials: 26, pts: 18, label: 9,  pad: 9 },
    lg: { w: 116, h: 168, initials: 32, pts: 22, label: 10, pad: 11 },
  };
  const s = sizes[size] || sizes.md;

  if (!face) {
    // Card back
    return (
      <div
        className={dealt ? 'deal' : ''}
        style={{
          width: s.w, height: s.h,
          borderRadius: 'var(--r-pcard)',
          background: 'linear-gradient(135deg, oklch(28% 0.08 280) 0%, oklch(20% 0.06 270) 100%)',
          backgroundImage: `repeating-linear-gradient(45deg, oklch(35% 0.1 280) 0 2px, transparent 2px 6px), linear-gradient(135deg, oklch(28% 0.08 280) 0%, oklch(20% 0.06 270) 100%)`,
          boxShadow: '0 1px 0 rgba(255,255,255,0.1) inset, 0 8px 16px -4px rgba(0,0,0,0.5)',
          border: '2px solid oklch(40% 0.1 280)',
          animationDelay: `${dealDelay}ms`,
        }}
      />
    );
  }

  if (!p) return null;
  const value = valueOverride !== null ? valueOverride : p.proj;
  const glowStyle = glow === 'gold'
    ? { boxShadow: '0 0 0 2px var(--gold), 0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 24px -4px var(--gold)' }
    : glow === 'community'
    ? { boxShadow: '0 0 0 2px oklch(60% 0.13 290), 0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 16px -4px rgba(0,0,0,0.5)' }
    : {};

  return (
    <div
      className={`pcard ${dealt ? 'deal' : ''} ${animClass}`}
      style={{
        width: s.w, height: s.h, padding: s.pad,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        animationDelay: `${dealDelay}ms`,
        ...glowStyle,
      }}
    >
      {/* Position color band */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: window.POS_COLOR[p.pos],
        borderTopLeftRadius: 'var(--r-pcard)', borderTopRightRadius: 'var(--r-pcard)',
      }} />
      {/* Top-left rank: position + team */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 2 }}>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: s.initials * 0.55,
          fontWeight: 500,
          lineHeight: 1,
          color: window.POS_COLOR[p.pos],
        }}>{p.pos}</div>
        <div style={{
          fontSize: s.label,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--ink-700)',
          marginTop: 2,
        }}>{p.team}</div>
      </div>
      {/* Center initials (the "face") */}
      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--serif)',
        fontSize: s.initials,
        fontWeight: 400,
        letterSpacing: '-0.02em',
        color: 'var(--ink-900)',
        lineHeight: 1,
      }}>
        {p.initials}
      </div>
      {/* Bottom: live points */}
      <div style={{
        textAlign: 'center',
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3,
      }}>
        <span className={`tabular ${animClass}`} style={{
          fontFamily: 'var(--serif)',
          fontSize: s.pts,
          fontWeight: 500,
          color: 'var(--ink-900)',
          lineHeight: 1,
        }}>{value.toFixed(1)}</span>
        <span style={{ fontSize: s.label - 1, color: 'var(--ink-500)', fontWeight: 600, letterSpacing: '0.1em' }}>PTS</span>
      </div>
      {live && (
        <div style={{ position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%', background: 'var(--up)' }} />
      )}
    </div>
  );
}

// Hole card slot (empty placeholder)
function CardSlot({ size = 'md', label = '' }) {
  const sizes = { sm: { w: 64, h: 92 }, md: { w: 96, h: 138 }, lg: { w: 116, h: 168 } };
  const s = sizes[size];
  return (
    <div style={{
      width: s.w, height: s.h,
      borderRadius: 'var(--r-pcard)',
      border: '1.5px dashed rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--on-felt-faint)',
      fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
    }}>{label}</div>
  );
}

Object.assign(window, { PlayingCard, CardSlot });
