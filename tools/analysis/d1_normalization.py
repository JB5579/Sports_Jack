#!/usr/bin/env python3
"""D1 evidence: how close do real per-quarter fantasy points get to 21?

Simulates SportsJack hands on every quarter of a real nflverse season:

    uv run --with pandas --with numpy tools/analysis/d1_normalization.py .cache/nflverse/pbp__play_by_play_2025.csv.gz

Deck proxy: per game, the 11 most-involved offensive players per team (~20-22 cards,
PRD D2). Scoring: PRD §4.1 (standard PPR, pass TD 4, -2 INT/fumble lost, -1 sack).
Results and their reading are in docs/analysis/D1-score-normalization.md.
"""
import sys

import numpy as np
import pandas as pd

df = pd.read_csv(sys.argv[1], low_memory=False)
df = df[df.qtr.between(1,4)]
rows=[]
def add(pid, name, team, pts, r):
    if isinstance(pid,str): rows.append((r.game_id, r.qtr, pid, name, team, pts))
for r in df.itertuples():
    if r.play_type not in ('pass','run','qb_kneel','qb_spike') and not (r.sack==1): continue
    if r.two_point_attempt==1: continue
    py = r.passing_yards if r.passing_yards==r.passing_yards else 0
    if isinstance(r.passer_player_id,str):
        p = 0.04*py + (4 if r.pass_touchdown==1 else 0) - (2 if r.interception==1 else 0) - (1 if r.sack==1 else 0)
        add(r.passer_player_id, r.passer_player_name, r.posteam, p, r)
    if isinstance(r.receiver_player_id,str):
        ry = r.receiving_yards if r.receiving_yards==r.receiving_yards else 0
        p = 0.1*ry + (1 if r.complete_pass==1 else 0) + (6 if r.pass_touchdown==1 and r.td_player_id==r.receiver_player_id else 0)
        add(r.receiver_player_id, r.receiver_player_name, r.posteam, p, r)
    if isinstance(r.rusher_player_id,str):
        ry = r.rushing_yards if r.rushing_yards==r.rushing_yards else 0
        p = 0.1*ry + (6 if r.rush_touchdown==1 and r.td_player_id==r.rusher_player_id else 0)
        add(r.rusher_player_id, r.rusher_player_name, r.posteam, p, r)
    if r.fumble_lost==1 and isinstance(r.fumbled_1_player_id,str):
        add(r.fumbled_1_player_id, r.fumbled_1_player_name, r.posteam, -2, r)
pts = pd.DataFrame(rows, columns=['game','qtr','pid','name','team','pts'])
# deck: per game, top 11 players per team by total game involvement (proxy for ~22 skill starters)
inv = pts.groupby(['game','team','pid']).size().reset_index(name='n')
inv['rk']=inv.groupby(['game','team']).n.rank(ascending=False, method='first')
deck = inv[inv.rk<=11][['game','pid']]
q = pts.groupby(['game','qtr','pid']).pts.sum().reset_index()
full = deck.merge(pd.DataFrame({'qtr':[1,2,3,4]}),how='cross').merge(q,on=['game','qtr','pid'],how='left').fillna({'pts':0})
print("games", full.game.nunique(), "deck size/game", deck.groupby('game').size().mean())
c=full.pts; print("per-card per-quarter pts: mean %.2f median %.2f p90 %.2f p99 %.2f max %.1f zero-share %.2f"%(c.mean(),c.median(),c.quantile(.9),c.quantile(.99),c.max(),(c==0).mean()))
rng=np.random.default_rng(1)
groups=[g.pts.values for _,g in full.groupby(['game','qtr'])]
def sim(ncards, mult):
    s=[]
    for _ in range(40000):
        g=groups[rng.integers(len(groups))]; s.append(g[rng.choice(len(g),ncards,replace=False)].sum()*mult)
    return np.array(s)
for n in (2,3,4,5):
    s=sim(n,1); print(f"{n} cards raw: mean {s.mean():.1f} p50 {np.median(s):.1f} p90 {np.quantile(s,.9):.1f} >=17&<=21 {((s>=17)&(s<=21)).mean():.3f} >21 {(s>21).mean():.3f}")
s2=sim(2,1); s3=sim(3,1)
for m in (2,2.5,3,3.5,4):
    a=s2*m; b=s3*m
    print(f"mult {m}: 2c in17-21 {((a>=17)&(a<=21)).mean():.3f} 2c bust {(a>21).mean():.3f} 2c median {np.median(a):.1f} | 3c in17-21 {((b>=17)&(b<=21)).mean():.3f} 3c bust {(b>21).mean():.3f}")
print("--- option: face value (2..10 by in-game deck rank, prior-involvement proxy) + live quarter points")
# Face value 2..10 from the player's rank in the game's deck by season-average quarter points.
# Uses the whole season (lookahead) as a stand-in for a real pre-game projection.
avg = full.groupby('pid').pts.mean()
full['proj']=full.pid.map(avg)
full['face']=full.groupby(['game','qtr']).proj.rank(pct=True).mul(8).round().add(2).clip(2,10)
g2=[(g.face.values,g.pts.values) for _,g in full.groupby(['game','qtr'])]
for live_mult in (0.5,0.75,1.0):
  for n in (2,3):
    s=[]
    for _ in range(40000):
        f,p=g2[rng.integers(len(g2))]; i=rng.choice(len(f),n,replace=False); s.append(f[i].sum()+live_mult*p[i].sum())
    s=np.array(s); print(f"live x{live_mult} {n} cards: median {np.median(s):.1f} in17-21 {((s>=17)&(s<=21)).mean():.3f} bust {(s>21).mean():.3f}")
