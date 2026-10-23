// Anonymized roster — no real player or team names/logos
const ROSTER = {
  qb1:  { initials: 'M.J.', last: 'Jackson',  pos: 'QB',  team: 'RED', teamColor: '#B53A3A', proj: 22.4 },
  qb2:  { initials: 'D.H.', last: 'Holm',     pos: 'QB',  team: 'BLU', teamColor: '#2E5BBA', proj: 19.8 },
  rb1:  { initials: 'C.B.', last: 'Briggs',   pos: 'RB',  team: 'RED', teamColor: '#B53A3A', proj: 17.5 },
  rb2:  { initials: 'S.O.', last: 'Okonkwo',  pos: 'RB',  team: 'BLU', teamColor: '#2E5BBA', proj: 18.9 },
  wr1:  { initials: 'T.V.', last: 'Vance',    pos: 'WR',  team: 'RED', teamColor: '#B53A3A', proj: 14.2 },
  wr2:  { initials: 'A.K.', last: 'Kerr',     pos: 'WR',  team: 'BLU', teamColor: '#2E5BBA', proj: 15.6 },
  te1:  { initials: 'R.D.', last: 'Doyle',    pos: 'TE',  team: 'RED', teamColor: '#B53A3A', proj: 11.0 },
  te2:  { initials: 'J.P.', last: 'Park',     pos: 'TE',  team: 'BLU', teamColor: '#2E5BBA', proj: 9.8 },
  k1:   { initials: 'L.M.', last: 'Marin',    pos: 'K',   team: 'RED', teamColor: '#B53A3A', proj: 7.5 },
  k2:   { initials: 'F.A.', last: 'Aoki',     pos: 'K',   team: 'BLU', teamColor: '#2E5BBA', proj: 6.8 },
};

// Position color tokens (match styles.css)
const POS_COLOR = {
  QB: 'var(--pos-qb)',
  RB: 'var(--pos-rb)',
  WR: 'var(--pos-wr)',
  TE: 'var(--pos-te)',
  K:  'var(--pos-k)',
};

Object.assign(window, { ROSTER, POS_COLOR });
