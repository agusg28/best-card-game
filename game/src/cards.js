// cards.js — every card definition in ECLIPSE. One job: the card pool.
// Shared by both sides: 33-card deck, 3 copies of each of these 11 types.
// Element is told by colour AND shape: sun = gold + sun-disc mark,
// moon = violet + crescent mark. Each card also carries its own unique
// procedural SVG illustration in `art` — no two cards share a motif.
export const CARD_DEFS = [
  { id: 'sun-sprite',   name: 'Sun Sprite',   cost: 1, atk: 2, hp: 1, kind: 'creature', element: 'sun',  keyword: '',     text: '' , art: `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="14" fill="#fbbf24"/><g stroke="#f59e0b" stroke-width="3" stroke-linecap="round"><line x1="32" y1="8" x2="32" y2="16"/><line x1="32" y1="52" x2="32" y2="60"/><line x1="8" y1="34" x2="16" y2="34"/><line x1="48" y1="34" x2="56" y2="34"/><line x1="15" y1="17" x2="21" y2="23"/><line x1="43" y1="45" x2="49" y2="51"/><line x1="49" y1="17" x2="43" y2="23"/><line x1="21" y1="45" x2="15" y2="51"/></g><circle cx="27" cy="32" r="2" fill="#451a03"/><circle cx="37" cy="32" r="2" fill="#451a03"/><path d="M26 38 Q32 43 38 38" stroke="#451a03" stroke-width="2" fill="none" stroke-linecap="round"/></svg>` },
  { id: 'moon-pup',     name: 'Moon Pup',     cost: 1, atk: 1, hp: 2, kind: 'creature', element: 'moon', keyword: '',     text: 'Draw a card.' , art: `<svg viewBox="0 0 64 64"><path d="M40 6 A26 26 0 1 0 40 58 A20 20 0 1 1 40 6 Z" fill="#c4b5fd"/><path d="M18 22 L14 8 L26 16 Z" fill="#8b5cf6"/><path d="M30 14 L32 2 L40 12 Z" fill="#8b5cf6"/><circle cx="34" cy="34" r="2.5" fill="#2e1065"/><circle cx="44" cy="40" r="2" fill="#2e1065"/></svg>` },
  { id: 'moon-wolf',    name: 'Moon Wolf',    cost: 2, atk: 3, hp: 2, kind: 'creature', element: 'moon', keyword: 'Rush', text: 'Rush' , art: `<svg viewBox="0 0 64 64"><path d="M14 18 L20 6 L30 16 L34 16 L44 6 L50 18 L54 40 L32 58 L10 40 Z" fill="#7c6bbf"/><path d="M20 12 L24 20 L18 22 Z" fill="#c4b5fd"/><path d="M44 12 L40 20 L46 22 Z" fill="#c4b5fd"/><circle cx="25" cy="32" r="2.5" fill="#fde68a"/><circle cx="39" cy="32" r="2.5" fill="#fde68a"/><path d="M28 44 L32 48 L36 44" stroke="#2e1065" stroke-width="2" fill="none"/></svg>` },
  { id: 'dawn-acolyte', name: 'Dawn Acolyte', cost: 2, atk: 2, hp: 3, kind: 'creature', element: 'sun',  keyword: '',     text: 'Heal 2.' , art: `<svg viewBox="0 0 64 64"><circle cx="32" cy="14" r="9" fill="#fde68a"/><circle cx="32" cy="14" r="13" fill="none" stroke="#fbbf24" stroke-width="2"/><path d="M32 26 L20 58 L44 58 Z" fill="#f59e0b"/><path d="M32 26 L26 44 L38 44 Z" fill="#fff7d6"/><circle cx="32" cy="36" r="3" fill="#b45309"/></svg>` },
  { id: 'sunburst',     name: 'Sunburst',     cost: 2, atk: 0, hp: 0, kind: 'spell',    element: 'sun',  keyword: '',     text: 'Deal 3 damage.' , art: `<svg viewBox="0 0 64 64"><g fill="#fbbf24"><path d="M32 4 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24 Z"/></g><circle cx="32" cy="32" r="8" fill="#fff7d6"/></svg>` },
  { id: 'moonbeam',     name: 'Moonbeam',     cost: 2, atk: 0, hp: 0, kind: 'spell',    element: 'moon', keyword: '',     text: 'Deal 2 damage. Draw a card.' , art: `<svg viewBox="0 0 64 64"><path d="M42 4 A28 28 0 1 0 42 60 A22 22 0 1 1 42 4 Z" fill="#a78bfa"/><g stroke="#e9d5ff" stroke-width="3" stroke-linecap="round"><line x1="34" y1="30" x2="18" y2="52"/><line x1="42" y1="28" x2="30" y2="54"/><line x1="50" y1="30" x2="42" y2="52"/></g></svg>` },
  { id: 'solar-knight', name: 'Solar Knight', cost: 3, atk: 3, hp: 4, kind: 'creature', element: 'sun',  keyword: 'Guard', text: 'Guard' , art: `<svg viewBox="0 0 64 64"><path d="M18 26 L18 14 Q18 6 32 6 Q46 6 46 14 L46 26 L50 30 L50 44 L14 44 L14 30 Z" fill="#f59e0b"/><path d="M32 6 L36 2 L38 10 Z" fill="#ef4444"/><rect x="22" y="28" width="20" height="4" fill="#451a03"/><circle cx="27" cy="36" r="2" fill="#451a03"/><circle cx="37" cy="36" r="2" fill="#451a03"/><path d="M14 44 L10 58 L54 58 L50 44 Z" fill="#b45309"/></svg>` },
  { id: 'lunar-golem',  name: 'Lunar Golem',  cost: 4, atk: 4, hp: 6, kind: 'creature', element: 'moon', keyword: 'Guard', text: 'Guard' , art: `<svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="14" rx="3" fill="#8b5cf6"/><rect x="14" y="24" width="36" height="16" rx="3" fill="#6d28d9"/><rect x="18" y="42" width="28" height="14" rx="3" fill="#5b21b6"/><circle cx="27" cy="15" r="2.5" fill="#e9d5ff"/><circle cx="37" cy="15" r="2.5" fill="#e9d5ff"/><circle cx="25" cy="32" r="2.5" fill="#a78bfa"/><circle cx="39" cy="32" r="2.5" fill="#a78bfa"/><path d="M26 48 L38 48" stroke="#e9d5ff" stroke-width="2"/></svg>` },
  { id: 'dawn-drake',   name: 'Dawn Drake',   cost: 5, atk: 6, hp: 5, kind: 'creature', element: 'sun',  keyword: 'Rush', text: 'Rush' , art: `<svg viewBox="0 0 64 64"><path d="M8 44 Q20 12 34 22 Q48 12 56 44 Q44 34 32 40 Q20 34 8 44 Z" fill="#f97316"/><path d="M32 40 L44 30 L52 34 L40 46 Z" fill="#fbbf24"/><circle cx="46" cy="28" r="6" fill="#f59e0b"/><circle cx="48" cy="27" r="1.5" fill="#451a03"/><path d="M32 40 Q32 54 24 58 L28 44 Z" fill="#ea580c"/></svg>` },
  { id: 'eclipse-wyrm', name: 'Eclipse Wyrm', cost: 6, atk: 7, hp: 7, kind: 'creature', element: 'moon', keyword: '',     text: '' , art: `<svg viewBox="0 0 64 64"><circle cx="32" cy="26" r="16" fill="#1e1b4b"/><circle cx="32" cy="26" r="16" fill="none" stroke="#fbbf24" stroke-width="3"/><circle cx="32" cy="26" r="10" fill="#0f0d2a"/><path d="M12 48 Q24 38 32 48 Q40 58 52 48" stroke="#a78bfa" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="14" cy="46" r="4" fill="#c4b5fd"/><circle cx="50" cy="46" r="4" fill="#c4b5fd"/></svg>` },
  { id: 'eclipse',      name: 'Eclipse',      cost: 5, atk: 0, hp: 0, kind: 'spell',    element: 'sun',  keyword: '',     text: 'Deal 5 damage.' , art: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="15" fill="#0f0d2a"/><circle cx="32" cy="32" r="19" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="4 3"/><g stroke="#f59e0b" stroke-width="2" stroke-linecap="round"><line x1="32" y1="4" x2="32" y2="10"/><line x1="32" y1="54" x2="32" y2="60"/><line x1="4" y1="32" x2="10" y2="32"/><line x1="54" y1="32" x2="60" y2="32"/></g></svg>` },
];

// The deck uses all 11 types listed in the design (8 creatures + 3 spells),
// 3 copies each = a 33-card deck.
export const DECK_POOL = CARD_DEFS.map((d) => d.id);

export function defById(id) {
  return CARD_DEFS.find((d) => d.id === id);
}

export function elementMark(element) {
  return element === 'sun' ? '☀️' : '🌙';
}

// Build a fresh 33-card deck (3 copies of each pool type) and shuffle it.
export function buildDeck(rng) {
  const deck = [];
  for (const id of DECK_POOL) {
    for (let i = 0; i < 3; i++) deck.push(id);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
