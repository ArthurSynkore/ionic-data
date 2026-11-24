(() => {
  // Lien de prise de rendez-vous (Calendly, Cal.com, etc.). Vide = les boutons mènent à la section finale.
  const BOOKING_URL = '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = matchMedia('(max-width: 900px)');
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);

  if (BOOKING_URL) $$('[data-book]').forEach(a => { a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; });

  /* ---------- thème (clair / sombre vert) ---------- */
  const THEMES = {
    light: { a: [18, 18, 15], b: [236, 234, 227], acc: '#FF4A1C', shield: '47,107,255' },
    green: { a: [221, 243, 228], b: [221, 243, 228], acc: '#2EF08A', shield: '120,205,255' },
  };
  let theme = 'light';
  const themeBtn = $('#theme-btn');
  function setTheme(name, save) {
    theme = THEMES[name] ? name : 'light';
    if (theme === 'light') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    themeBtn.setAttribute('aria-pressed', theme === 'green' ? 'true' : 'false');
    if (save) { try { localStorage.setItem('ionic-theme', theme); } catch (e) {} }
  }
  let saved = null; try { saved = localStorage.getItem('ionic-theme'); } catch (e) {}
  setTheme(params.get('theme') || saved || 'light', false);
  themeBtn.addEventListener('click', () => setTheme(theme === 'green' ? 'light' : 'green', true));

  /* ---------- titres : découpe mot par mot ---------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi';
            wi.style.setProperty('--i', i++); wi.textContent = tok;
            w.appendChild(wi); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
  });

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-split],[data-reveal]').forEach(el => io.observe(el));

  /* ---------- lecture au scroll : les mots s'allument à mesure qu'on avance ---------- */
  const readers = $$('[data-read]').map(el => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const words = [];
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'rw'; w.textContent = tok;
          words.push(w); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
    return { el, words, last: -1 };
  });
  readers.forEach(r => { r.pin = r.el.closest('[data-pin]'); });
  function updateReaders() {
    const vh = window.innerHeight;
    for (const r of readers) {
      const b = r.el.getBoundingClientRect();
      if (b.bottom < -200 || b.top > vh + 200) continue;
      let p = clamp((vh * 0.82 - b.top) / (vh * 0.5 + b.height * 0.6));
      // texte épinglé : la lecture suit la progression du blocage, et se termine avant qu'il ne se libère
      if (r.pin) { const s = r.pin.getBoundingClientRect(); p = clamp((vh * 0.25 - s.top) / (Math.max(1, s.height - vh) * 0.82 + vh * 0.25)); }
      if (reduced) p = 1;
      const v = Math.round(p * 400);
      if (v === r.last) continue;
      r.last = v;
      const n = r.words.length;
      r.words.forEach((w, i) => { w.style.opacity = (0.16 + 0.84 * clamp(p * (n + 2) - i)).toFixed(3); });
    }
  }

  /* ---------- chiffres qui comptent à l'apparition ---------- */
  const fmt = (v, dec) => v.toFixed(dec).replace('.', ',');
  const countIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
    if (reduced) return;
    const t1 = performance.now();
    const tick = now => {
      const p = clamp((now - t1) / 1400), q = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * q, dec) + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));
  /* ---------- sources (chips) ---------- */
  const chips = $$('.chip').map(el => ({ el, grow: 0, pulses: [], x: 0, y: 0, seed: Math.random(), P: new Float32Array(98) }));
  const srcCount = $('#src-count');
  chips.forEach(c => c.el.addEventListener('click', () => {
    c.el.setAttribute('aria-pressed', c.el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    const n = chips.filter(x => x.el.getAttribute('aria-pressed') === 'true').length;
    srcCount.textContent = `${n} source${n > 1 ? 's' : ''} sur ${chips.length}`;
  }));

  /* ---------- sept jours : chaque personne donne son mini-résumé ---------- */
  const mkAnchor = el => ({ el, grow: 0, pulses: [], x: 0, y: 0, seed: Math.random(), P: new Float32Array(98) });
  const people = $$('.person').map(el => ({ el, i: +el.dataset.i, left: !!el.closest('.cap-l'), text: $('.p-say b', el).textContent, anchor: Object.assign(mkAnchor($('.p-av', el)), { idx: +el.dataset.i }) }));
  const capQuote = $('#cap-quote');
  let spoke = -1, quoteBurst = null;
  function setSpeak(a) {
    if (a === spoke) return;
    const prev = spoke; spoke = a;
    people.forEach(p => { p.el.classList.toggle('talk', p.i === a); p.el.classList.toggle('done', p.i < a); });
    const cur = people.find(p => p.i === a);
    capQuote.textContent = cur ? (cur.i < 3 ? '« ' + cur.text + ' »' : '') : '';
    capQuote.classList.remove('swap'); void capQuote.offsetWidth; capQuote.classList.add('swap');
    if (a === prev + 1) { const d = people.find(p => p.i === prev); if (d) d.anchor.pulses.push(-0.6, -0.95); }
  }
  /* ---------- sections ---------- */
  const parse = s => s.split(',').map(Number);
  const sections = $$('main [data-orb]').map(el => ({
    el,
    d: parse(el.dataset.orb), m: parse(el.dataset.orbM || el.dataset.orb),
    charge: parse(el.dataset.charge || '0,0'),
    state: el.dataset.state || '', entry: el.dataset.entry || '',
    ring: 'ring' in el.dataset, pin: 'pin' in el.dataset,
    cta: el.dataset.mode === 'cta', id: el.id,
  }));
  const ENTRY = {};
  const capIdx = sections.findIndex(s => s.id === 'capture'), MIN_TALK = 1.9;
  let talkT = 0;
  people.forEach(p => p.el.classList.toggle('quick', p.i >= 3));
  const relEl = $('#release'), relStage = $('#rel-stage'), relPre = $('#rel-pre'), relPost = $('#rel-post');
  const wheel = $('#wheel'), wl = $$('#wheel li'); let wheelKey = -1;
  const shards = $$('.shard').map(el => ({ el, hx: 0, hy: 0, c: -1 }));
  const hudState = $('#hud-state'), hudPct = $('#hud-pct'), hudFill = $('#hud-fill'), hudEntry = $('#hud-entry');

  /* ---------- canvas ---------- */
  const cv = $('#orb'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, mobile = false;

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight; mobile = mqMobile.matches;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const sr = relStage.getBoundingClientRect();
    shards.forEach(s => {
      const prev = s.el.style.transform; s.el.style.transform = 'none';
      const r = s.el.getBoundingClientRect();
      s.hx = r.left + r.width / 2 - sr.left; s.hy = r.top + r.height / 2 - sr.top;
      s.el.style.transform = prev; s.c = -1;
    });
  }

  /* points de la sphère : coque (fibonacci) + cœur */
  const N = mqMobile.matches ? 760 : 1250, NS = Math.round(N * 0.7);
  const pts = [];
  for (let i = 0; i < N; i++) {
    let x, y, z, r = 1;
    if (i < NS) {
      y = 1 - 2 * (i + 0.5) / NS; const rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      x = Math.cos(th) * rad; z = Math.sin(th) * rad;
    } else {
      const u = Math.random() * 2 - 1, th = Math.random() * TAU, rad = Math.sqrt(1 - u * u);
      r = 0.18 + 0.7 * Math.cbrt(Math.random());
      x = Math.cos(th) * rad * r; y = u * r; z = Math.sin(th) * rad * r;
    }
    pts.push({ x, y, z, inner: i >= NS, n: Math.random(), ph: Math.random() * TAU, acc: Math.random() < 0.12, sp: 0.5 + Math.random() * 1.6, jx: Math.random() - 0.5, jy: Math.random() - 0.5, filled: false, flash: 0, sx: 0, sy: 0, nb: -1 });
  }
  // voisin le plus proche (coque) pour les liaisons "synapses"
  for (let i = 0; i < NS; i++) {
    let best = -1, bd = 9;
    for (let j = Math.max(0, i - 60); j < Math.min(NS, i + 60); j++) {
      if (j === i) continue;
      const a = pts[i], b = pts[j], d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
      if (d < bd && Math.random() < 0.8) { bd = d; best = j; }
    }
    pts[i].nb = best;
  }
  const links = [];

  /* bouclier : pavage hexagonal bombé (demi-sphère) */
  const cells = [];
  (() => {
    const s = 0.142, q3 = Math.sqrt(3);
    const warp = (u, v) => { const d = Math.hypot(u, v); if (d < 1e-6) return [0, 0]; const k = Math.sin(Math.min(d, 1) * Math.PI / 2) / d; return [u * k, v * k]; };
    for (let q = -9; q <= 9; q++) for (let r = -9; r <= 9; r++) {
      const cx = s * 1.5 * q, cy = s * q3 * (r + q / 2), d = Math.hypot(cx, cy);
      if (d > 1 + s * 0.45) continue;
      const v = [];
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; v.push(warp(cx + s * 0.93 * Math.cos(a), cy + s * 0.93 * Math.sin(a))); }
      const c = warp(cx, cy);
      cells.push({ v, c, d: Math.hypot(c[0], c[1]), order: (1 - c[1]) / 2 * 0.78 + Math.random() * 0.22, g: (c[0] * 0.5 - c[1] * 0.85 + 1) / 2 });
    }
  })();
  const impacts = [], strays = [];
  let shieldP = 0, nextStray = 0;

  /* entrées de données */
  const orbiters = [];                 // A — accrétion
  const glyphs = [];                   // C — fragments de texte
  const blips = [];                    // B — arrivée des impulsions sur l'anneau
  const FRAG = ['RE: devis n°2041', '14:30 point hebdo', 'relance client', 'CRM · étape 3', 'facture_0312.pdf', 'validation ?', 'réunion 45 min', 'ticket #882', 'v3_final.docx', '@compta', 'J+2', '3 relances', 'bon de commande', 'compte rendu', '09:12 → 11:47', 'devis signé'];
  let orbitA = 0, fiberA = 0;

  /* fibres : un groupe d'ancres par section */
  const edgePos = (c, i, cx) => { const r = c.el.getBoundingClientRect(); c.x = cx > r.left + r.width / 2 ? r.right + 6 : r.left - 10; c.y = r.top + r.height / 2; };
  const apps = $$('.app').map((el, i) => Object.assign(mkAnchor(el), { idx: i }));
  apps.forEach(c => c.el.addEventListener('click', () => c.el.setAttribute('aria-pressed', c.el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')));
  const appCount = $('#app-count'), connIdx = sections.findIndex(s => s.el.classList.contains('connexion'));
  let connT = 0, appN = -1, gatePrev = window.scrollY, noGateUntil = 0;
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => { noGateUntil = performance.now() + 4000; }));
  const capSide = left => ({ sec: $('#capture'), kind: 'wire', a: 0, items: people.filter(p => p.left === left).map(p => p.anchor), on: c => c.idx < spoke, pos: edgePos });
  const groups = [
    { sec: $('.connexion'), kind: 'radial', a: 0, items: apps, on: c => c.el.getAttribute('aria-pressed') === 'true' && connT > 0.5 + c.idx * 0.3,
      pos: c => { const r = c.el.getBoundingClientRect(); c.x = r.left + r.width / 2; c.y = r.top + r.height / 2; c.r = r.width / 2 + 8; } },
    capSide(true), capSide(false),
  ];
  const orb = { x: 0.77, y: 0.52, s: 1.1, a: 1, charge: 0, e: 0, theme: 0, pulse: 0, cx: 0, cy: 0, R: 0 };
  let snap = 3, lastY = window.scrollY, t0 = performance.now(), lastNow = t0, lastHud = '', slosh = 0;
  let mx = 0, my = 0, mxe = 0, mye = 0;
  window.addEventListener('pointermove', e => { mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; }, { passive: true });

  /* le visiteur peut frapper le bouclier : même onde que lorsqu'une particule est repoussée */
  const onShield = e => shieldP > 0.6 && Math.hypot(e.clientX - orb.cx, e.clientY - orb.cy) <= orb.R * 1.5 * 1.03;
  window.addEventListener('pointerdown', e => {
    if (!onShield(e)) return;
    const Rs = orb.R * 1.5;
    if (impacts.length > 5) impacts.shift();
    impacts.push({ x: (e.clientX - orb.cx) / Rs, y: (e.clientY - orb.cy) / Rs, age: 0 });
  }, { passive: true });
  function frame(now) {
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000)); lastNow = now;
    const mid = H / 2;
    const sy = window.scrollY, vel = Math.abs(sy - lastY); lastY = sy;
    slosh = lerp(slosh, Math.min(vel, 60) / 60, 0.12);
    // tant que tous les retours ne sont pas arrivés, on ne sort pas de la section « sept jours » (la scène reste épinglée)
    if (!reduced && spoke < 8 && now > noGateUntil) {
      const ce = sections[capIdx].el, top = ce.offsetTop, lim = top + ce.offsetHeight - H;
      if (sy > lim && gatePrev <= lim + 1 && gatePrev >= top - H) window.scrollTo({ top: lim, behavior: 'instant' });
    }
    gatePrev = window.scrollY;
    updateReaders();
    mxe = lerp(mxe, mx, 0.05); mye = lerp(mye, my, 0.05);
    const T = THEMES[theme];

    // section courante
    let cur = sections[0];
    for (const s of sections) { const r = s.el.getBoundingClientRect(); s.r = r; if (r.top <= mid) cur = s; }
    const curR = cur.r;
    const prog = clamp((mid - curR.top) / curR.height);
    const pinP = cur.pin ? clamp(-curR.top / Math.max(1, curR.height - H)) : prog;
    const rr = relEl.getBoundingClientRect();
    // la première partie du blocage (2,6 écrans) joue l'explosion, le reste fait tourner la roue de données
    const relK = Math.max(1, (rr.height - H) / (2.6 * H)), relX = clamp(-rr.top / Math.max(1, rr.height - H)) * relK, relP = clamp(relX);

    // cibles
    const o = mobile ? cur.m : cur.d;
    let ts = o[2], ta = o[3] === undefined ? 1 : o[3];
    let tCharge = lerp(cur.charge[0], cur.charge[1], prog);
    let state = cur.state;
    if (cur.id === 'capture') {
      const q = clamp(pinP / 0.9);

      // l'orbe ne se charge jamais plus vite que les retours affichés
      const shown = spoke + 1, qCap = shown <= 3 ? shown * 0.18 : 0.54 + (shown - 3) * 0.07;
      tCharge = lerp(cur.charge[0], cur.charge[1], Math.min(q, spoke >= 8 ? 1 : qCap));
      // le scroll fixe la cible ; les 3 premiers retours gardent le temps de s'écrire, les suivants se valident aussitôt
      const target = q < 0.54 ? Math.floor(q / 0.18) : Math.min(8, 3 + Math.floor((q - 0.54) / 0.07));
      talkT += dt;
      if (target < spoke || snap > 0) { setSpeak(target); talkT = 0; }
      else if (target > spoke && (reduced || spoke < 0 || talkT >= (spoke < 3 ? MIN_TALK : 0.22))) { setSpeak(spoke + 1); talkT = 0; }
      state = `Captation · ${Math.max(0, spoke)}/8 retours`;
    } else if (sections.indexOf(cur) < capIdx) setSpeak(-1);
    else setSpeak(8);
    {
      const ci = sections.indexOf(cur);
      connT = ci < connIdx ? 0 : ci > connIdx || snap > 0 || reduced ? 99 : connT + dt;
      if (ci === connIdx) tCharge = Math.min(tCharge, cur.charge[1] * apps.filter(c => c.grow > 0.9).length / apps.length);
      const n = apps.filter(c => c.el.classList.contains('on')).length;
      if (n !== appN) { appN = n; appCount.textContent = n + '/' + apps.length; }
    }
    if (cur.id === 'release') {
      ts *= 1 + 0.22 * smooth(0, 0.3, relP) - 0.34 * smooth(0.3, 0.37, relP);
      state = relP < 0.37 ? 'Chargé' : 'Rapport généré';
    }
    const tE = cur.cta ? 0 : smooth(0.37, 0.62, relP);
    const dark = relP > 0.3;
    const jitter = smooth(0.06, 0.36, relP) * (1 - smooth(0.37, 0.45, relP));
    root.classList.toggle('dark', dark);

    const snapping = snap > 0;
    const k = snapping ? 1 : 0.075;
    const rising = tCharge - orb.charge > 0.0006;
    orb.x = lerp(orb.x, o[0], k); orb.y = lerp(orb.y, o[1], k);
    orb.s = lerp(orb.s, ts, snapping ? 1 : 0.1); orb.a = lerp(orb.a, ta, k);
    orb.charge = lerp(orb.charge, tCharge, snapping ? 1 : 0.14);
    orb.e = lerp(orb.e, tE, snapping ? 1 : 0.16);
    orb.theme = lerp(orb.theme, dark ? 1 : 0, snapping ? 1 : 0.07);
    orb.pulse *= 0.9;
    shieldP = snapping ? (cur.ring ? 1 : 0) : clamp(shieldP + (cur.ring ? dt / 1.5 : -dt / 0.5));
    if (snap > 0) snap--;

    const breathe = reduced ? 1 : 1 + 0.012 * Math.sin(t * 1.25) + 0.006 * Math.sin(t * 2.9);
    const R = Math.min(W, H) * 0.25 * orb.s * breathe * (1 + orb.pulse * 0.04);
    const cx = orb.x * W + (mobile ? 0 : mxe * 6), cy = orb.y * H + (mobile ? 0 : mye * 6);
    orb.cx = cx; orb.cy = cy; orb.R = R;
    const ch = orb.charge;

    // HUD
    const pct = Math.round(ch * 100);
    const hud = state + pct + cur.entry;
    if (hud !== lastHud) {
      lastHud = hud; hudState.textContent = state;
      hudPct.textContent = String(pct).padStart(3, '0') + ' %';
      hudFill.style.transform = `scaleX(${ch.toFixed(3)})`;
      hudEntry.textContent = ENTRY[cur.entry] || '';
      hudEntry.hidden = !cur.entry;
    }

    // release : textes + cartes
    relPre.style.opacity = (smooth(-0.02, 0.06, relP + (rr.top < H * 0.4 ? 0.06 : 0)) * (1 - smooth(0.26, 0.35, relP))).toFixed(3);
    relPost.style.opacity = smooth(0.52, 0.68, relP).toFixed(3);
    {
      // cran : la roue marque un temps d'arrêt sur chaque ligne avant de passer à la suivante
      const wo = smooth(0.5, 0.64, relX), raw = (wl.length - 1) * clamp((relX - 0.68) / Math.max(0.1, relK - 0.74)), fl = Math.min(wl.length - 2, Math.floor(raw)), pos = fl + smooth(0.22, 0.78, raw - fl);
      const key = Math.round(wo * 200) * 10000 + Math.round(pos * 1000);
      if (key !== wheelKey) {
        wheelKey = key; wheel.style.opacity = wo.toFixed(3);
        const Rw = Math.min(H * 0.34, mobile ? 210 : 310);
        wl.forEach((el, i) => {
          const dd = i - pos, a = dd * 0.36;
          if (Math.abs(a) > 1.5) { el.style.opacity = 0; return; }
          const c = Math.cos(a), act = clamp(1 - Math.abs(dd));
          el.style.opacity = (0.13 * c + 0.87 * act * act).toFixed(3);
          el.style.transform = `translateY(calc(-50% + ${(Math.sin(a) * Rw).toFixed(1)}px)) scale(${(0.8 + 0.2 * c).toFixed(3)},${c.toFixed(3)})`;
        });
      }
    }
    const sr = relStage.getBoundingClientRect();
    shards.forEach((s, i) => {
      const c = smooth(0.42 + i * 0.035, 0.62 + i * 0.035, relP);
      if (Math.abs(c - s.c) < 0.0005) return;
      s.c = c;
      const dx = (sr.width / 2 - s.hx) * (1 - c), dy = (sr.height / 2 - s.hy) * (1 - c);
      s.el.style.opacity = c.toFixed(3);
      s.el.style.transform = c >= 1 ? 'none' : `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${lerp(0.25, 1, c).toFixed(3)})`;
    });

    /* ================= dessin ================= */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const th = orb.theme;
    const ink = `rgb(${Math.round(lerp(T.a[0], T.b[0], th))},${Math.round(lerp(T.a[1], T.b[1], th))},${Math.round(lerp(T.a[2], T.b[2], th))})`;
    const ACC = T.acc;
    const vis = orb.a * Math.pow(1 - orb.e, 1.4);
    ctx.lineCap = 'round';

    // liaisons vers les cartes
    if (relP > 0.4 && rr.bottom > 0) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      shards.forEach(s => {
        if (s.c <= 0.02) return;
        const r = s.el.getBoundingClientRect();
        ctx.globalAlpha = 0.16 * s.c;
        ctx.beginPath(); ctx.moveTo(sr.left + sr.width / 2, sr.top + sr.height / 2);
        ctx.lineTo(r.left + r.width / 2, r.top + r.height / 2); ctx.stroke();
      });
    }

    // halo : l'énergie accumulée
    if (vis > 0.01 && ch > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
      g.addColorStop(0, ACC); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (theme === 'green' || th > 0.5 ? 0.2 : 0.11) * ch * vis * (0.85 + 0.15 * Math.sin(t * 1.25));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, TAU); ctx.fill();
    }

    // anneau de charge
    const Rr = R * 1.17;
    if (vis > 0.01) {
      ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.globalAlpha = 0.14 * vis;
      ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.stroke();
      if (ch > 0.003) {
        ctx.strokeStyle = ACC; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.95 * vis;
        ctx.beginPath(); ctx.arc(cx, cy, Rr, -Math.PI / 2, -Math.PI / 2 + ch * TAU); ctx.stroke();
        const ha = -Math.PI / 2 + ch * TAU;
        ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * Rr, cy + Math.sin(ha) * Rr, 2.6, 0, TAU); ctx.fill();
      }
    }

    // points de la sphère
    if (vis > 0.004) {
      const yaw = (reduced ? 0.6 : t * 0.16) + mxe * 0.45, yaw2 = (reduced ? 0.2 : -t * 0.1) + mxe * 0.45;
      const pitch = 0.26 + mye * 0.28;
      const c1 = Math.cos(yaw), s1 = Math.sin(yaw), c2 = Math.cos(yaw2), s2 = Math.sin(yaw2);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const amp = reduced ? 0 : 0.016 + 0.03 * ch;
      const wave = (reduced ? 0 : 0.014 + slosh * 0.07) * Math.min(1, ch * 8);
      const full = ch >= 0.995, jt = jitter * 7;
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const cc = p.inner ? c2 : c1, ss = p.inner ? s2 : s1;
        const disp = 1 + amp * Math.sin(p.x * 3.1 + t * 1.1 + p.ph * 0.3) * Math.cos(p.y * 3.7 - t * 0.8);
        const x1 = (p.x * cc + p.z * ss) * disp, z1 = (-p.x * ss + p.z * cc) * disp, y1 = p.y * disp;
        const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp;
        const level = ch + wave * Math.sin(x1 * 3.3 + t * 2.1) + wave * 0.5 * Math.sin(x1 * 7 - t * 3.3 + z2 * 2);
        const filled = ch > 0.004 && (full || (1 - y2) / 2 * 0.92 + p.n * 0.08 <= level);
        if (filled && !p.filled && rising && !snapping) p.flash = 1;
        p.filled = filled; p.flash *= 0.93;
        const f = (1 + z2 * 0.22) * (1 + orb.e * p.sp * 5.5);
        let px = cx + x1 * R * f, py = cy + y2 * R * f;
        if (jt > 0.05) { px += Math.sin(t * 31 + i) * p.jx * jt; py += Math.cos(t * 27 + i * 1.3) * p.jy * jt; }
        p.sx = px; p.sy = py; p.dp = 0.3 + 0.7 * (z2 + 1) / 2;
      }
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? ACC : ink;
        for (let i = 0; i < N; i++) {
          const p = pts[i];
          const hot = p.filled && (p.acc || p.flash > 0.08);
          if ((pass === 1) !== hot) continue;
          if (p.filled) {
            const tw = reduced ? 1 : 0.82 + 0.18 * Math.sin(t * 2.2 + p.ph);
            const sz = (0.9 + p.dp * 1.3) * (1 + p.flash * 1.6) * (p.inner ? 0.85 : 1);
            ctx.globalAlpha = Math.min(1, p.dp * tw + p.flash) * vis;
            ctx.beginPath(); ctx.arc(p.sx, p.sy, sz, 0, TAU); ctx.fill();
          } else {
            ctx.globalAlpha = (0.1 + p.dp * 0.16) * vis;
            ctx.fillRect(p.sx - 0.6, p.sy - 0.6, 1.3, 1.3);
          }
        }
      }
      // synapses : de brèves liaisons entre points chargés
      if (!reduced && orb.e < 0.05) {
        if (Math.random() < 0.5 * ch && links.length < 46) {
          const i = (Math.random() * NS) | 0, j = pts[i].nb;
          if (j >= 0 && pts[i].filled && pts[j].filled) links.push({ i, j, life: 1 });
        }
        ctx.strokeStyle = ACC; ctx.lineWidth = 1;
        for (let n = links.length - 1; n >= 0; n--) {
          const l = links[n]; l.life -= dt * 1.6;
          if (l.life <= 0) { links.splice(n, 1); continue; }
          const a = pts[l.i], b = pts[l.j];
          ctx.globalAlpha = Math.sin(l.life * Math.PI) * 0.7 * vis * Math.min(a.dp, b.dp);
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }
    }
    /* --- fibres : trois variantes (circuit / faisceau / fil) --- */
    const M = 48;
    for (const G of groups) {
      const active = cur.el === G.sec;
      G.a = snapping ? (active ? 1 : 0) : lerp(G.a, active ? 1 : 0, 0.08);
      if (G.a < 0.015) { G.items.forEach(c => { c.grow = 0; c.pulses.length = 0; }); continue; }
      const n = G.items.length, al = G.a;
      let mxs = 0, mys = 0;
      G.items.forEach((c, i) => {
        const on = active && G.on(c, i);
        c.grow = snapping || reduced ? (on ? 1 : 0) : lerp(c.grow, on ? 1 : 0, 0.06);
        G.pos(c, i, cx, cy); mxs += c.x; mys += c.y;
        if (G.kind === 'radial') { if (!G.on(c, i)) c.el.classList.remove('on'); else if (c.grow > 0.9) c.el.classList.add('on'); }
        if (G.burst && quoteBurst && c.grow > 0.5) c.pulses.push(-rnd(0.35));
      });
      mxs /= n; mys /= n;
      const side = cx >= mxs ? 1 : -1;
      const order = G.items.slice().sort((a, b) => a.up ? a.x - b.x : Math.abs(a.y - b.y) > 4 ? a.y - b.y : side * (a.y < cy ? a.x - b.x : b.x - a.x));
      const thc = Math.atan2(mys - cy, mxs - cx), spread = Math.min(0.085, 0.6 / n);
      const lane = clamp(Rr * 0.09, 9, 20);
      order.forEach((c, i) => {
        if (c.grow <= 0.01) { c.pulses.length = 0; return; }
        if (G.kind === 'radial') {
          /* le système tend lui-même un fil vers chaque outil, puis les données reviennent */
          const th = Math.atan2(c.y - cy, c.x - cx), nx = Math.cos(th), ny = Math.sin(th);
          const x0 = cx + nx * Rr, y0 = cy + ny * Rr, x1 = c.x - nx * c.r, y1 = c.y - ny * c.r;
          const g = c.grow, hx = lerp(x0, x1, g), hy = lerp(y0, y1, g), plugged = g > 0.97;
          ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.3 * al;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.fillStyle = ACC; ctx.globalAlpha = 0.95 * al;
          ctx.beginPath(); ctx.arc(x0, y0, 2.4, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(hx, hy, plugged ? 2.4 : 3.2, 0, TAU); ctx.fill();
          if (!reduced && plugged && active && Math.random() < 0.02 && c.pulses.length < 3) c.pulses.push(0);
          ctx.strokeStyle = ACC; ctx.lineWidth = 2;
          for (let q = c.pulses.length - 1; q >= 0; q--) {
            const u = (c.pulses[q] += dt * 0.9);
            if (u >= 1) { c.pulses.splice(q, 1); orb.pulse = Math.min(1, orb.pulse + 0.14); blips.push({ a: th, life: 1 }); continue; }
            const u0 = Math.max(0, u - 0.16);
            ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(lerp(x1, x0, u0), lerp(y1, y0, u0)); ctx.lineTo(lerp(x1, x0, u), lerp(y1, y0, u)); ctx.stroke();
          }
          return;
        }
        const P = c.P; let ex, ey;
        if (G.kind === 'circuit') {
          ey = cy + (i - (n - 1) / 2) * lane; ex = cx - side * Math.sqrt(Math.max(0, Rr * Rr - (ey - cy) ** 2));
          const dy = ey - c.y, li = dy > 0 ? i : n - 1 - i;
          const xb = ex - side * (30 + li * 14);
          let xa = xb - side * Math.abs(dy);
          if (side * (xa - c.x) < 12) xa = c.x + side * 12;
          const X = [c.x, xa, xb, ex], Y = [c.y, c.y, ey, ey], L = [0];
          for (let s = 1; s < 4; s++) L.push(L[s - 1] + Math.hypot(X[s] - X[s - 1], Y[s] - Y[s - 1]));
          for (let s = 0; s <= M; s++) {
            const dd = s / M * L[3], k2 = dd <= L[1] ? 0 : dd <= L[2] ? 1 : 2, f = (dd - L[k2]) / Math.max(1e-6, L[k2 + 1] - L[k2]);
            P[s * 2] = lerp(X[k2], X[k2 + 1], f); P[s * 2 + 1] = lerp(Y[k2], Y[k2 + 1], f);
          }
        } else {
          const tha = thc - side * (i - (n - 1) / 2) * spread, nx = Math.cos(tha), ny = Math.sin(tha);
          ex = cx + nx * Rr; ey = cy + ny * Rr;
          const dist = Math.hypot(ex - c.x, ey - c.y);
          const ax = c.up ? c.x : c.x + side * dist * 0.42, ay = c.up ? c.y - dist * 0.42 : c.y;
          const bx = ex + nx * dist * 0.22, by = ey + ny * dist * 0.22;
          for (let s = 0; s <= M; s++) {
            const u = s / M, v = 1 - u;
            P[s * 2] = v * v * v * c.x + 3 * v * v * u * ax + 3 * v * u * u * bx + u * u * u * ex;
            P[s * 2 + 1] = v * v * v * c.y + 3 * v * v * u * ay + 3 * v * u * u * by + u * u * u * ey;
          }
        }
        const pt = u => { const f = clamp(u) * M, s = Math.min(M - 1, f | 0), q = f - s; return [lerp(P[s * 2], P[s * 2 + 2], q), lerp(P[s * 2 + 1], P[s * 2 + 3], q)]; };
        const end = c.grow, last = Math.max(1, Math.round(M * end)), plugged = end > 0.97;
        const arrive = () => { orb.pulse = Math.min(1, orb.pulse + 0.14); blips.push({ a: Math.atan2(ey - cy, ex - cx), life: 1 }); };

        if (G.kind === 'bundle') {
          /* faisceau : cinq brins qui ondulent, parcourus par des ondes lumineuses */
          if (!c.S) c.S = [0, 1, 2, 3, 4].map(() => new Float32Array((M + 1) * 2));
          ctx.strokeStyle = ink; ctx.lineWidth = 1;
          for (let k2 = 0; k2 < 5; k2++) {
            const S = c.S[k2];
            ctx.beginPath();
            for (let s = 0; s <= M; s++) {
              const u = s / M, s0 = Math.max(0, s - 1), s1 = Math.min(M, s + 1);
              const tx = P[s1 * 2] - P[s0 * 2], ty = P[s1 * 2 + 1] - P[s0 * 2 + 1], tl = Math.hypot(tx, ty) || 1;
              const env = Math.sin(Math.PI * u);
              const off = (k2 - 2) * 3.4 * Math.pow(env, 0.7) + (reduced ? 0 : Math.sin(u * 8 - t * 1.3 + k2 * 1.7 + c.seed * 6) * 2.6 * env);
              S[s * 2] = P[s * 2] - ty / tl * off; S[s * 2 + 1] = P[s * 2 + 1] + tx / tl * off;
              if (s <= last) { s ? ctx.lineTo(S[s * 2], S[s * 2 + 1]) : ctx.moveTo(S[s * 2], S[s * 2 + 1]); }
            }
            ctx.globalAlpha = 0.24 * al; ctx.stroke();
          }
          if (plugged && !reduced) {
            ctx.strokeStyle = ACC; ctx.lineWidth = 1.6;
            for (let k2 = 0; k2 < 5; k2++) for (let m = 0; m < 2; m++) {
              const S = c.S[k2], ph = (t * 0.24 * (0.85 + 0.08 * k2) + k2 * 0.23 + c.seed + m * 0.5) % 1, head = ph * M;
              const fade = Math.sin(Math.PI * ph);
              for (let s = Math.max(0, Math.floor(head - 6)); s < Math.floor(head); s++) {
                ctx.globalAlpha = al * fade * clamp((s - (head - 6)) / 6);
                ctx.beginPath(); ctx.moveTo(S[s * 2], S[s * 2 + 1]); ctx.lineTo(S[s * 2 + 2], S[s * 2 + 3]); ctx.stroke();
              }
            }
            if (Math.random() < 0.05) orb.pulse = Math.min(1, orb.pulse + 0.1);
          }
        } else {
          ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.globalAlpha = (G.kind === 'circuit' ? 0.34 : 0.28) * al;
          ctx.beginPath(); ctx.moveTo(P[0], P[1]);
          for (let s = 1; s <= last; s++) ctx.lineTo(P[s * 2], P[s * 2 + 1]);
          ctx.stroke();
          if (!reduced && plugged && active && Math.random() < 0.016 + Math.min(vel, 40) * 0.006 && c.pulses.length < 4) c.pulses.push(0);
        }

        // prises : départ et arrivée
        ctx.globalAlpha = 0.9 * al;
        if (G.kind === 'circuit') {
          ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.strokeRect(c.x - 3.5, c.y - 3.5, 7, 7);
          if (plugged) { ctx.fillStyle = ACC; ctx.fillRect(ex - 3, ey - 3, 6, 6); }
        } else {
          ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(c.x, c.y, 2.4, 0, TAU); ctx.fill();
          if (plugged) { ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(ex, ey, G.kind === 'bundle' ? 3.4 : 2.6, 0, TAU); ctx.fill(); }
        }

        // impulsions (circuit : paquets carrés à vitesse constante / fil : comètes)
        ctx.strokeStyle = ctx.fillStyle = ACC;
        for (let q = c.pulses.length - 1; q >= 0; q--) {
          const u = (c.pulses[q] += dt * (G.kind === 'circuit' ? 0.5 : 0.62));
          if (u >= 1) { c.pulses.splice(q, 1); arrive(); continue; }
          if (u < 0) continue;
          if (G.kind === 'circuit') {
            for (let m = 0; m < 3; m++) {
              const uu = u - m * 0.028; if (uu < 0) break;
              const [x, y] = pt(uu), sz = 5 - m * 1.3;
              ctx.globalAlpha = al * (1 - m * 0.32); ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
            }
          } else {
            const e2 = u * u * (3 - 2 * u), tail = Math.max(0, e2 - 0.09);
            let [px, py] = pt(tail); ctx.lineWidth = 2;
            for (let s = 1; s <= 6; s++) { const [x, y] = pt(tail + (e2 - tail) * s / 6); ctx.globalAlpha = al * s / 6; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); px = x; py = y; }
            ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
          }
        }
      });
    }
    quoteBurst = null;
    for (let q = blips.length - 1; q >= 0; q--) {
      const b = blips[q]; b.life -= dt * 2.2;
      if (b.life <= 0) { blips.splice(q, 1); continue; }
      const x = cx + Math.cos(b.a) * Rr, y = cy + Math.sin(b.a) * Rr;
      ctx.strokeStyle = ACC; ctx.lineWidth = 1.2; ctx.globalAlpha = b.life * vis;
      ctx.beginPath(); ctx.arc(x, y, 3 + (1 - b.life) * 14, 0, TAU); ctx.stroke();
    }
    /* --- bouclier hexagonal --- */
    if (shieldP > 0.002 && vis > 0.01) {
      const Rs = R * 1.5, SH = T.shield, P = shieldP;
      // particules extérieures déviées
      if (!reduced && P > 0.95 && t > nextStray) {
        nextStray = t + rnd(0.7, 1.6);
        const a = rnd(TAU); strays.push({ a, d: 2.5, hit: false, life: 1, side: Math.random() < 0.5 ? 1 : -1 });
      }
      for (let n = impacts.length - 1; n >= 0; n--) { impacts[n].age += dt; if (impacts[n].age > 0.9) impacts.splice(n, 1); }
      const sweep = (t * 0.2) % 1.7 - 0.35;
      for (const c of cells) {
        const act = clamp((P * 1.5 - c.order) / 0.5);
        if (act <= 0) continue;
        const ea = 1 - Math.pow(1 - act, 3), sc = 0.35 + 0.65 * ea;
        let glow = (act < 1 ? (1 - act) * 0.9 : 0) + Math.exp(-(((c.g - sweep) / 0.07) ** 2)) * 0.3;
        for (const im of impacts) { const dd = Math.hypot(c.c[0] - im.x, c.c[1] - im.y) - im.age * 1.5; glow += Math.exp(-((dd / 0.13) ** 2)) * (1 - im.age / 0.9) * 0.9; }
        const fres = 0.3 + 0.7 * c.d * c.d;
        ctx.beginPath();
        for (let q = 0; q < 6; q++) {
          const x = cx + (c.c[0] + (c.v[q][0] - c.c[0]) * sc) * Rs, y = cy + (c.c[1] + (c.v[q][1] - c.c[1]) * sc) * Rs;
          q ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${SH},${Math.min(0.75, (0.045 * fres + glow * 0.42) * ea).toFixed(3)})`;
        ctx.globalAlpha = vis; ctx.fill();
        ctx.strokeStyle = `rgba(${SH},${Math.min(1, (0.2 + 0.5 * fres + glow * 0.5) * ea).toFixed(3)})`;
        ctx.lineWidth = 1; ctx.stroke();
      }
      const rim = smooth(0.55, 1, P);
      ctx.globalAlpha = vis;
      ctx.strokeStyle = `rgba(${SH},${(0.75 * rim).toFixed(3)})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, Rs * 1.012, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(${SH},${(0.13 * rim).toFixed(3)})`; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(cx, cy, Rs * 1.012, 0, TAU); ctx.stroke();
      for (let n = strays.length - 1; n >= 0; n--) {
        const s = strays[n];
        if (!s.hit) {
          s.d -= dt * 1.5;
          if (s.d <= 1.02) { s.hit = true; s.d = 1.02; impacts.push({ x: Math.cos(s.a) * 0.97, y: Math.sin(s.a) * 0.97, age: 0 }); }
        } else { s.life -= dt * 1.5; s.a += s.side * dt * 1.1; s.d += dt * 0.9; }
        if (s.life <= 0) { strays.splice(n, 1); continue; }
        const x = cx + Math.cos(s.a) * s.d * Rs, y = cy + Math.sin(s.a) * s.d * Rs;
        const tx = cx + Math.cos(s.a - (s.hit ? s.side * 0.07 : 0)) * (s.d + (s.hit ? -0.05 : 0.14)) * Rs, ty = cy + Math.sin(s.a - (s.hit ? s.side * 0.07 : 0)) * (s.d + (s.hit ? -0.05 : 0.14)) * Rs;
        ctx.strokeStyle = ctx.fillStyle = ink; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3 * s.life * P; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 0.85 * s.life * P; ctx.beginPath(); ctx.arc(x, y, 1.7, 0, TAU); ctx.fill();
      }
    } else if (strays.length) { strays.length = 0; impacts.length = 0; }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  measure();
  window.addEventListener('resize', () => { measure(); snap = 2; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);

  // ?y=1234 : position de défilement au chargement, animations CSS figées (aperçus)
  const y0 = params.get('y');
  if (y0 !== null) {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(st);
    root.style.scrollBehavior = 'auto'; window.scrollTo(0, +y0); lastY = +y0;
  }

  requestAnimationFrame(frame);
})();
