import { useEffect, useState } from "react";
import { onboarding, track, useSportsJack } from "./api.ts";
import { Lobby, type Sport } from "./Lobby.tsx";
import { FeedbackSheet, GridSheet, ResultSheet, RulesSheet, Sheet, WalletSheet } from "./Sheets.tsx";
import { TableScreen } from "./TableScreen.tsx";
import { refusalText } from "./format.ts";

type SheetName = "grid" | "wallet" | "rules" | "feedback" | null;

const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function App() {
  const sj = useSportsJack();
  const { state } = sj;
  const [sheet, setSheet] = useState<SheetName>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(() => !onboarding.done());
  const [sport, setSport] = useState<Sport>(() => { try { return localStorage.getItem("sj-sport") === "nba" ? "nba" : "nfl"; } catch { return "nfl"; } });
  const chooseSport = (s: Sport) => { setSport(s); track("sport_toggle", { sport: s }); try { localStorage.setItem("sj-sport", s); } catch { /* storage blocked */ } };
  const rulesSport: Sport = state.table?.game.sport ?? sport;
  const rules = state.lobby?.games.find((g) => g.sport === rulesSport)?.rules ?? state.rules;
  const startPractice = (which: Sport) => { onboarding.finish(); setWelcome(false); setSheet(null); chooseSport(which); sj.practice(which); };
  useEffect(() => { track("app_open", { standalone: standalone(), width: innerWidth, firstVisit: welcome }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const practiceDone = state.table?.table.practice && state.table.result ? state.table.result.handId : null;
  useEffect(() => { if (practiceDone) track("practice_finish", { handId: practiceDone }); }, [practiceDone]);

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
        <TableScreen view={view} onLeave={() => { setSheet(null); sj.leave(); }} onHit={sj.hit} onFreeze={sj.freeze} onBurn={sj.burn}
          onGrid={() => setSheet("grid")} onFeedback={() => setSheet("feedback")} />
      ) : state.lobby && (
        <Lobby lobby={state.lobby} balance={state.balance} sport={sport} onSport={chooseSport} onSit={sj.sit} onOpen={sj.open} onWallet={() => setSheet("wallet")} onRules={() => setSheet("rules")} onPractice={() => startPractice(sport)} onFeedback={() => setSheet("feedback")} />
      )}
      {gridOpen && <GridSheet view={view!} onClose={() => setSheet(null)} />}
      {result && view && !gridOpen && (
        <ResultSheet view={view} balance={state.balance} onNext={() => setDismissed(result.handId)}
          onLobby={() => { setDismissed(result.handId); sj.leave(); }} onPracticeAgain={() => { setDismissed(result.handId); sj.practice(view.game.sport); }} />
      )}
      {welcome && state.lobby && !view && (
        <Sheet label="Welcome" onClose={() => { onboarding.finish(); setWelcome(false); }}>
          <div className="sheet-head"><div><div className="label">Welcome to SportsJack</div><h2>Learn it in one hand</h2></div></div>
          <p className="help">Play a free hand against the dealer on a real fourth quarter: Super Bowl LX, or a 2026 NBA Finals game (Knicks at Spurs). A short guide shows you Hit, Burn and Freeze as real plays come in. Nothing is at stake.</p>
          <button className="primary" type="button" onClick={() => startPractice("nfl")}>Free NFL practice hand</button>
          <button className="primary" type="button" onClick={() => startPractice("nba")}>Free NBA practice hand</button>
          <button className="secondary" type="button" onClick={() => { onboarding.finish(); setWelcome(false); }}>Skip to the tables</button>
        </Sheet>
      )}
      {sheet === "wallet" && <WalletSheet token={sj.token} balance={state.balance} onClose={() => setSheet(null)} />}
      {sheet === "feedback" && <FeedbackSheet screen={view ? (view.table.practice ? "practice" : "table") : "lobby"} gameId={view?.table.gameId ?? null} onClose={() => setSheet(null)} />}
      {sheet === "rules" && <RulesSheet rules={rules} sport={rulesSport} onClose={() => setSheet(null)} />}
      {state.error && <div className="toast" role="status">{refusalText(state.error.reason)}</div>}
    </div>
  );
}
