// render.js — DOM rendering. One job: turn state into the visible table.
// Full re-render on every change (the game is small; this keeps every
// screen — title, table, win, loss — always consistent with the real state).
import { defById, elementMark } from './cards.js';
import { guardIndexes, finalScore, mvpCard } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

let particleTimer = null;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

export function cardFaceHTML(card, opts = {}) {
  const cls = [
    'card', `el-${card.element}`,
    card.kind === 'spell' ? 'is-spell' : 'is-creature',
    opts.small ? 'small' : '',
    opts.selected ? 'selected' : '',
    opts.cursor ? 'cursor' : '',
    opts.playable ? 'playable' : '',
    opts.canAttack ? 'can-attack' : '',
    opts.sick ? 'sick' : '',
    opts.faceDown ? 'back' : '',
  ].join(' ');
  if (opts.faceDown) return `<div class="${cls}" data-uid="${card.uid ?? ''}"><div class="card-back-mark">☾</div></div>`;
  const def = defById(card.defId) || card;
  const art = def.art || elementMark(card.element);
  const stats = card.kind === 'creature'
    ? `<div class="card-stats"><span class="atk">⚔ ${card.atk}</span><span class="hp">♥ ${card.hp}</span></div>`
    : `<div class="card-stats"><span class="spell-tag">SPELL</span></div>`;
  const keyword = card.keyword ? `<div class="card-keyword">${esc(card.keyword)}</div>` : '';
  return `<div class="${cls}" data-uid="${card.uid ?? ''}" data-hand="${opts.handIndex ?? ''}" data-board="${opts.boardIndex ?? ''}" data-side="${opts.side ?? ''}">
    <div class="card-cost">${card.cost}</div>
    <div class="card-mark">${elementMark(card.element)}</div>
    <div class="card-name">${esc(card.name)}</div>
    <div class="card-art">${art}</div>
    ${keyword}
    <div class="card-text">${esc(card.text || (card.kind === 'creature' ? 'Creature' : 'Spell'))}</div>
    ${stats}
  </div>`;
}

function lifeHTML(side, label, life, maxLife, active) {
  const pct = Math.max(0, Math.round((life / maxLife) * 100));
  return `<div class="life-box ${side}${active ? ' active' : ''}" data-life-side="${side}">
    <div class="life-label">${label}</div>
    <div class="life-num">${life}</div>
    <div class="life-bar"><div class="life-fill" style="width:${pct}%"></div></div>
    <div class="life-sub">${life} / ${maxLife} life</div>
  </div>`;
}

function pileHTML(kind, count, topDefId) {
  const top = topDefId ? defById(topDefId) : null;
  const inner = kind === 'deck'
    ? '<div class="pile-card back"><div class="card-back-mark">☀</div></div><div class="pile-card back offset"><div class="card-back-mark">☾</div></div>'
    : (top ? `<div class="pile-card mini-face el-${top.element}">${top.art || ''}<div class="pile-name">${esc(top.name)}</div></div>` : '<div class="pile-card empty">—</div>');
  return `<div class="pile"><div class="pile-stack">${inner}</div><div class="pile-label">${kind === 'deck' ? 'DECK' : 'DISCARD'} · ${count}</div></div>`;
}

function manaHTML(mana, maxMana) {
  let crystals = '';
  for (let i = 0; i < 10; i++) {
    const state = i < mana ? 'full' : i < maxMana ? 'empty' : 'locked';
    crystals += `<span class="crystal ${state}">◆</span>`;
  }
  return `<div class="mana-box"><span class="mana-num">${mana}/${maxMana}</span><span class="crystals">${crystals}</span><span class="mana-label">MANA</span></div>`;
}

