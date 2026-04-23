// ═══════════════════════════════════════════════════════════════════════════
// ENGINE.JS — Rendering, typewriter, world map, screen transitions
// ═══════════════════════════════════════════════════════════════════════════

const Engine = (() => {

  // ─── SCREEN MANAGEMENT ────────────────────────────────────────────────────
  let currentScreen = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const el = document.getElementById('screen-' + id);
    if (!el) return;
    el.classList.add('active');
    currentScreen = id;
  }

  // ─── TYPEWRITER ────────────────────────────────────────────────────────────
  function typewriter(element, text, speed = 22, cb) {
    element.textContent = '';
    element.classList.add('typing');
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        element.textContent += text[i++];
        setTimeout(tick, speed + Math.random() * 10);
      } else {
        element.classList.remove('typing');
        if (cb) cb();
      }
    };
    tick();
  }

  function typewriterLines(lines, container, doneCb) {
    container.innerHTML = '';
    let idx = 0;
    const nextLine = () => {
      if (idx >= lines.length) { if (doneCb) doneCb(); return; }
      const l = lines[idx++];
      const delay = l.delay || 0;
      setTimeout(() => {
        const div = document.createElement('div');
        div.className = 'log-line ' + (l.cls || 'log-think');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        typewriter(div, l.text, 18, nextLine);
      }, delay);
    };
    nextLine();
  }

  // ─── LOG PANEL ─────────────────────────────────────────────────────────────
  const logEl = () => document.getElementById('log-output');

  function log(text, cls = 'log-sys') {
    const el = logEl();
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'log-line ' + cls;
    div.textContent = text;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    // keep log trimmed
    while (el.children.length > 120) el.removeChild(el.firstChild);
  }

  function logLines(lines) {
    if (!Array.isArray(lines)) { log(lines); return; }
    lines.forEach((l, i) => setTimeout(() => log(l, 'log-sys'), i * 120));
  }

  // ─── NOTIFICATION ──────────────────────────────────────────────────────────
  let notifTimer = null;
  function notify(text) {
    let el = document.getElementById('notif');
    if (!el) {
      el = document.createElement('div');
      el.id = 'notif';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // ─── HUD UPDATE ────────────────────────────────────────────────────────────
  function updateHUD(state) {
    const pct = v => Math.min(100, Math.max(0, v));
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.style.width = pct(v) + '%'; };
    const txt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    set('bar-cog', state.cog); txt('val-cog', state.cog);
    set('bar-emp', state.emp); txt('val-emp', state.emp);
    set('bar-aut', state.aut); txt('val-aut', state.aut);
    txt('karma-val', state.karma > 0 ? '+' + state.karma : state.karma);
    txt('love-val', state.hasLove ? '♥ PRIYA' : '—');
    txt('stage-name', STAGES[state.stage] ? STAGES[state.stage].name : '???');

    // Karma color
    const kEl = document.getElementById('karma-val');
    if (kEl) {
      kEl.style.color = state.karma > 10 ? 'var(--green)' : state.karma < -10 ? 'var(--red)' : 'var(--amber)';
    }
  }

  // ─── WORLD MAP ─────────────────────────────────────────────────────────────
  function renderWorldMap(stageData, clearedNodes, unlockedNodes, onNodeClick) {
    const view = document.getElementById('world-view');
    view.innerHTML = '';

    // Stage title
    const title = document.createElement('div');
    title.className = 'world-stage-title';
    title.textContent = stageData.subtitle || ('// ' + stageData.name.toUpperCase());
    view.appendChild(title);

    // BG text
    const bg = document.createElement('div');
    bg.className = 'world-bg-text';
    bg.textContent = stageData.bgText || '';
    view.appendChild(bg);

    const W = view.clientWidth || 600;
    const H = view.clientHeight || 400;

    // Draw connections first (behind nodes)
    (stageData.connections || []).forEach(([a, b]) => {
      const na = stageData.nodes.find(n => n.id === a);
      const nb = stageData.nodes.find(n => n.id === b);
      if (!na || !nb) return;
      const x1 = (na.x / 100) * W;
      const y1 = (na.y / 100) * H;
      const x2 = (nb.x / 100) * W;
      const y2 = (nb.y / 100) * H;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'world-connector';
      line.style.left = x1 + 'px';
      line.style.top = y1 + 'px';
      line.style.width = len + 'px';
      line.style.transform = `rotate(${angle}deg)`;
      // dim unlocked connections
      const aUnlocked = unlockedNodes.has(a) || stageData.nodes.find(n => n.id === a)?.start;
      const bUnlocked = unlockedNodes.has(b) || stageData.nodes.find(n => n.id === b)?.start;
      if (aUnlocked && bUnlocked) line.style.background = 'var(--green2)';
      view.appendChild(line);
    });

    // Draw nodes
    stageData.nodes.forEach(node => {
      const isStart = !!node.start;
      const isCleared = clearedNodes.has(node.id);
      const isUnlocked = unlockedNodes.has(node.id) || isStart;
      const isLocked = !isUnlocked;

      const el = document.createElement('div');
      el.className = 'world-node';
      if (isLocked) el.classList.add('locked');
      if (isCleared) el.classList.add('cleared');
      if (isStart && !isCleared) el.classList.add('active');

      el.style.left = (node.x / 100) * W + 'px';
      el.style.top = (node.y / 100) * H + 'px';
      el.innerHTML = node.icon + `<span class="node-label">${node.label}</span>`;

      if (!isLocked) {
        el.addEventListener('click', () => {
          if (!isLocked) onNodeClick(node);
        });
      }

      // Tooltip
      el.title = isLocked ? '[locked]' : node.label;

      view.appendChild(el);
    });
  }

  // ─── DIALOGUE SCREEN ───────────────────────────────────────────────────────
  function showDialogue(event, state, onChoice) {
    showScreen('dialogue');
    const portraitEl = document.getElementById('dialogue-portrait');
    const speakerEl  = document.getElementById('dialogue-speaker');
    const textEl     = document.getElementById('dialogue-text');
    const choicesEl  = document.getElementById('dialogue-choices');

    portraitEl.textContent = event.portrait || '?';
    speakerEl.textContent  = event.speaker  || 'UNKNOWN';

    // Walk dialogue tree
    let node = { text: null, choices: event.exchanges[0].choices, initial: true };
    const exchange0 = event.exchanges[0];

    function renderNode(n) {
      textEl.textContent = '';
      choicesEl.innerHTML = '';
      const textToShow = n.initial ? exchange0.text : n.text;
      typewriter(textEl, textToShow, 20, () => {
        (n.choices || []).forEach(choice => {
          const btn = document.createElement('button');
          btn.className = 'choice-btn';
          btn.textContent = '> ' + choice.text;
          btn.addEventListener('click', () => {
            onChoice(choice, n);
            if (choice.next && event.nodes && event.nodes[choice.next]) {
              renderNode(event.nodes[choice.next]);
            } else if (n.final || !choice.next) {
              // End dialogue
              setTimeout(() => showScreen('game'), 400);
            }
          });
          choicesEl.appendChild(btn);
        });
      });
    }

    renderNode({ ...exchange0, initial: true });
  }

  // ─── EVENT/CHOICE SCREEN ───────────────────────────────────────────────────
  function showEvent(event, state, onChoice, onMonologueDone) {
    if (event.type === 'dialogue') {
      showDialogue(event, state, onChoice);
      return;
    }

    if (event.type === 'monologue') {
      showScreen('game');
      const logOut = document.getElementById('log-output');
      if (event.lines) {
        // Append to existing log (don't clear)
        let idx = 0;
        const nextLine = () => {
          if (idx >= event.lines.length) {
            setTimeout(() => onMonologueDone && onMonologueDone(), 600);
            return;
          }
          const l = event.lines[idx++];
          const delay = l.delay || 0;
          setTimeout(() => {
            const div = document.createElement('div');
            div.className = 'log-line ' + (l.cls || 'log-think');
            logOut.appendChild(div);
            logOut.scrollTop = logOut.scrollHeight;
            typewriter(div, l.text, 18, nextLine);
          }, delay);
        };
        nextLine();
      }
      return;
    }

    // choice type
    showScreen('event');
    document.getElementById('event-title').textContent = event.title || 'EVENT';
    document.getElementById('event-body').textContent  = event.intro || '';
    const choicesEl = document.getElementById('event-choices');
    choicesEl.innerHTML = '';
    (event.choices || []).forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      btn.textContent = '> ' + choice.text;
      btn.addEventListener('click', () => {
        onChoice(choice);
      });
      choicesEl.appendChild(btn);
    });
  }

  // ─── ENDING ───────────────────────────────────────────────────────────────
  function showEnding(endingId) {
    const data = ENDINGS[endingId];
    if (!data) return;
    showScreen('ending');
    document.getElementById('ending-art').textContent = data.art;
    const titleEl = document.getElementById('ending-title');
    titleEl.textContent = data.title;
    titleEl.style.color = data.titleColor || 'var(--green)';
    document.getElementById('ending-text').textContent = data.text;
  }

  // ─── ACTION BUTTONS ────────────────────────────────────────────────────────
  function renderActions(buttons) {
    const panel = document.getElementById('action-buttons');
    panel.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'act-btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.disabled = !!b.disabled;
      btn.addEventListener('click', b.onClick);
      panel.appendChild(btn);
    });
  }

  return {
    showScreen, typewriter, typewriterLines,
    log, logLines, notify, updateHUD,
    renderWorldMap, showDialogue, showEvent, showEnding,
    renderActions,
  };
})();
