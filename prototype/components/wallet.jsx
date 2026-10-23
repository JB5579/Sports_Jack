// WALLET — account dashboard
function WalletScreen() {
  const history = [
    { game: 'BLU @ RED · Q1', result: 'Won · 19.8 → 21', amount: '+1,080', win: true, time: '2m ago' },
    { game: 'BLU @ RED · Kickoff', result: 'Bought in', amount: '−150', win: false, time: '14m ago' },
    { game: 'GRN @ YEL · Q4', result: 'Bust · 23.4', amount: '−50', win: false, time: 'Yesterday' },
    { game: 'GRN @ YEL · Q3', result: 'Won · stood on 20.1', amount: '+420', win: true, time: 'Yesterday' },
    { game: 'PUR @ ORG · Q2', result: 'Lost · 16.2 short', amount: '−200', win: false, time: '2 days ago' },
  ];

  return (
    <div className="felt-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top */}
      <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn-ghost" style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>←</button>
        <div className="label">Wallet</div>
        <button className="btn-ghost" style={{ width: 36, height: 36, padding: 0, fontSize: 14 }}>⚙</button>
      </div>

      {/* Big balance */}
      <div style={{ padding: '24px 18px 12px', textAlign: 'center' }}>
        <div className="label">Balance</div>
        <div className="display tabular" style={{ fontSize: 56, color: 'var(--gold-shine)', lineHeight: 1, marginTop: 4 }}>3,530<span style={{ fontSize: 18, color: 'var(--on-felt-dim)', marginLeft: 6, fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>YDS</span></div>
        <div style={{ fontSize: 11, color: 'var(--on-felt-faint)', marginTop: 6, fontFamily: 'var(--mono)', letterSpacing: '0.1em' }}>1 YD = 1 USDC · SOLANA</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ color: 'var(--up)', fontSize: 12, fontWeight: 600 }}>▲ +880 yds</span>
          <span style={{ fontSize: 11, color: 'var(--on-felt-dim)' }}>this week</span>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '16px 18px 0', display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ flex: 1, padding: '12px', fontSize: 13 }}>Deposit</button>
        <button className="btn-ghost" style={{ flex: 1, padding: '12px', fontSize: 13 }}>Withdraw</button>
      </div>

      {/* Stats strip */}
      <div style={{ padding: '20px 18px 14px' }}>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
          <Stat label="Hands" value="42" />
          <Divider />
          <Stat label="Win rate" value="58%" highlight />
          <Divider />
          <Stat label="Best stand" value="20.6" />
        </div>
      </div>

      {/* History */}
      <div style={{ padding: '0 18px', flex: 1 }}>
        <div className="label" style={{ marginBottom: 10 }}>Recent activity</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: i === history.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.game}</div>
                <div style={{ fontSize: 11, color: 'var(--on-felt-dim)', marginTop: 2 }}>{h.result} · <span style={{ color: 'var(--on-felt-faint)' }}>{h.time}</span></div>
              </div>
              <div className="tabular" style={{
                fontFamily: 'var(--serif)', fontSize: 17,
                color: h.win ? 'var(--gold-shine)' : 'var(--on-felt-dim)',
              }}>{h.amount}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="rail" style={{ padding: '10px 18px 22px', display: 'flex', justifyContent: 'space-around' }}>
        <TabIcon label="Tables" />
        <TabIcon label="History" />
        <TabIcon label="Wallet" active />
        <TabIcon label="You" />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div className="label" style={{ fontSize: 9 }}>{label}</div>
      <div className="display tabular" style={{ fontSize: 18, marginTop: 3, color: highlight ? 'var(--gold-shine)' : 'var(--on-felt)' }}>{value}</div>
    </div>
  );
}
function Divider() {
  return <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', margin: '0 6px' }} />;
}
function TabIcon({ label, active }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 500,
      color: active ? 'var(--gold-shine)' : 'var(--on-felt-dim)',
      letterSpacing: '0.04em',
    }}>{label}</div>
  );
}

Object.assign(window, { WalletScreen });
