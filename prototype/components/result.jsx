// HAND RESULT — post-quarter blackjack showdown
function HandResultScreen() {
  const myHand = ['qb1', 'te1', 'rb2'];
  const myValues = [9.4, 4.8, 5.6];
  const myTotal = myValues.reduce((s, v) => s + v, 0); // 19.8

  const opponents = [
    { who: 'Player 2', cards: ['qb2', 'wr2'], values: [8.3, 7.1], total: 15.4, status: 'short' },
    { who: 'Player 3', cards: ['rb1', 'te2', 'k1'], values: [9.6, 6.2, 7.5], total: 23.3, status: 'bust' },
    { who: 'Player 5', cards: ['wr1', 'qb1'], values: [10.4, 8.2], total: 18.6, status: 'short' },
  ];

  return (
    <div className="felt-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top */}
      <div style={{ padding: '14px 18px 8px', textAlign: 'center' }}>
        <div className="label">Q1 Final · BLU 10 — RED 14</div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', padding: '22px 18px 18px' }}>
        <div className="shine" style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em' }}>You took it</div>
        <div className="display tabular" style={{ fontSize: 56, color: 'var(--gold-shine)', lineHeight: 1, marginTop: 6 }}>
          +1,080<span style={{ fontSize: 18, marginLeft: 6, color: 'var(--on-felt-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>YDS</span>
        </div>
        <div className="label" style={{ marginTop: 8 }}>Closest to 21 · {myTotal.toFixed(1)} points</div>
      </div>

      {/* Your final hand */}
      <div style={{ padding: '0 18px 14px' }}>
        <div className="label" style={{ textAlign: 'center', marginBottom: 10 }}>Your hand · stood on {myTotal.toFixed(1)}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {myHand.map((p, i) => (
            <PlayingCard key={p + i} player={p} size="sm" valueOverride={myValues[i]} glow="gold" />
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ padding: '8px 18px 0', flex: 1 }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="label" style={{ marginBottom: 10 }}>Showdown · 4 players</div>
          <BJRow rank={1} who="YOU" total={myTotal} cards={myHand.length} status="stood" amount="+1,080" winner />
          <BJRow rank={2} who="Player 5" total={18.6} cards={2} status="stood" amount="−420" />
          <BJRow rank={3} who="Player 2" total={15.4} cards={2} status="short" amount="−300" />
          <BJRow rank={4} who="Player 3" total={23.3} cards={3} status="bust" amount="−360" />
        </div>
      </div>

      {/* Bottom */}
      <div className="rail" style={{ padding: '14px 18px 28px', marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="label" style={{ fontSize: 9 }}>Stack now</div>
            <div className="display tabular" style={{ fontSize: 22, color: 'var(--gold-shine)', marginTop: 2 }}>3,530<span style={{ fontSize: 11, color: 'var(--on-felt-dim)', marginLeft: 3, fontFamily: 'var(--mono)' }}>YDS</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label" style={{ fontSize: 9 }}>Q2 begins</div>
            <div className="display tabular" style={{ fontSize: 22, marginTop: 2 }}>12:43</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1, padding: '14px', fontSize: 13 }}>Cash out</button>
          <button className="btn-primary" style={{ flex: 1.6, padding: '14px', fontSize: 13, letterSpacing: '0.04em' }}>Stay for Q2 →</button>
        </div>
      </div>
    </div>
  );
}

function BJRow({ rank, who, total, cards, status, amount, winner }) {
  const statusLabel = status === 'bust' ? 'Bust' : status === 'short' ? 'Stayed under' : 'Stood';
  const statusColor = status === 'bust' ? 'var(--down)' : 'var(--on-felt-dim)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: winner ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
        color: winner ? 'var(--ink-900)' : 'var(--on-felt-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>{rank}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: winner ? 'var(--gold-shine)' : 'var(--on-felt)' }}>{who}</div>
        <div style={{ fontSize: 11, color: statusColor, marginTop: 1 }}>{statusLabel} · {cards} cards</div>
      </div>
      <div className="tabular" style={{ fontSize: 16, fontFamily: 'var(--serif)', color: status === 'bust' ? 'var(--down)' : winner ? 'var(--gold-shine)' : 'var(--on-felt)', minWidth: 44, textAlign: 'right' }}>
        {total.toFixed(1)}
      </div>
      <div className="tabular" style={{
        fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
        minWidth: 68, textAlign: 'right',
        color: winner ? 'var(--gold-shine)' : 'var(--on-felt-dim)',
      }}>{amount}</div>
    </div>
  );
}

Object.assign(window, { HandResultScreen });
