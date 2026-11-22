// input.js — mouse (click + drag) and keyboard input. One job: turn
// pointer and key events into game intents for main.js. All legality
// checks live in state.js; input only reads the current selection and
// forwards it. Dragging a card to the board or a target does the same
// thing as clicking it and then clicking the target.
export function createInput(handlers) {
  const root = document.getElementById('table');

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (btn) {
      if (btn.id === 'btn-play') return handlers.onPlay();
      if (btn.id === 'btn-how') return handlers.onHelp(true);
      if (btn.id === 'btn-close-help') return handlers.onHelp(false);
      if (btn.id === 'btn-help') return handlers.onHelp(true);
      if (btn.id === 'btn-mute') return handlers.onMute();
      if (btn.id === 'btn-restart') return handlers.onRestart();
      if (btn.id === 'btn-end') return handlers.onEndTurn();
      if (btn.id === 'btn-again') return handlers.onRestart();
      if (btn.dataset.diff) return handlers.onDifficulty(btn.dataset.diff);
      return;
    }
    const lifeBox = event.target.closest('[data-life-side]');
    if (lifeBox) return handlers.onTargetFace(lifeBox.getAttribute('data-life-side'));
    const card = event.target.closest('.card[data-uid]');
    if (!card) { handlers.onEmptyClick(); return; }
    const side = card.getAttribute('data-side');
    const handIndex = card.getAttribute('data-hand');
    const boardIndex = card.getAttribute('data-board');
    if (handIndex !== '' && handIndex !== null) return handlers.onHandCard(Number(handIndex));
    if (boardIndex !== '' && boardIndex !== null && side) return handlers.onBoardCard(side, Number(boardIndex));
  });

  // ---- Drag: press a hand/board card, drag it to the board or a target ----
  let drag = null;
  let ghost = null;
  root.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('.card[data-uid]');
    if (!card || event.target.closest('button')) return;
    const handIndex = card.getAttribute('data-hand');
    const boardIndex = card.getAttribute('data-board');
    const side = card.getAttribute('data-side');
    if (handIndex !== '' && handIndex !== null) {
      drag = { type: 'hand', index: Number(handIndex), startX: event.clientX, startY: event.clientY, dragging: false, html: card.outerHTML };
    } else if (boardIndex !== '' && boardIndex !== null && side) {
      drag = { type: 'board', side, index: Number(boardIndex), startX: event.clientX, startY: event.clientY, dragging: false, html: card.outerHTML };
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (!drag) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) {
      drag.dragging = true;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = drag.html;
      document.body.appendChild(ghost);
    }
    if (drag.dragging && ghost) {
      ghost.style.left = `${event.clientX - 66}px`;
      ghost.style.top = `${event.clientY - 89}px`;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (!drag) return;
    const wasDragging = drag.dragging;
    const info = drag;
    drag = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (!wasDragging) return; // plain click: the click handler already ran
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el) return;
    const lifeBox = el.closest('[data-life-side]');
    if (lifeBox) return handlers.onDrop(info, { kind: 'face', side: lifeBox.getAttribute('data-life-side') });
    const card = el.closest('.card[data-uid]');
    if (card) {
      const side = card.getAttribute('data-side');
      const boardIndex = card.getAttribute('data-board');
      if (boardIndex !== '' && boardIndex !== null && side) {
        return handlers.onDrop(info, { kind: 'creature', side, index: Number(boardIndex) });
      }
      return; // dropped on a hand card: cancel
    }
    if (el.closest('.player-board')) return handlers.onDrop(info, { kind: 'board', side: 'player' });
    if (el.closest('.ai-board')) return handlers.onDrop(info, { kind: 'board', side: 'ai' });
  });

  // ---- Keyboard: arrows move the hand cursor, Enter/Space plays it,
  // E ends the turn, R restarts, M mutes, Esc closes help. ----
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key;
    if (key === 'ArrowLeft') { event.preventDefault(); return handlers.onCursorMove(-1); }
    if (key === 'ArrowRight') { event.preventDefault(); return handlers.onCursorMove(1); }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); return handlers.onCursorConfirm(); }
    if (key >= '1' && key <= '7') return handlers.onHandCard(Number(key) - 1);
    if (key === 'e' || key === 'E') return handlers.onEndTurn();
    if (key === 'm' || key === 'M') return handlers.onMute();
    if (key === 'Escape') return handlers.onHelp(false);
    if (key === 'r' || key === 'R') return handlers.onRestart();
  });
}
