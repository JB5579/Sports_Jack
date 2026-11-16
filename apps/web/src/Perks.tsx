import { useState } from "react";
import { inviteLink, track, type Perks } from "./api.ts";

/** Invite friends (both get chips once the friend plays a hand) and the rewards track. */
export function PerksCard({ perks }: { perks: Perks }) {
  const [copied, setCopied] = useState(false);
  const { referral, rewards } = perks;
  const link = inviteLink(referral.code);
  const share = async () => {
    track("invite_share", { code: referral.code });
    const text = `Play SportsJack with me: live blackjack with real NFL and NBA players. We both get ${referral.bonus} chips when you play your first hand.`;
    try {
      if (navigator.share) { await navigator.share({ title: "SportsJack", text, url: link }); return; }
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch { /* the share sheet was dismissed */ }
  };
  const next = rewards?.next;
  const reached = rewards ? [...rewards.milestones].reverse().find((m) => m.earned) : undefined;
  const from = reached?.hands ?? 0;
  const progress = rewards && next ? Math.min(1, (rewards.handsPlayed - from) / (next.hands - from)) : 1;
  return (
    <article className="perks-card">
      <div className="perk">
        <div>
          <div className="what">Invite friends</div>
          <div className="meta">You both get {referral.bonus} chips when they play their first hand</div>
          {(referral.joined > 0) && <div className="meta">{referral.joined} joined · {referral.played} played</div>}
        </div>
        <button type="button" onClick={share}>{copied ? "Copied" : "Share"}</button>
      </div>
      <div className="code-line"><span className="label">Your code</span><strong className="num">{referral.code}</strong></div>
      {rewards && (
        <div className="track">
          <div className="track-head">
            <span className="what">Rewards</span>
            <span className="meta">{rewards.handsPlayed} {rewards.handsPlayed === 1 ? "hand" : "hands"} played</span>
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="meta">{next ? `${next.hands - rewards.handsPlayed} more for ${next.chips.toLocaleString()} chips` : "Every milestone reached"} · {rewards.fullGameBonus} chips for playing all four quarters of a game</div>
          <ol className="steps">
            {rewards.milestones.map((m) => (
              <li key={m.hands} className={m.earned ? "done" : ""}><span className="num">{m.hands}</span><small>{m.chips.toLocaleString()}</small></li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
