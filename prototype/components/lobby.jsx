// LOBBY — browse live NFL games
function LobbyScreen() {
  const games = [
    { id: 1, away: 'BLU', home: 'RED', awayScore: 10, homeScore: 14, q: 1, time: '8:42', tables: 4, players: 21, buyin: '50–500', status: 'live' },
    { id: 2, away: 'GRN', home: 'YEL', awayScore: 0,  homeScore: 0,  q: 0, time: '15:00', tables: 6, players: 38, buyin: '25–250', status: 'soon', kickoff: '4:25 PM' },
    { id: 3, away: 'PUR', home: 'ORG', awayScore: 21, homeScore: 17, q: 3, time: '2:14', tables: 2, players: 11, buyin: '100–1K', status: 'live' },
    { id: 4, away: 'TEA', home: 'CRM', awayScore: 0,  homeScore: 0,  q: 0, time: '15:00', tables: 8, players: 0,  buyin: '25–500', status: 'soon', kickoff: 'Sun 1:00' },
  ];

  return (
    <div className="felt-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="label">Sun · Week 14</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1, marginTop: 2, letterSpacing: '-0.02em' }}>Live Tables</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="label" style={{ fontSize: 9 }}>Wallet</div>
            <div className="display tabular" style={{ fontSize: 17, color: 'var(--gold-shine)' }}>2,450<span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--on-felt-dim)', marginLeft: 3 }}>YDS</span></div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '6px 18px 14px' }}>
        <div className="tab-strip">
          <button className="active">Live</button>
          <button>Upcoming</button>
          <button>My Tables</button>
        </div>
      </div>

      {/* Games */}
      <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {games.map(g => (
          <GameCard key={g.id} game={g} highlight={g.id === 1} />
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, highlight }) {
  const isLive = game.status === 'live';
  return (
    <div style={{
      background: highlight
        ? 'linear-gradient(180deg, oklch(32% 0.06 155) 0%, oklch(26% 0.05 155) 100%)'
        : 'rgba(255,255,255,0.03)',
      border: highlight ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16,
      padding: 14,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {highlight && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gold)', color: 'var(--ink-900)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 8px', borderBottomLeftRadius: 8 }}>HOT</div>
      )}
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive ? <div className="live-dot" /> : null}
          <span className="label" style={{ color: isLive ? 'oklch(72% 0.15 25)' : 'var(--on-felt-dim)' }}>
            {isLive ? `Q${game.q} · ${game.time}` : `Kickoff ${game.kickoff}`}
          </span>
        </div>
        <span className="label">{game.tables} tables · {game.players} playing</span>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <TeamBadge code={game.away} />
          <div className="display tabular" style={{ fontSize: 28, minWidth: 32, color: isLive ? 'var(--on-felt)' : 'var(--on-felt-faint)' }}>{isLive ? game.awayScore : '—'}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--on-felt-faint)', fontWeight: 500 }}>at</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
          <div className="display tabular" style={{ fontSize: 28, minWidth: 32, color: isLive ? 'var(--on-felt)' : 'var(--on-felt-faint)', textAlign: 'right' }}>{isLive ? game.homeScore : '—'}</div>
          <TeamBadge code={game.home} />
        </div>
      </div>

      {/* CTA row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        <div>
          <div className="label" style={{ fontSize: 9 }}>Buy-in (yards)</div>
          <div className="tabular" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{game.buyin}</div>
        </div>
        <button className={highlight ? 'btn-primary' : 'btn-ghost'} style={{
          padding: '10px 18px', fontSize: 13, fontWeight: 600,
        }}>
          {isLive ? 'Sit down' : 'Reserve seat'} →
        </button>
      </div>
    </div>
  );
}

function TeamBadge({ code }) {
  const colors = {
    RED: '#B53A3A', BLU: '#2E5BBA', GRN: '#3F8C5C', YEL: '#C9A227',
    PUR: '#7B4FB5', ORG: '#D67A2C', TEA: '#3F8C8A', CRM: '#A04444',
  };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: colors[code] || '#666',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500,
      color: 'rgba(255,255,255,0.95)',
      letterSpacing: '0.04em',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.15) inset',
    }}>{code}</div>
  );
}

Object.assign(window, { LobbyScreen });
