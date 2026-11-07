import { useEffect, useState } from "react";
import { onboarding, useSportsJack } from "./api.ts";
import { Lobby } from "./Lobby.tsx";
import { GridSheet, ResultSheet, RulesSheet, Sheet, WalletSheet } from "./Sheets.tsx";
import { TableScreen } from "./TableScreen.tsx";
import { refusalText } from "./format.ts";

type SheetName = "grid" | "wallet" | "rules" | null;

export function App() {
  const sj = useSportsJack();
  const { state } = sj;
  const [sheet, setSheet] = useState<SheetName>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(() => !onboarding.done());
  const startPractice = () => { onboarding.finish(); setWelcome(false); setSheet(null); sj.practice(); };

  useEffect(() => {
    if (!state.error) return;
    const t = setTimeout(sj.clearError, 3200);
    return () => clearTimeout(t);
  }, [state.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = state.table;
  const result = view?.result && view.result.standings.some((s) => s.you) && view.result.handId !== dismissed ? view.result : null;
  const gridOpen = sheet === "grid" && !!view?.hand?.mine;

  return (
    <div className="app">
      {state.status === "offline" && <div className="banner" style={{ marginTop: 8 }}>Reconnecting to the table…</div>}
      {!state.lobby && !view && <section className="screen"><div className="waiting"><div className="big">Connecting…</div></div></section>}
      {view ? (
        <TableScreen view={view} onLeave={() => { setSheet(null); sj.leave(); }} onHit={sj.hit} onFreeze={sj.freeze} onBurn={sj.burn} onGrid={() => setSheet("grid")} />
      ) : state.lobby && (
        <Lobby lobby={state.lobby} balance={state.balance} onSit={sj.sit} onOpen={sj.open} onWallet={() => setSheet("wallet")} onRules={() => setSheet("rules")} onPractice={startPractice} />
      )}
      {gridOpen && <GridSheet view={view!} onClose={() => setSheet(null)} />}
      {result && view && !gridOpen && (
        <ResultSheet view={view} balance={state.balance} onNext={() => setDismissed(result.handId)}
          onLobby={() => { setDismissed(result.handId); sj.leave(); }} onPracticeAgain={() => { setDismissed(result.handId); sj.practice(); }} />
      )}
      {welcome && state.lobby && !view && (
        <Sheet label="Welcome" onClose={() => { onboarding.finish(); setWelcome(false); }}>
          <div className="sheet-head"><div><div className="label">Welcome to SportsJack</div><h2>Learn it in one hand</h2></div></div>
          <p className="help">Play a free hand against the dealer on the fourth quarter of Super Bowl LX. A short guide shows you Hit, Burn and Freeze as real plays come in. Nothing is at stake.</p>
          <button className="primary" type="button" onClick={startPractice}>Play a free practice hand</button>
          <button className="secondary" type="button" onClick={() => { onboarding.finish(); setWelcome(false); }}>Skip to the tables</button>
        </Sheet>
      )}
      {sheet === "wallet" && <WalletSheet token={sj.token} balance={state.balance} onClose={() => setSheet(null)} />}
      {sheet === "rules" && <RulesSheet rules={state.rules} onClose={() => setSheet(null)} />}
      {state.error && <div className="toast" role="status">{refusalText(state.error.reason)}</div>}
    </div>
  );
}