function boardHTML(state, side, ui) {
  const s = side === 'player' ? state.player : state.ai;
  const guards = guardIndexes(state, side);
  const cards = s.board.map((c, i) => cardFaceHTML(c, {
    small: true, side, boardIndex: i,
    selected: ui.selected && ui.selected.type === 'board' && ui.selected.side === side && ui.selected.index === i,
    canAttack: side === 'player' && c.canAttack && state.turn === 'player' && state.phase === 'play',
    sick: !c.canAttack,
  })).join('');
  const guardNote = guards.length ? `<div class="guard-note">🛡 GUARD — attack it first</div>` : '';
  return `<div class="board ${side}-board">${cards || '<div class="board-empty">No creatures yet</div>'}${guardNote}</div>`;
}

export function render(state, ui) {
  const root = document.getElementById('table');
  const player = state.player, ai = state.ai;
  const foeBacks = ai.hand.map((c) => cardFaceHTML(c, { small: true, faceDown: true })).join('');
  const handCards = player.hand.map((c, i) => cardFaceHTML(c, {
    side: 'player', handIndex: i,
    cursor: ui.cursor === i && ui.screen === SCREEN_PLAY && !ui.helpOpen,
    selected: ui.selected && ui.selected.type === 'hand' && ui.selected.index === i,
    playable: state.turn === 'player' && state.phase === 'play' && c.cost <= player.mana
      && !(c.kind === 'creature' && player.board.length >= 7),
  })).join('');
  const logLines = state.log.slice(-4).map((l) => `<div class="log-line">${esc(l)}</div>`).join('');
  const banner = state.phase === 'over'
    ? (state.winner === 'player' ? '🏆 VICTORY!' : '🌙 DEFEAT')
    : state.turn === 'player' ? '☀️ YOUR TURN — play cards, attack, then End Turn'
    : '🌙 Luna is thinking…';
  const turnClass = state.phase === 'over' ? 'over' : state.turn;

  const aiTopDiscard = ai.discard.length ? ai.discard[ai.discard.length - 1] : null;
  const plTopDiscard = player.discard.length ? player.discard[player.discard.length - 1] : null;
  root.innerHTML = `
  <canvas id="fx"></canvas>
  <div class="topbar">
    <div class="brand">ECLIPSE <span>· Duel of Sun and Moon</span></div>
    <div class="top-actions">
      <button id="btn-help" class="mini-btn">? How to play</button>
      <button id="btn-mute" class="mini-btn">${ui.muted ? '🔇 Muted' : '🔊 Sound'}</button>
      <button id="btn-restart" class="mini-btn">↻ Restart</button>
    </div>
  </div>
  <div class="foe-zone">
    ${lifeHTML('ai', '🌙 LUNA · AI', ai.life, ai.maxLife, state.turn === 'ai' && state.phase === 'play')}
    <div class="foe-hand">
      <div class="hand-count">Luna hand · ${ai.hand.length} cards</div>
      <div class="backs">${foeBacks}</div>
    </div>
    <div class="piles">${pileHTML('deck', ai.deck.length)}${pileHTML('discard', ai.discard.length, aiTopDiscard)}</div>
  </div>
  ${boardHTML(state, 'ai', ui)}
  <div class="midbar ${turnClass}">
    <div class="banner">${esc(banner)}</div>
    <div class="turn-info">Turn ${state.turnNumber} · ${state.turn === 'player' ? 'Sol' : 'Luna'} to act</div>
  </div>
  ${boardHTML(state, 'player', ui)}
  <div class="player-zone">
    ${lifeHTML('player', '☀️ SOL · YOU', player.life, player.maxLife, state.turn === 'player' && state.phase === 'play')}
    <div class="hand-zone">
      ${manaHTML(player.mana, player.maxMana)}
      <div class="hand${player.hand.length > 5 ? ' many' : ''}">${handCards}</div>
      <div class="deck-info">Fatigue ${player.fatigue} · Hand ${player.hand.length}/10</div>
    </div>
    <div class="piles">${pileHTML('deck', player.deck.length)}${pileHTML('discard', player.discard.length, plTopDiscard)}</div>
    <button id="btn-end" class="end-btn" ${state.turn === 'player' && state.phase === 'play' ? '' : 'disabled'}>END TURN ⏎</button>
  </div>
  <div class="log">${logLines}</div>
  <div class="keys-hint">← → select · Enter play · E end turn · R restart · M mute · Esc help</div>
  <div id="floaters"></div>
  ${ui.screen === SCREEN_TITLE ? titleHTML(ui) : ''}
  ${ui.helpOpen ? helpHTML() : ''}
  ${ui.screen === SCREEN_OVER ? endHTML(state) : ''}
  <div id="test-result" style="display:none">${esc(ui.testResult || '')}</div>`;
  if (!ui.shotMode) startParticles();
}

