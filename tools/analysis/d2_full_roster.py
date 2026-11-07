#!/usr/bin/env python3
"""Q1/Q2 evidence: face values with a full game-day roster deck and no card limit.

    uv run --with pandas --with numpy tools/analysis/d2_full_roster.py \
        .cache/nflverse/pbp__play_by_play_2025.csv.gz .cache/nflverse/weekly_rosters__roster_weekly_2025.csv [--idp]

--idp also scores defenders (ruleset sportsjack-v1, MISSION.md Q10).
The player strategy is a simple stand-in: Hit at the deal until the face total
reaches T, then hold. Results are in docs/analysis/D1-score-normalization.md.
"""
import sys

import numpy as np
import pandas as pd

# Reuse the play scoring from the D1 script (everything before its deck proxy).
exec(open("tools/analysis/d1_normalization.py").read().split("# deck:")[0])

if "--idp" in sys.argv:
    # sportsjack-v1 defense: solo 1, assist 0.5, sack 2 (half 1), INT 3, forced fumble 3, pass defended 1.
    idp = [("solo_tackle_1_player_id", 1), ("solo_tackle_2_player_id", 1), ("assist_tackle_1_player_id", 0.5),
           ("assist_tackle_2_player_id", 0.5), ("sack_player_id", 2), ("half_sack_1_player_id", 1),
           ("half_sack_2_player_id", 1), ("interception_player_id", 3), ("forced_fumble_player_1_player_id", 3),
           ("forced_fumble_player_2_player_id", 3), ("pass_defense_1_player_id", 1), ("pass_defense_2_player_id", 1)]
    extra = [df[["game_id", "qtr", col]].dropna().assign(pts=value).rename(columns={"game_id": "game", col: "pid"})
             for col, value in idp]
    pts = pd.concat([pts] + extra, ignore_index=True)
r = pd.read_csv(sys.argv[2], low_memory=False)
r = r[r.status == 'ACT'][['week','team','gsis_id','position']]
games = df.groupby('game_id').agg(week=('week','first'), home=('home_team','first'), away=('away_team','first')).reset_index()
deck = pd.concat([games.merge(r, left_on=['week',s], right_on=['week','team']) for s in ('home','away')])[['game_id','gsis_id','position']]
deck = deck.rename(columns={'game_id':'game','gsis_id':'pid'})
q = pts.groupby(['game','qtr','pid']).pts.sum().reset_index()
full = deck.merge(pd.DataFrame({'qtr':[1,2,3,4]}), how='cross').merge(q, on=['game','qtr','pid'], how='left').fillna({'pts':0})
avg = full.groupby('pid').pts.mean()
full['proj'] = full.pid.map(avg)
print("deck size/game %.0f, cards with zero season projection %.0f%%" % (deck.groupby('game').size().mean(), 100*(full.proj==0).mean()))
rng = np.random.default_rng(7)
def run(face_fn, label):
    full['face'] = face_fn(full)
    groups = [(g.face.values, g.pts.values) for _, g in full.groupby(['game','qtr'])]
    print(label, "| faces: share at 2 = %.0f%%, mean %.1f" % (100*(full.face==2).mean(), full.face.mean()))
    for T in (13, 15, 17):
        tot, n = [], []
        for _ in range(20000):
            f, p = groups[rng.integers(len(groups))]
            order = rng.permutation(len(f)); k = 2
            while f[order[:k]].sum() < T: k += 1
            tot.append(f[order[:k]].sum() + 0.5*p[order[:k]].sum()); n.append(k)
        tot = np.array(tot)
        print(f"   hit to face {T}: cards avg {np.mean(n):.1f} | final median {np.median(tot):.1f}, 17-21 {((tot>=17)&(tot<=21)).mean():.0%}, bust {(tot>21).mean():.0%}")
    deal = []
    for _ in range(20000):
        f, p = groups[rng.integers(len(groups))]; i = rng.choice(len(f), 2, replace=False); deal.append(f[i].sum())
    print("   opening 2-card face median %.0f" % np.median(deal))
run(lambda d: d.groupby(['game','qtr']).proj.rank(pct=True).mul(8).round().add(2).clip(2,10), "A) face by rank in deck (2-10)")
run(lambda d: (2 + (d.proj*2).round()).clip(2,10), "B) face = 2 + 2x projected quarter pts")
