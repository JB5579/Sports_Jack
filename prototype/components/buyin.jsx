// BUY-IN — selecting stake for a game
function BuyInScreen() {
  const [amount, setAmount] = React.useState(150);
  const presets = [50, 100, 150, 250, 500, 1000];

  return (
    <div className="felt-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn-ghost" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>←</button>
        <div className="label">Sit down</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Game header */}
      <div style={{ padding: '8px 18px 18px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          <div className="live-dot" />
          <span className="label" style={{ color: 'oklch(72% 0.15 25)' }}>Q1 · 8:42 · BLU @ RED</span>
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em' }}>Buy in your yards</div>
        <div style={{ fontSize: 12, color: 'var(--on-felt-dim)', marginTop: 6, lineHeight: 1.5, maxWidth: 280, margin: '6px auto 0' }}>
          Each quarter is one blackjack hand. Three hands left this game.
        </div>
      </div>

      {/* Big amount display */}
      <div style={{ textAlign: 'center', padding: '20px 18px 28px' }}>
        <div className="label">Your stack</div>
        <div className="display tabular" style={{ fontSize: 64, lineHeight: 1, color: 'var(--gold-shine)', marginTop: 4 }}>
          {amount}<span style={{ fontSize: 22, marginLeft: 8, color: 'var(--on-felt-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>YDS</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--on-felt-faint)', marginTop: 6, letterSpacing: '0.1em', fontFamily: 'var(--mono)' }}>1 YD = 1 USDC · SOLANA</div>
      </div>

      {/* Presets */}
      <div style={{ padding: '0 18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {presets.map(v => (
            <button key={v}
              onClick={() => setAmount(v)}
              style={{
                padding: '14px 0',
                background: amount === v ? 'rgba(218,165,32,0.18)' : 'rgba(255,255,255,0.04)',
                border: amount === v ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                color: amount === v ? 'var(--gold-shine)' : 'var(--on-felt)',
                fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500,
                cursor: 'pointer',
              }}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* Table preview */}
      <div style={{ padding: '0 18px', flex: 1 }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span className="label">Table 4 · 6-max</span>
            <span className="label">5 / 6 seated</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0' }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i === 6 ? 'transparent' : 'rgba(255,255,255,0.08)',
                border: i === 6 ? '1.5px dashed var(--gold)' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: i === 6 ? 'var(--gold)' : 'var(--on-felt-dim)',
              }}>{i === 6 ? 'YOU' : ''}</div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 6 }}>
            <div>
              <div className="label" style={{ fontSize: 9 }}>Avg stack</div>
              <div className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>182 <span style={{ fontSize: 9, color: 'var(--on-felt-dim)', fontFamily: 'var(--mono)' }}>YDS</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label" style={{ fontSize: 9 }}>Rake</div>
              <div className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>10%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm */}
      <div className="rail" style={{ padding: '14px 18px 28px' }}>
        <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: 15, letterSpacing: '0.02em' }}>
          Buy in for {amount} yards →
        </button>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--on-felt-faint)', marginTop: 8, fontFamily: 'var(--mono)' }}>
          Held in escrow until quarter ends
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BuyInScreen });
