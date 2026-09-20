/* Set tema lebih awal supaya tidak berkedip */
  (function () {
    var t = null;
    try { t = localStorage.getItem('theme'); } catch (e) {}
    if (!t) t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();

/* ============ Tema (terang / gelap) ============ */
(() => {
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) {}
  const apply = (mode) => {
    root.setAttribute('data-theme', mode);
    window.dispatchEvent(new Event('themechange'));
  };
  if (mq.addEventListener) mq.addEventListener('change', (e) => { if (!stored) apply(e.matches ? 'dark' : 'light'); });
  document.getElementById('theme').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    stored = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    apply(next);
  });
})();

/* ============ Latar 3D (Three.js) ============
   Kedalaman dibangun dari: titik-titik di volume 3D, lantai grid berperspektif,
   bentuk wireframe di kedalaman berbeda, kabut, parallax mouse, dan kamera
   yang bergerak maju mengikuti scroll. */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  if (typeof THREE === 'undefined') return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 700;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 10, 90);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

  /* ---- Warna dari token CSS ---- */
  const cBg = new THREE.Color(), cAccent = new THREE.Color(), cInk = new THREE.Color();
  let dark = true;
  const tok = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function readTheme() {
    cBg.set(tok('--bg')); cAccent.set(tok('--accent')); cInk.set(tok('--ink'));
    dark = (cBg.r * 0.299 + cBg.g * 0.587 + cBg.b * 0.114) < 0.5;
  }

  /* ---- Titik-titik di volume 3D ---- */
  function dotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const COUNT = small ? 900 : 1800;
  const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT), tint = new Uint8Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 100;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 2] = 12 - Math.random() * 150;
    seed[i] = 0.35 + Math.random() * 0.65;
    tint[i] = Math.random() < 0.22 ? 1 : 0;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.4, map: dotTexture(), vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: true
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* ---- Lantai & langit-langit grid ---- */
  const STEP = 4;
  const gv = [];
  for (let x = -60; x <= 60; x += STEP) gv.push(x, 0, 14, x, 0, -170);
  for (let z = 14; z >= -170; z -= STEP) gv.push(-60, 0, z, 60, 0, z);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gv, 3));
  const floorMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const ceilMat  = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const grid = new THREE.Group();
  const floor = new THREE.LineSegments(gGeo, floorMat); floor.position.y = -9;
  const ceil  = new THREE.LineSegments(gGeo, ceilMat);  ceil.position.y = 16;
  grid.add(floor, ceil);
  scene.add(grid);

  /* ---- Bentuk wireframe di berbagai kedalaman ---- */
  const shapes = [];
  function addShape(geo, useEdges, p, s, rx, ry) {
    const lines = useEdges ? new THREE.EdgesGeometry(geo) : new THREE.WireframeGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ transparent: true });
    const m = new THREE.LineSegments(lines, mat);
    m.position.set(p[0], p[1], p[2]);
    m.scale.setScalar(s);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    scene.add(m);
    shapes.push({ m, mat, rx, ry, base: p[1], ph: Math.random() * 6 });
  }
  addShape(new THREE.IcosahedronGeometry(1, 1),          false, [ 17,  6,  -22], 4, 0.10, 0.14);
  addShape(new THREE.OctahedronGeometry(1),               true,  [-19, -1,  -38], 5, 0.12, 0.09);
  addShape(new THREE.TorusGeometry(1, 0.32, 14, 36),      false, [ 17, -2,  -56], 5, 0.16, 0.08);
  addShape(new THREE.BoxGeometry(1, 1, 1),                true,  [-15,  5,  -74], 6, 0.08, 0.13);
  addShape(new THREE.DodecahedronGeometry(1),             true,  [ 18,  4,  -92], 6, 0.11, 0.10);
  addShape(new THREE.IcosahedronGeometry(1, 2),           false, [-18, -3, -112], 7, 0.07, 0.11);

  /* ---- Terapkan tema ---- */
  function paintParticles() {
    for (let i = 0; i < COUNT; i++) {
      const c = tint[i] ? cAccent : cInk, k = seed[i];
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    pGeo.attributes.color.needsUpdate = true;
    pMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    pMat.opacity = dark ? 0.95 : 0.6;
    pMat.needsUpdate = true;
  }
  function applyTheme() {
    readTheme();
    scene.fog.color.copy(cBg);
    floorMat.color.copy(cAccent); floorMat.opacity = dark ? 0.34 : 0.30;
    ceilMat.color.copy(cAccent);  ceilMat.opacity  = dark ? 0.14 : 0.12;
    shapes.forEach((s) => { s.mat.color.copy(cAccent); s.mat.opacity = dark ? 0.6 : 0.5; });
    paintParticles();
  }
  applyTheme();
  window.addEventListener('themechange', applyTheme);

  /* ---- Ukuran ---- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- Input ---- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---- Loop ---- */
  let t0 = 0, last = 0, sp = 0, shown = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    if (!t0) { t0 = now; last = now; }
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const target = clamp(window.scrollY / max, 0, 1);
    sp += (target - sp) * Math.min(1, dt * 4);
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);

    // Satu momen pembuka: kamera meluncur maju dari jauh
    const introOff = reduce ? 0 : 26 * Math.pow(1 - clamp(t / 2.4, 0, 1), 3);
    const mx = reduce ? 0 : mouse.sx, my = reduce ? 0 : mouse.sy;

    camera.position.set(mx * 2.4, -sp * 3 - my * 1.2, 8 - sp * 72 + introOff);
    camera.lookAt(-mx * 1.2, -1.5 - sp * 2 - my * 0.5, camera.position.z - 40);
    camera.rotateZ(sp * 0.06 - mx * 0.02);

    if (!reduce) {
      grid.position.z = (t * 2.2) % STEP;
      points.rotation.y = Math.sin(t * 0.05) * 0.08;
      points.rotation.x = Math.sin(t * 0.04) * 0.03;
      for (const s of shapes) {
        s.m.rotation.x += s.rx * dt;
        s.m.rotation.y += s.ry * dt;
        s.m.position.y = s.base + Math.sin(t * 0.5 + s.ph) * 0.8;
      }
    }

    renderer.render(scene, camera);
    if (!shown) { shown = true; canvas.classList.add('ready'); }
  }
  requestAnimationFrame(frame);
})();