function titleHTML(ui) {
  const sampleIds = ['dawn-drake', 'solar-knight', 'eclipse-wyrm', 'lunar-golem', 'eclipse'];
  const fan = sampleIds.map((id, i) => {
    const def = defById(id);
    const card = { uid: `sample-${i}`, ...def };
    return `<div class="fan-card" style="--rot:${(i - 2) * 9}deg;--dy:${Math.abs(i - 2) * 10}px">${cardFaceHTML(card)}</div>`;
  }).join('');
  return `<div class="overlay title-screen">
    <div class="title-word">ECLIPSE</div>
    <div class="title-sub">DUEL OF SUN AND MOON</div>
    <div class="title-tag">Outplay the Moon. Guard your Sun. 30 life. 10 mana. One winner.</div>
    <div class="fan">${fan}</div>
    <div class="rules-3">
      <div><b>1 ·</b> Spend mana, play cards, attack — reduce Luna from 30 life to 0.</div>
      <div><b>2 ·</b> 🛡 Guard must be attacked first · ⚡ Rush strikes at once.</div>
      <div><b>3 ·</b> Empty deck reshuffles the discard; then fatigue bites (1, 2, 3…).</div>
    </div>
    <div class="difficulty">
      <span class="diff-label">LUNA'S STRENGTH</span>
      <button class="diff-btn${ui.difficulty === 'easy' ? ' active' : ''}" data-diff="easy">EASY</button>
      <button class="diff-btn${ui.difficulty === 'normal' ? ' active' : ''}" data-diff="normal">NORMAL</button>
      <button class="diff-btn${ui.difficulty === 'hard' ? ' active' : ''}" data-diff="hard">HARD</button>
    </div>
    <div class="title-actions">
      <button id="btn-play" class="big-btn">▶ PLAY</button>
      <button id="btn-how" class="big-btn ghost">HOW TO PLAY</button>
    </div>
    <div class="title-foot">☀️ sun meets moon · 🛡 Guard blocks · ⚡ Rush strikes at once · Click a card, then a target</div>
  </div>`;
}

function helpHTML() {
  return `<div class="overlay help-screen"><div class="panel">
    <h2>How to play</h2>
    <p><b>Goal:</b> reduce the Luna AI from 30 life to 0 before it does the same to you.</p>
    <p><b>Each turn:</b> gain +1 mana (max 10), draw a card, play cards, attack, then End Turn.</p>
    <p><b>Play a card:</b> click it in your hand, then click its target (a creature or the enemy life total). Spells need a target; creatures go straight to your board.</p>
    <p><b>Attack:</b> click one of your creatures that can attack, then click an enemy creature or the Luna life total. A creature attacks once per turn and cannot attack the turn it is played — unless it has <b>Rush</b>.</p>
    <p><b>Guard:</b> a Guard creature must be attacked before anything else on its side.</p>
    <p><b>Keywords:</b> ☀️ sun / 🌙 moon are told apart by colour AND shape. Moon Pup draws a card when played. Dawn Acolyte heals 2 when played. Moonbeam deals 2 and draws a card.</p>
    <p><b>Fatigue:</b> when your deck runs out, the discard pile is reshuffled in. If that is empty too, you take growing fatigue damage (1, then 2, then 3…).</p>
    <p><b>Keys:</b> 1–7 play a hand card · Space/Enter End Turn · M mute · Esc close · R restart.</p>
    <button id="btn-close-help" class="big-btn">GOT IT</button>
  </div></div>`;
}

