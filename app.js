(() => {
  'use strict';

  const config = window.CODEX_ATLAS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const ui = {
    days: $('days'), hours: $('hours'), minutes: $('minutes'), seconds: $('seconds'),
    prophecy: $('prophecy'), glifo: $('glifo'),
    secret: $('secret'), progress: $('progress-fill'), percentage: $('percentage'),
    status: $('timer-status'), screenNotice: $('screen-notice'),
    dateForm: $('deadline-form'), dateInput: $('deadline-date'), timeInput: $('deadline-time'),
    dateError: $('deadline-error'), portalRestart: $('portal-new-countdown'),
    shareToggle: $('share-toggle'), sharePanel: $('share-panel'), shareUrl: $('share-url'),
    shareCopy: $('share-copy'), shareClose: $('share-close'), shareFeedback: $('share-feedback'),
    soundToggle: $('sound-toggle'), fullscreenToggle: $('fullscreen-toggle'),
    portal: $('portal'), endFlash: $('end-flash')
  };
  const audio = {
    tick: $('tick'), bell: $('bell'), heartbeat: $('heartbeat'),
    voice: $('voice'), nuke: $('nuke')
  };
  const prophecies = [
    { threshold: 3 * 86400, text: 'I cieli si oscurano...' },
    { threshold: 2 * 86400, text: 'La morte sopraggiunge dall’alto...' },
    { threshold: 86400, text: 'Cerca nelle sabbie...' },
    { threshold: 3600, text: 'Il portale si chiude...' },
    { threshold: 0, text: 'È il momento di scegliere.' }
  ];
  // I simboli sono quelli allegati dall'autore: calendario maya e Sole Nero.
  // Restano fissi, mentre luminosita e velocita variano con la fase del countdown.
  const secretCode = String(config.secretCode || 'TRUST-THOT');
  let startDate = new Date(config.startDate || '2026-02-12T16:00:00');
  let endDate = new Date(config.endDate || '2026-02-16T00:00:00');
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate <= startDate) {
    console.error('Codex Atlas: correggere le date in config.js.');
    startDate = new Date('2026-02-12T16:00:00');
    endDate = new Date('2026-02-16T00:00:00');
  }

  // Priorità scadenza: URL condiviso > data salvata nel browser > config.js.
  // I parametri end/start contengono istanti UTC ISO 8601: il conto e identico
  // anche per i giocatori che aprono il link da un fuso orario differente.
  const dateStorageKey = 'codex-atlas-deadline-v4'; // compatibile con le date già salvate
  const publicUrl = String(config.publicUrl || 'https://elmancino.github.io/CODEXATLAS/');
  function validDatePair(start, end) {
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
  }
  function readSharedDates() {
    const search = new URLSearchParams(window.location.search);
    const endISO = search.get('end');
    const startISO = search.get('start');
    // Accetta solo date complete in UTC, evitando interpretazioni dipendenti dal browser.
    const isoFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    if (!endISO || !startISO || !isoFormat.test(endISO) || !isoFormat.test(startISO)) return null;
    const start = new Date(startISO);
    const end = new Date(endISO);
    return validDatePair(start, end) ? { startDate: start, endDate: end } : null;
  }
  function saveDates() {
    try {
      window.localStorage.setItem(dateStorageKey, JSON.stringify({
        startDate: startDate.toISOString(), endDate: endDate.toISOString()
      }));
      return true;
    } catch (_) { return false; }
  }
  let hasCustomDeadline = false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(dateStorageKey) || 'null');
    if (stored && typeof stored === 'object') {
      const savedStart = new Date(stored.startDate);
      const savedEnd = new Date(stored.endDate);
      if (validDatePair(savedStart, savedEnd)) {
        startDate = savedStart;
        endDate = savedEnd;
        hasCustomDeadline = true;
      }
    }
  } catch (_) { /* Il browser potrebbe bloccare lo storage. */ }
  const linkedDates = readSharedDates();
  if (linkedDates) {
    startDate = linkedDates.startDate;
    endDate = linkedDates.endDate;
    hasCustomDeadline = true;
    saveDates(); // permette di ritrovare la scadenza anche dopo aver riaperto il sito
  }
  let initialExpired = Date.now() >= endDate.getTime();

  function buildShareUrl() {
    const url = new URL(publicUrl, window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('end', endDate.toISOString());
    url.searchParams.set('start', startDate.toISOString());
    return url.toString();
  }
  function refreshShareUrl() {
    ui.shareUrl.value = buildShareUrl();
    ui.shareToggle.hidden = !hasCustomDeadline;
    if (hasCustomDeadline && window.location.protocol === 'https:' &&
        new URL(publicUrl, window.location.href).origin === window.location.origin &&
        new URL(publicUrl, window.location.href).pathname === window.location.pathname) {
      // Sul sito pubblico la barra degli indirizzi diventa condivisibile senza ricaricare.
      window.history.replaceState(null, '', ui.shareUrl.value);
    }
  }
  function showSharePanel() {
    if (!hasCustomDeadline) return;
    refreshShareUrl();
    ui.shareFeedback.textContent = 'Copia il link e invialo ai giocatori: la scadenza sarà identica per tutti.';
    ui.sharePanel.hidden = false;
    ui.shareToggle.setAttribute('aria-expanded', 'true');
  }
  function hideSharePanel() {
    ui.sharePanel.hidden = true;
    ui.shareToggle.setAttribute('aria-expanded', 'false');
  }

  let entered = true; // countdown visibile e funzionante appena si apre la pagina
  let soundEnabled = false;
  let hasEnded = false;
  let manualProphecy = false;
  let bellPlayed = false;
  let heartbeatStarted = false;
  let crescendoPlayed = false;
  let lastDisplayed = -1;
  let lastTickSecond = -1;
  let lastSigil = -1;
  let lastSecret = '';
  let soundContext = null;
  const soundVolume = Math.max(0, Math.min(1, Number(config.soundVolume ?? 0.7)));
  Object.entries(audio).forEach(([name, el]) => {
    const volumes = { tick: .16, bell: .54, heartbeat: .8, voice: 1, nuke: .84 };
    el.volume = (volumes[name] || .7) * soundVolume;
  });

  function playSound(name, restart = false) {
    if (!soundEnabled) return;
    const el = audio[name];
    if (!el) return;
    if (restart) {
      try { el.currentTime = 0; } catch (_) { /* metadati non ancora caricati */ }
    }
    const promise = el.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }
  function pauseSound(name, rewind = false) {
    const el = audio[name];
    el.pause();
    if (rewind) {
      try { el.currentTime = 0; } catch (_) { /* browser in attesa di metadati */ }
    }
  }
  function updateSoundControl() {
    ui.soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    ui.soundToggle.setAttribute('aria-label', soundEnabled ? 'Disattiva audio' : 'Attiva audio');
    ui.soundToggle.title = soundEnabled ? 'Disattiva audio' : 'Attiva audio';
  }
  function prepareAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!soundContext) soundContext = new AudioContextClass();
    if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});
  }
  function crescendoSynthetic() {
    // Sostituisce il crescendo.mp3 assente nella repository originale.
    if (!soundEnabled || !soundContext) return;
    const context = soundContext;
    const start = context.currentTime;
    const duration = 4.9;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.09 * Math.max(.01, soundVolume), start + 4.35);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, start);
    filter.frequency.exponentialRampToValueAtTime(2400, start + duration);
    filter.Q.value = 1.1;
    filter.connect(gain);
    gain.connect(context.destination);
    [83, 124.5, 166].forEach((base, i) => {
      const osc = context.createOscillator();
      osc.type = i === 1 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * (i === 1 ? 2 : 1.65), start + duration);
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + duration);
      osc.onended = () => osc.disconnect();
    });
    window.setTimeout(() => { try { filter.disconnect(); gain.disconnect(); } catch (_) {} }, 5500);
  }

  function updateNumber(el, number, pad = true) {
    const value = pad ? String(number).padStart(2, '0') : String(number);
    if (el.textContent === value) return;
    el.textContent = value;
    el.classList.remove('changed');
    void el.offsetWidth;
    el.classList.add('changed');
  }
  function updateProphecy(remaining) {
    if (manualProphecy) return;
    const current = prophecies.find(item => remaining <= item.threshold);
    if (!current) return;
    const quote = `«${current.text}»`;
    if (ui.prophecy.textContent !== quote) setProphecy(quote);
  }
  function setProphecy(quote) {
    ui.prophecy.textContent = quote;
    ui.prophecy.classList.remove('swap');
    void ui.prophecy.offsetWidth;
    ui.prophecy.classList.add('swap');
  }
  function updateSigil(remaining) {
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    const remainingDays = Math.floor(remaining / 86400);
    const daysPassed = Math.max(0, totalDays - remainingDays);
    const phase = Math.min(5, Math.floor(daysPassed * 6 / totalDays));
    if (lastSigil === phase) return;
    lastSigil = phase;
    ui.glifo.dataset.phase = String(phase);
    document.getElementById('prophecy-area').dataset.phase = String(phase);
  }
  function updateSecret(seconds) {
    // Un carattere al secondo, come nell'enigma originale TRUST-THOT.
    const next = secretCode[seconds % secretCode.length];
    if (next === lastSecret) return;
    lastSecret = next;
    ui.secret.textContent = next;
    ui.secret.classList.remove('switch');
    void ui.secret.offsetWidth;
    ui.secret.classList.add('switch');
  }
  function finishCountdown() {
    if (hasEnded) return;
    hasEnded = true;
    document.body.classList.remove('near-end');
    document.body.classList.add('at-end');
    ui.status.textContent = 'CICLO COMPLETATO';
    pauseSound('tick', true);
    pauseSound('heartbeat', true);
    pauseSound('bell', true);
    ui.endFlash.classList.add('burst');
    ui.portal.classList.add('open');
    ui.portal.setAttribute('aria-hidden', 'false');
    ui.portalRestart.disabled = false;
    startPortalParticles();
    playSound('voice', true);
  }
  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 1000));
    if (remaining === lastDisplayed && (remaining > 0 || !entered)) return;
    lastDisplayed = remaining;
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    updateNumber(ui.days, days);
    updateNumber(ui.hours, hours);
    updateNumber(ui.minutes, minutes);
    updateNumber(ui.seconds, seconds);
    updateProphecy(remaining);
    updateSigil(remaining);
    updateSecret(seconds);
    const duration = Math.max(1, endDate - startDate);
    const percent = Math.max(0, Math.min(100, 100 * (Date.now() - startDate) / duration));
    ui.progress.style.width = `${percent}%`;
    ui.percentage.textContent = `${percent.toFixed(1).padStart(5, '0')}% / CICLO`;
    document.body.classList.toggle('near-end', entered && remaining > 0 && remaining <= 30);
    ui.status.textContent = remaining > 0 ? (remaining <= 30 ? 'ANOMALIA CRITICA' : 'SEGNALE AGGANCIATO') : 'CICLO COMPLETATO';

    if (!entered) return;
    if (remaining <= 0) {
      if (!initialExpired) finishCountdown();
      return;
    }
    if (soundEnabled && remaining !== lastTickSecond) {
      playSound('tick', true);
      lastTickSecond = remaining;
    }
    if (remaining <= 60 && !bellPlayed && soundEnabled) {
      bellPlayed = true;
      playSound('bell', true);
      window.setTimeout(() => pauseSound('bell', true), 3000);
    }
    if (remaining <= 30 && !heartbeatStarted) {
      heartbeatStarted = true;
      playSound('heartbeat', true);
    }
    if (remaining <= 5 && !crescendoPlayed && soundEnabled) {
      crescendoPlayed = true;
      crescendoSynthetic();
    }
  }

  // Inizializza i campi con domani alle 12:12, evitando date gia trascorse.
  function formatLocalDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function showDateForm() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    ui.dateInput.min = formatLocalDate(now);
    if (!ui.dateInput.value || ui.dateInput.value < ui.dateInput.min) {
      ui.dateInput.value = formatLocalDate(tomorrow);
    }
    if (!ui.timeInput.value) ui.timeInput.value = '12:12';
    ui.dateError.hidden = true;
    hideSharePanel();
    ui.shareToggle.hidden = true;
    ui.dateForm.hidden = false;
    document.body.classList.add('expired-awaiting-date');
  }
  function resetForNewCountdown() {
    hasEnded = false;
    initialExpired = false;
    manualProphecy = false;
    bellPlayed = false;
    heartbeatStarted = false;
    crescendoPlayed = false;
    lastTickSecond = -1;
    lastDisplayed = -1;
    lastSigil = -1;
    lastSecret = '';
    portalAnimationStarted = false;
    portalStars = [];
    document.body.classList.remove('at-end', 'near-end', 'expired-awaiting-date');
    ui.portal.classList.remove('open');
    ui.portal.setAttribute('aria-hidden', 'true');
    ui.endFlash.classList.remove('burst');
    ui.dateForm.hidden = true;
    Object.keys(audio).forEach(name => pauseSound(name, true));
    updateCountdown();
  }
  ui.dateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    ui.dateError.hidden = true;
    const dateText = ui.dateInput.value;
    const timeText = ui.timeInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) {
      ui.dateError.textContent = 'Inserisci una data e un orario validi.';
      ui.dateError.hidden = false;
      return;
    }
    const nextDate = new Date(`${dateText}T${timeText}:00`);
    if (!Number.isFinite(nextDate.getTime()) || formatLocalDate(nextDate) !== dateText ||
        String(nextDate.getHours()).padStart(2, '0') + ':' + String(nextDate.getMinutes()).padStart(2, '0') !== timeText ||
        nextDate.getTime() <= Date.now()) {
      ui.dateError.textContent = 'Scegli una data e un orario futuri.';
      ui.dateError.hidden = false;
      return;
    }
    startDate = new Date();
    endDate = nextDate;
    hasCustomDeadline = true;
    const persisted = saveDates();
    resetForNewCountdown();
    showSharePanel();
    if (!persisted) showNotice('Il countdown è attivo: conserva il link per ritrovare la scadenza.');
  });

  ui.shareToggle.addEventListener('click', () => {
    if (ui.sharePanel.hidden) showSharePanel();
    else hideSharePanel();
  });
  ui.shareClose.addEventListener('click', hideSharePanel);
  ui.shareUrl.addEventListener('focus', () => ui.shareUrl.select());
  ui.shareCopy.addEventListener('click', async () => {
    const link = buildShareUrl();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (_) { /* Fallback per browser senza permesso clipboard */ }
    if (!copied) {
      ui.shareUrl.focus();
      ui.shareUrl.select();
      try { copied = document.execCommand('copy'); } catch (_) { /* Copia manuale */ }
    }
    ui.shareFeedback.textContent = copied
      ? 'Link copiato! Puoi incollarlo su WhatsApp o inviarlo ai giocatori.'
      : 'Seleziona il link qui sopra e copialo manualmente.';
    if (copied) showNotice('Link del countdown copiato negli appunti.');
  });
  ui.portalRestart.addEventListener('click', () => {
    ui.portal.classList.remove('open');
    ui.portal.setAttribute('aria-hidden', 'true');
    ui.endFlash.classList.remove('burst');
    document.body.classList.remove('at-end');
    Object.keys(audio).forEach(name => pauseSound(name, true));
    initialExpired = true;
    showDateForm();
  });

  ui.soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateSoundControl();
    if (soundEnabled) {
      prepareAudioContext();
      lastTickSecond = -1;
      playSound('tick', true); // sblocca l'audio subito con il gesto dell'utente
      // Se si riattiva l'audio negli ultimi 30 secondi, riprende il battito.
      if (heartbeatStarted && !hasEnded) playSound('heartbeat');
    } else {
      Object.keys(audio).forEach(name => pauseSound(name));
      if (soundContext && soundContext.state === 'running') soundContext.suspend().catch(() => {});
    }
  });
  // Fullscreen API richiede un'azione esplicita dell'utente in tutti i principali browser.
  // L'interfaccia occupa gia il viewport; per nascondere le barre del browser serve questo pulsante
  // o l'installazione come app dalla schermata Home (manifest: display fullscreen).
  let noticeTimer = null;
  function showNotice(message, persistent = false) {
    if (noticeTimer) clearTimeout(noticeTimer);
    ui.screenNotice.textContent = message;
    ui.screenNotice.hidden = false;
    if (!persistent) noticeTimer = setTimeout(() => { ui.screenNotice.hidden = true; }, 5700);
  }
  ui.fullscreenToggle.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        showNotice('Per usare lo schermo intero su iPhone, aggiungi Codex Atlas alla schermata Home e aprilo da lì.');
      }
    } catch (_) {
      showNotice('Il browser limita lo schermo intero. Usa F11 su computer o aggiungi il sito alla schermata Home.');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    ui.fullscreenToggle.setAttribute('aria-label', active ? 'Esci dallo schermo intero' : 'Attiva lo schermo intero');
    ui.fullscreenToggle.title = active ? 'Esci dallo schermo intero' : 'Schermo intero';
  });
  ui.prophecy.addEventListener('click', () => {
    manualProphecy = true;
    const prophecy = prophecies[Math.floor(Math.random() * prophecies.length)];
    setProphecy(`«${prophecy.text}»`);
  });
  audio.voice.addEventListener('ended', () => {
    if (hasEnded && soundEnabled) playSound('nuke', true);
  });

  // Polvere, particelle e scie celesti. Riduce il lavoro su mobile e con movimento ridotto.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  let pointerX = 0, pointerY = 0;
  let dust = [];
  const canvas = $('particles');
  const ctx = canvas.getContext('2d');
  const portalCanvas = $('portal-particles');
  const portalCtx = portalCanvas.getContext('2d');
  const dpr = Math.min(1.7, window.devicePixelRatio || 1);
  function sizeCanvas(c, context) {
    c.width = Math.floor(viewportWidth * dpr);
    c.height = Math.floor(viewportHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rebuildDust() {
    dust = Array.from({length: Math.min(90, Math.ceil(viewportWidth / 19))}, () => ({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      r: .45 + Math.random() * 1.3,
      speed: .06 + Math.random() * .2,
      a: .12 + Math.random() * .45,
      phase: Math.random() * Math.PI * 2
    }));
  }
  function handleResize() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    if (ctx) sizeCanvas(canvas, ctx);
    if (portalCtx) sizeCanvas(portalCanvas, portalCtx);
    rebuildDust();
  }
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX / viewportWidth - .5;
    pointerY = event.clientY / viewportHeight - .5;
  }, { passive: true });
  function drawDust(frame) {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    dust.forEach(p => {
      if (!reduceMotion) {
        p.y -= p.speed;
        if (p.y < -4) { p.y = viewportHeight + 4; p.x = Math.random() * viewportWidth; }
      }
      const shimmer = reduceMotion ? .65 : .6 + .4 * Math.sin(frame * .012 + p.phase);
      ctx.beginPath();
      ctx.fillStyle = `rgba(232,194,131,${p.a * shimmer})`;
      ctx.arc(p.x + pointerX * 13, p.y + pointerY * 8, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  let portalStars = [];
  let portalAnimationStarted = false;
  function startPortalParticles() {
    if (!portalCtx || portalAnimationStarted) return;
    portalAnimationStarted = true;
    portalStars = Array.from({length: 85}, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * 180,
      speed: 1.2 + Math.random() * 4,
      length: 1 + Math.random() * 12
    }));
  }
  function drawPortalParticles() {
    if (!portalCtx) return;
    portalCtx.clearRect(0, 0, viewportWidth, viewportHeight);
    const cx = viewportWidth / 2, cy = viewportHeight / 2;
    portalStars.forEach(star => {
      if (!reduceMotion) star.distance += star.speed;
      if (star.distance > Math.max(viewportWidth, viewportHeight) * .7) star.distance = 5;
      const x = cx + Math.cos(star.angle) * star.distance;
      const y = cy + Math.sin(star.angle) * star.distance;
      portalCtx.beginPath();
      portalCtx.moveTo(x, y);
      portalCtx.lineTo(x - Math.cos(star.angle) * star.length, y - Math.sin(star.angle) * star.length);
      portalCtx.strokeStyle = `rgba(249,205,128,${Math.min(.65, .06 + star.distance / 1100)})`;
      portalCtx.lineWidth = 1;
      portalCtx.stroke();
    });
  }
  let frameNumber = 0;
  function animate() {
    frameNumber++;
    if (!reduceMotion || frameNumber === 1) {
      drawDust(frameNumber);
      if (portalAnimationStarted) drawPortalParticles();
    }
    if (!reduceMotion) window.requestAnimationFrame(animate);
  }
  handleResize();
  animate();
  updateSoundControl();
  if (hasCustomDeadline && !initialExpired) refreshShareUrl();
  if (initialExpired) showDateForm();
  updateCountdown();
  window.setInterval(updateCountdown, 175);
})();