/* ============ Lanyard: fisika Verlet ============
   Tali = rantai titik dengan batas jarak tetap, kartu = titik berat di ujungnya. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const hero = $('home'), canvas = $('rope'), card = $('lanyard'), zone = $('zone'), hint = $('hint');
  const badge = card.querySelector('.badge');
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const SEG = 10, GRAV = 0.55, DAMP = 0.994, ITER = 26, DT = 1000 / 60;

  let W = 0, H = 0, cardW = 0, badgeH = 0, cardOff = 0, ropeLen = 200;
  const anchor = { x: 0, y: 0 };
  let pts = [], cons = [], intro = null;
  let dragging = false, introDone = false, swung = false;
  let running = false, last = 0, acc = 0, tiltX = 0, tiltY = 0, hoverX = 0, hoverY = 0;
  const target = { x: 0, y: 0 }, grab = { x: 0, y: 0 };
  const colors = { accent: '#2A45F5', on: '#FFFFFF', dark: false };

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors.accent = cs.getPropertyValue('--accent').trim() || colors.accent;
    colors.on = cs.getPropertyValue('--accent-ink').trim() || colors.on;
    const bg = cs.getPropertyValue('--bg').trim().replace('#', '');
    if (bg.length === 6) {
      const r = parseInt(bg.slice(0, 2), 16), g = parseInt(bg.slice(2, 4), 16), b = parseInt(bg.slice(4, 6), 16);
      colors.dark = (r * 0.299 + g * 0.587 + b * 0.114) < 128;
    }
  }

  function setup() {
    const r = hero.getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    W = r.width; H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cardW = card.offsetWidth;
    badgeH = badge.offsetHeight;
    cardOff = badge.offsetTop + badgeH / 2;   // jarak titik gantung ke pusat kartu

    const stacked = (z.top - r.top) > 40;      // tata letak mobile: kartu di bawah teks
    anchor.x = z.left - r.left + z.width / 2;
    if (stacked) {
      anchor.y = z.top - r.top + 10;
      ropeLen = clamp(z.height - 10 - (cardOff + badgeH / 2) - 20, 80, 150);
    } else {
      anchor.y = -40;
      ropeLen = clamp(H * 0.30, 150, 330) + 40;
    }
    build();
  }

  function build() {
    const useIntro = !introDone && !reduce && anchor.y <= 0;
    const lift = useIntro ? ropeLen + cardOff * 2 + 60 : 0;
    intro = useIntro ? { t0: 0, dur: 1400, lift } : null;
    if (!useIntro) introDone = true;

    const seg = ropeLen / SEG, y0 = anchor.y - lift;
    pts = [];
    for (let i = 0; i <= SEG; i++) {
      const y = y0 + seg * i;
      pts.push({ x: anchor.x, y, px: anchor.x, py: y, w: i ? 1 : 0 });
    }
    const cy = y0 + ropeLen + cardOff;
    pts.push({ x: anchor.x, y: cy, px: anchor.x, py: cy, w: 0.3 });

    cons = [];
    for (let i = 0; i < SEG; i++) cons.push({ a: i, b: i + 1, len: seg });
    cons.push({ a: SEG, b: SEG + 1, len: cardOff });

    if (!useIntro && !swung && !reduce) { swung = true; pts[SEG + 1].px -= 3; }
    render();
  }

  function setTarget(px, py) {
    let x = px - grab.x, y = py - grab.y;
    x = clamp(x, cardW / 2 + 6, W - cardW / 2 - 6);
    y = clamp(y, badgeH / 2 + 6, H - badgeH / 2 - 6);
    const dx = x - anchor.x, dy = y - anchor.y;
    const d = Math.hypot(dx, dy), R = ropeLen + cardOff - 1;
    if (d > R) { x = anchor.x + dx / d * R; y = anchor.y + dy / d * R; }
    target.x = x; target.y = y;
  }

  function step(now) {
    const a = pts[0];
    if (intro) {
      if (!intro.t0) intro.t0 = now;
      const t = clamp((now - intro.t0) / intro.dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      a.y = anchor.y - intro.lift * (1 - e);
      if (t >= 1) { intro = null; introDone = true; pts[pts.length - 1].px -= 2.5; a.y = anchor.y; }
    } else {
      a.y = anchor.y;
    }
    a.x = anchor.x; a.px = a.x; a.py = a.y;

    const c = pts[pts.length - 1];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p === c && dragging) {
        p.px = p.x; p.py = p.y; p.x = target.x; p.y = target.y;
        continue;
      }
      let vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
      const sp = Math.hypot(vx, vy);
      if (sp > 40) { vx *= 40 / sp; vy *= 40 / sp; }
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + GRAV;
    }

    const cw = c.w;
    if (dragging) c.w = 0;
    for (let k = 0; k < ITER; k++) {
      for (let j = 0; j < cons.length; j++) {
        const q = cons[j], p1 = pts[q.a], p2 = pts[q.b];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const diff = (d - q.len) / d;
        const ws = p1.w + p2.w;
        if (!ws) continue;
        const k1 = p1.w / ws, k2 = p2.w / ws;
        p1.x += dx * diff * k1; p1.y += dy * diff * k1;
        p2.x -= dx * diff * k2; p2.y -= dy * diff * k2;
      }
    }
    c.w = cw;

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const minX = p === c ? cardW / 2 + 6 : 4;
      const maxX = p === c ? W - cardW / 2 - 6 : W - 4;
      if (p.x < minX) { p.x = minX; p.px = p.x; }
      if (p.x > maxX) { p.x = maxX; p.px = p.x; }
      if (p === c && p.y > H - badgeH / 2 - 6) { p.y = H - badgeH / 2 - 6; p.py = p.y; }
    }
  }

  function trace(path) {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length - 1; i++) {
      const mx = (path[i].x + path[i + 1].x) / 2, my = (path[i].y + path[i + 1].y) / 2;
      ctx.quadraticCurveTo(path[i].x, path[i].y, mx, my);
    }
    const l = path[path.length - 1];
    ctx.lineTo(l.x, l.y);
  }

  function render() {
    if (!pts.length) return;
    const pn = pts[SEG], c = pts[SEG + 1];
    const ang = Math.atan2(-(c.x - pn.x), c.y - pn.y);

    const cvx = c.x - c.px, cvy = c.y - c.py;
    tiltY += (clamp(cvx * 2.2, -26, 26) + hoverX * 14 - tiltY) * 0.15;
    tiltX += (clamp(-cvy * 1.1, -16, 16) - hoverY * 12 - tiltX) * 0.15;

    card.style.transform =
      `translate3d(${pn.x - cardW / 2}px, ${pn.y}px, 0) rotate(${ang}rad) perspective(900px) ` +
      `translateY(${cardOff}px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) translateY(${-cardOff}px)`;
    card.style.setProperty('--sheen-pos', clamp(50 + ang * 172 + tiltY * 2.2, -30, 130) + '%');
    card.classList.add('ready');

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const rope = pts.slice(0, SEG + 1);

    if (!colors.dark) {
      ctx.strokeStyle = 'rgba(0,0,0,.18)';
      ctx.lineWidth = 15;
      trace(rope); ctx.stroke();
    }

    ctx.save();
    if (colors.dark) { ctx.shadowColor = colors.accent; ctx.shadowBlur = 16; }
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 13;
    trace(rope); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = colors.on;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    trace(rope); ctx.stroke();
    ctx.restore();

    if (anchor.y > 0) {
      ctx.fillStyle = colors.accent;
      ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function frame(now) {
    if (!running) return;
    acc += Math.min(now - last, 50);
    last = now;
    while (acc >= DT) { step(now); acc -= DT; }
    render();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---- Interaksi ---- */
  card.addEventListener('pointerdown', (e) => {
    if (intro) return;
    e.preventDefault();
    dragging = true;
    introDone = true;
    hoverX = hoverY = 0;
    card.classList.add('is-dragging');
    try { card.setPointerCapture(e.pointerId); } catch (_) {}
    const r = hero.getBoundingClientRect();
    const c = pts[pts.length - 1];
    grab.x = (e.clientX - r.left) - c.x;
    grab.y = (e.clientY - r.top) - c.y;
    setTarget(e.clientX - r.left, e.clientY - r.top);
    if (hint) hint.classList.add('is-hidden');
    start();
  });
  card.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    if (dragging) {
      setTarget(e.clientX - r.left, e.clientY - r.top);
    } else {
      const b = card.getBoundingClientRect();
      hoverX = clamp((e.clientX - b.left) / b.width - 0.5, -0.5, 0.5);
      hoverY = clamp((e.clientY - b.top) / b.height - 0.5, -0.5, 0.5);
    }
  });
  card.addEventListener('pointerleave', () => { hoverX = hoverY = 0; });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('is-dragging');
    try { card.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
  card.addEventListener('lostpointercapture', endDrag);

  card.addEventListener('keydown', (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || intro) return;
    e.preventDefault();
    const c = pts[pts.length - 1];
    c.px -= dir[0] * 7; c.py -= dir[1] * 5;
    if (hint) hint.classList.add('is-hidden');
    start();
  });

  /* ---- Siklus hidup ---- */
  readColors();
  setup();
  window.addEventListener('themechange', () => { readColors(); render(); });

  let resizeTimer = 0;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const r = hero.getBoundingClientRect();
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
      cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(setup);
    }).observe(hero);
  } else {
    window.addEventListener('resize', setup);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!introDone) setup(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) start(); else running = false;
    }, { threshold: 0 }).observe(hero);
  } else {
    start();
  }
})();