function endHTML(state) {
  const win = state.winner === 'player';
  const s = state.stats;
  const deckLeft = state.player.deck.length + state.ai.deck.length;
  const mvp = mvpCard(state);
  const score = finalScore(state);
  return `<div class="overlay end-screen ${win ? 'win' : 'loss'}">
    <div class="end-word">${win ? '🏆 VICTORY!' : '🌙 DEFEAT'}</div>
    <div class="end-sub">${win ? 'The Moon sets. The Sun endures.' : 'The Sun sets… the Moon claims the table.'}</div>
    <div class="stats-grid">
      <div class="stat"><div class="stat-num">${s.turns}</div><div class="stat-label">Turns</div></div>
      <div class="stat"><div class="stat-num">${s.damageDealt}</div><div class="stat-label">Damage dealt</div></div>
      <div class="stat"><div class="stat-num">${s.cardsPlayed}</div><div class="stat-label">Cards played</div></div>
      <div class="stat"><div class="stat-num">${deckLeft}</div><div class="stat-label">Cards left in decks</div></div>
      <div class="stat"><div class="stat-num">${state.player.life}–${state.ai.life}</div><div class="stat-label">Final life (you–Luna)</div></div>
      <div class="stat"><div class="stat-num">${score}</div><div class="stat-label">Final score</div></div>
    </div>
    ${mvp ? `<div class="mvp">⭐ MVP — ${esc(mvp.name)} · ${mvp.damage} damage dealt</div>` : ''}
    <button id="btn-again" class="big-btn">${win ? '▶ PLAY AGAIN' : '↻ TRY AGAIN'}</button>
    <div class="end-hint">Press R to restart</div>
  </div>`;
}

export function addFloater(text, side, kind) {
  const layer = document.getElementById('floaters');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `floater ${kind || ''}`;
  el.textContent = text;
  const box = document.querySelector(`[data-life-side="${side}"]`);
  if (box) {
    const r = box.getBoundingClientRect();
    const t = document.getElementById('table').getBoundingClientRect();
    el.style.left = `${r.left - t.left + r.width / 2}px`;
    el.style.top = `${r.top - t.top}px`;
  } else {
    el.style.left = '640px'; el.style.top = '300px';
  }
  layer.appendChild(el);
  window.setTimeout(() => el.remove(), 1400);
}

export function shake() {
  const root = document.getElementById('table');
  if (!root) return;
  root.classList.remove('shake');
  void root.offsetWidth;
  root.classList.add('shake');
  window.setTimeout(() => root.classList.remove('shake'), 400);
}

function startParticles() {
  // Re-bind on every render: render() rebuilds the canvas element.
  if (particleTimer) { window.clearInterval(particleTimer); particleTimer = null; }
  const canvas = document.getElementById('fx');
  if (!canvas) return;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return;
  canvas.width = 1280; canvas.height = 720;
  const parts = Array.from({ length: 40 }, () => ({
    x: Math.random() * 1280, y: Math.random() * 720,
    r: 1 + Math.random() * 2.5, vy: -(0.3 + Math.random() * 0.8),
    vx: (Math.random() - 0.5) * 0.3, fire: Math.random() < 0.6, a: 0.3 + Math.random() * 0.5,
  }));
  particleTimer = window.setInterval(() => {
    const c = document.getElementById('fx');
    if (!c) { window.clearInterval(particleTimer); particleTimer = null; return; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, 1280, 720);
    for (const p of parts) {
      p.y += p.vy; p.x += p.vx;
      if (p.y < -5) { p.y = 725; p.x = Math.random() * 1280; }
      g.globalAlpha = p.a;
      g.fillStyle = p.fire ? '#ff7a2f' : '#7dd7ff';
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }, 50);
}
