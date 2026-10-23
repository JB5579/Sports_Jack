// Blackjack-style gameplay
// Hero metric: distance to 21 (live). Hit/Stand actions. Power-ups: Freeze, Burn.
// Modes: vs-dealer, vs-players

function GameplayBJ({ phase: phaseProp = 'midgame', mode = 'players' }) {
  // Live values for the player pool — change every tick
  const [values, setValues] = React.useState({
    qb1: 9.4, te1: 4.8, rb1: 6.2, wr2: 5.1, qb2: 8.3, rb2: 7.8, wr1: 3.4, te2: 2.2, k1: 1.5, k2: 1.0,
  });
  const [deltas, setDeltas] = React.useState({});

  // My hand: ordered list of card keys + per-card "frozen" flag for the freeze power-up
  const [myHand, setMyHand] = React.useState(['qb1', 'te1']);
  const [frozen, setFrozen] = React.useState({}); // {cardKey: lockedValue}

  // Power-up usage
  const [powerups, setPowerups] = React.useState({ freeze: 1, burn: 1 });

  // Standing? if true, no more hits; cards still live unless frozen
  const [standing, setStanding] = React.useState(phaseProp === 'standing' || phaseProp === 'showdown');

  // Phase override for showdown screens
  const phase = phaseProp;

  // Deck — players not yet in hand
  const deck = Object.keys(window.ROSTER).filter(k => !myHand.includes(k));

  // Dealer hand (only for vs-dealer mode)
  const [dealerHand] = React.useState(['qb2', 'rb2']);

  React.useEffect(() => {
    const id = setInterval(() => {
      setValues(prev => {
        const next = {};
        const ds = {};
        Object.entries(prev).forEach(([k, v]) => {
          // Some cards can go negative (penalties, fumbles)
          const change = (Math.random() - 0.42) * 1.4;
          next[k] = v + change;
          if (Math.abs(change) > 0.2) ds[k] = change > 0 ? 'up' : 'down';
        });
        setDeltas(ds);
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Compute totals — frozen cards use locked value, others use live
  const cardValue = (k) => frozen[k] !== undefined ? frozen[k] : values[k];
  const myTotal = myHand.reduce((s, k) => s + cardValue(k), 0);
  const dealerTotal = dealerHand.reduce((s, k) => s + values[k], 0);

  const hit = () => {
    if (standing || deck.length === 0) return;
    // Take the next card (in real game would be random)
    const next = deck[Math.floor(Math.random() * deck.length)];
    setMyHand([...myHand, next]);
  };

  const stand = () => setStanding(true);

  const useFreeze = () => {
    if (powerups.freeze < 1) return;
    const lock = {};
    myHand.forEach(k => { lock[k] = values[k]; });
    setFrozen(lock);
    setPowerups({ ...powerups, freeze: 0 });
  };

  const useBurn = (cardKey) => {
    if (powerups.burn < 1) return;
    setMyHand(myHand.filter(k => k !== cardKey));
    setPowerups({ ...powerups, burn: 0 });
  };

  return (
    <div className="felt-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <BJTopBar mode={mode} />
      <BJHeroDial total={myTotal} standing={standing} frozen={Object.keys(frozen).length > 0} />
      <BJHand
        hand={myHand}
        values={values}
        frozen={frozen}
        deltas={deltas}
        onBurn={useBurn}
        burnReady={powerups.burn > 0}
      />
      {mode === 'dealer' && (
        <DealerStrip hand={dealerHand} values={values} total={dealerTotal} />
      )}
      <BJBottomBar
        standing={standing}
        powerups={powerups}
        onHit={hit}
        onStand={stand}
        onFreeze={useFreeze}
        myTotal={myTotal}
        phase={phase}
      />
    </div>
  );
}

// — Top bar: game time, score, pot
function BJTopBar({ mode }) {
  return (
    <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="live-dot" />
        <div>
          <div className="label" style={{ fontSize: 9 }}>Q1 · LIVE</div>
          <div className="display tabular" style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>8:42</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ScoreCellMini code="BLU" score={10} />
        <span style={{ color: 'var(--on-felt-faint)', fontSize: 11 }}>—</span>
        <ScoreCellMini code="RED" score={14} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="label" style={{ fontSize: 9 }}>{mode === 'dealer' ? 'vs Dealer' : '5 in pot'}</div>
        <div className="display tabular" style={{ fontSize: 16, lineHeight: 1, marginTop: 1, color: 'var(--gold-shine)' }}>1,200<span style={{ fontSize: 10, color: 'var(--on-felt-dim)', marginLeft: 3, fontFamily: 'var(--mono)' }}>YDS</span></div>
      </div>
    </div>
  );
}

function ScoreCellMini({ code, score }) {
  const colors = { RED: '#B53A3A', BLU: '#2E5BBA' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, background: colors[code], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 8, fontWeight: 500 }}>{code}</div>
      <div className="display tabular" style={{ fontSize: 15 }}>{score}</div>
    </div>
  );
}

// — Hero dial: the central "where am I vs 21" gauge
function BJHeroDial({ total, standing, frozen }) {
  const target = 21;
  const pct = Math.max(0, Math.min(1, total / target));
  const bust = total > target;
  const sweet = total >= 18 && total <= 21;
  const danger = total >= 19 && total <= 21;

  // Colors
  const ringColor = bust ? 'var(--down)' : sweet ? 'var(--gold)' : 'var(--felt-500)';
  const numColor = bust ? 'var(--down)' : sweet ? 'var(--gold-shine)' : 'var(--on-felt)';

  // Arc rendering (semicircle gauge)
  const radius = 92;
  const circ = Math.PI * radius;
  const offset = circ * (1 - pct);

  return (
    <div style={{ padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 220, height: 130 }}>
        <svg width="220" height="130" viewBox="0 0 220 130" style={{ position: 'absolute', inset: 0 }}>
          {/* Track */}
          <path
            d={`M 18 110 A ${radius} ${radius} 0 0 1 202 110`}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M 18 110 A ${radius} ${radius} 0 0 1 202 110`}
            fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
          {/* Tick marks at 17, 19, 21 */}
          {[17, 19, 21].map(t => {
            const a = Math.PI - (Math.PI * t / target);
            const x1 = 110 + Math.cos(a) * (radius - 10);
            const y1 = 110 - Math.sin(a) * (radius - 10);
            const x2 = 110 + Math.cos(a) * (radius + 10);
            const y2 = 110 - Math.sin(a) * (radius + 10);
            return (
              <g key={t}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                <text x={110 + Math.cos(a) * (radius + 22)} y={110 - Math.sin(a) * (radius + 22) + 4}
                      textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="var(--mono)" fontWeight="600">{t}</text>
              </g>
            );
          })}
        </svg>
        {/* Center number */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
          <div className="display tabular" style={{ fontSize: 56, lineHeight: 1, color: numColor, letterSpacing: '-0.03em' }}>
            {total.toFixed(1)}
          </div>
          <div className="label" style={{ fontSize: 9, marginTop: 2, color: bust ? 'var(--down)' : 'var(--on-felt-dim)' }}>
            {bust ? `BUST · ${(total - target).toFixed(1)} OVER` : `${(target - total).toFixed(1)} TO 21`}
          </div>
        </div>
      </div>
      {/* Status pill */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {standing && <Pill icon="✓" label="Standing" tone="gold" />}
        {frozen && <Pill icon="❄" label="Frozen" tone="ice" />}
        {!standing && !frozen && (
          <Pill icon={sweet ? '★' : '·'} label={bust ? 'Busted — drop back under 21 to recover' : sweet ? 'Sweet spot' : danger ? 'Danger zone' : 'Live · values moving'} tone={bust ? 'red' : sweet ? 'gold' : 'neutral'} />
        )}
      </div>
    </div>
  );
}

function Pill({ icon, label, tone }) {
  const tones = {
    gold: { bg: 'rgba(218,165,32,0.15)', border: 'rgba(218,165,32,0.5)', color: 'var(--gold-shine)' },
    ice: { bg: 'rgba(125,180,220,0.12)', border: 'rgba(125,180,220,0.4)', color: '#9CC8E0' },
    red: { bg: 'rgba(181,58,58,0.15)', border: 'rgba(181,58,58,0.5)', color: '#E89999' },
    neutral: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', color: 'var(--on-felt-dim)' },
  };
  const t = tones[tone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: t.bg, border: `1px solid ${t.border}`, color: t.color,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 500,
    }}>
      <span>{icon}</span>{label}
    </div>
  );
}

// — Player's hand display
function BJHand({ hand, values, frozen, deltas, onBurn, burnReady }) {
  const cardSize = hand.length <= 2 ? 'md' : hand.length === 3 ? 'sm' : 'sm';
  const overlap = hand.length >= 4 ? -16 : hand.length === 3 ? -8 : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 18px', gap: 8 }}>
      <div className="label" style={{ marginTop: 4 }}>Your hand · {hand.length} cards</div>
      <div style={{ display: 'flex', gap: overlap, alignItems: 'flex-end' }}>
        {hand.map((p, i) => {
          const isFrozen = frozen[p] !== undefined;
          const v = isFrozen ? frozen[p] : values[p];
          return (
            <div key={p + i} style={{ position: 'relative', transform: `rotate(${(i - (hand.length - 1)/2) * 4}deg)`, marginLeft: i > 0 ? overlap : 0 }}>
              <PlayingCard
                player={p} size={cardSize}
                valueOverride={v}
                glow={isFrozen ? 'community' : null}
                animClass={deltas[p] === 'up' ? 'stat-up' : deltas[p] === 'down' ? 'stat-down' : ''}
              />
              {isFrozen && (
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#9CC8E0', color: '#0e2535',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, border: '2px solid var(--felt-800)',
                }}>❄</div>
              )}
              {burnReady && !isFrozen && (
                <button onClick={() => onBurn(p)} style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(181,58,58,0.95)', color: '#fff',
                  border: '2px solid var(--felt-800)',
                  width: 22, height: 22, borderRadius: '50%',
                  fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0,
                }}>🔥</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// — Dealer strip (only in dealer mode)
function DealerStrip({ hand, values, total }) {
  return (
    <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div className="label" style={{ fontSize: 9 }}>House · Dealer</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {hand.map((p, i) => (
            <PlayingCard key={p + i} player={p} size="xs" valueOverride={values[p]} />
          ))}
          <PlayingCard player="" size="xs" face={false} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="label" style={{ fontSize: 9 }}>Showing</div>
        <div className="display tabular" style={{ fontSize: 22, color: total > 21 ? 'var(--down)' : 'var(--on-felt)', lineHeight: 1, marginTop: 1 }}>{total.toFixed(1)}</div>
      </div>
    </div>
  );
}

// — Bottom action bar: Hit / Stand + power-ups
function BJBottomBar({ standing, powerups, onHit, onStand, onFreeze, myTotal, phase }) {
  if (phase === 'showdown') {
    return (
      <div className="rail" style={{ padding: '14px 18px 28px' }}>
        <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: 14, letterSpacing: '0.04em' }}>
          Next quarter →
        </button>
      </div>
    );
  }
  return (
    <div className="rail" style={{ padding: '12px 14px 22px' }}>
      {/* Power-ups row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <PowerupBtn
          icon="❄" label="Freeze" sublabel="Lock total"
          ready={powerups.freeze > 0}
          onClick={onFreeze}
        />
        <PowerupBtn
          icon="🔥" label="Burn" sublabel="Discard a card"
          ready={powerups.burn > 0}
        />
        <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
          <div className="label" style={{ fontSize: 8 }}>Bust risk</div>
          <div className="tabular" style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: myTotal > 18 ? 'var(--down)' : myTotal > 15 ? 'var(--gold-shine)' : 'var(--on-felt-dim)' }}>
            {myTotal > 21 ? 'BUST' : myTotal > 18 ? 'High' : myTotal > 15 ? 'Med' : 'Low'}
          </div>
        </div>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onStand}
          disabled={standing}
          style={{
            flex: 1, padding: '14px 0',
            background: standing ? 'rgba(218,165,32,0.25)' : 'rgba(255,255,255,0.06)',
            border: standing ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, color: standing ? 'var(--gold-shine)' : 'var(--on-felt)',
            fontWeight: 600, fontSize: 13, letterSpacing: '0.04em',
            cursor: standing ? 'default' : 'pointer',
          }}>{standing ? 'STANDING' : 'STAND'}</button>
        <button
          onClick={onHit}
          disabled={standing}
          className={standing ? '' : 'btn-primary'}
          style={{
            flex: 1.6, padding: '14px 0', fontSize: 14, letterSpacing: '0.04em',
            ...(standing ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--on-felt-faint)', borderRadius: 12, fontWeight: 600 } : {}),
          }}>HIT</button>
      </div>
    </div>
  );
}

function PowerupBtn({ icon, label, sublabel, ready, onClick }) {
  return (
    <button
      onClick={ready ? onClick : undefined}
      style={{
        flex: 1.2,
        padding: '8px 8px',
        background: ready ? 'linear-gradient(180deg, oklch(35% 0.06 200), oklch(28% 0.05 210))' : 'rgba(255,255,255,0.03)',
        border: ready ? '1px solid oklch(50% 0.1 210)' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10,
        color: ready ? 'var(--on-felt)' : 'var(--on-felt-faint)',
        cursor: ready ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
      <span style={{ fontSize: 16, opacity: ready ? 1 : 0.4 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</div>
        <div style={{ fontSize: 9, color: 'var(--on-felt-faint)', marginTop: 1 }}>{ready ? sublabel : 'Used'}</div>
      </div>
    </button>
  );
}

Object.assign(window, { GameplayBJ });
