(function () {
  'use strict';

  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  var HK_LAT = 22.3193;
  var HK_LON = 114.1694;

  var RAD = Math.PI / 180;

  /* ---------------------------------------------------------------- theme */

  var themeBtn = document.getElementById('theme-toggle');

  var tzName = 'UTC';
  try { tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) {}
  var tzCity = tzName.split('/').pop().replace(/_/g, ' ');

  function storedTheme() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }

  function localHour(tz) {
    try {
      return parseInt(new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', hour12: false
      }).format(new Date()), 10);
    } catch (e) {
      return new Date().getHours();
    }
  }

  function isNightHere() {
    var h = localHour(tzName);
    return h < 6 || h >= 19;
  }

  function setThemeAttr(next) {
    root.setAttribute('data-theme', next);
    syncSky();
    if (typeof updateClock === 'function') updateClock();
  }

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return isNightHere() ? 'dark' : 'light';
  }

  function isDark() { return currentTheme() === 'dark'; }

  function applyTheme(next) {
    setThemeAttr(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      if (document.startViewTransition && !calmQuery.matches) {
        document.startViewTransition(function () { applyTheme(next); });
      } else {
        applyTheme(next);
      }
    });
  }

  if (darkQuery.addEventListener) darkQuery.addEventListener('change', syncSky);
  else if (darkQuery.addListener) darkQuery.addListener(syncSky);

  /* --------------------------------------------------------------- topbar */

  var bar = document.querySelector('.topbar');
  if (bar) {
    var onScroll = function () {
      if (window.scrollY > 8) bar.classList.add('scrolled');
      else bar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------- clock */

  var clockEl = document.getElementById('clock');
  var placeEl = document.getElementById('place');

  function updateClock() {
    var manual = !!storedTheme();
    var tz = manual ? 'Asia/Hong_Kong' : tzName;
    var city = manual ? 'Hong Kong' : tzCity;
    if (placeEl) placeEl.textContent = city;
    if (!clockEl) return;
    try {
      clockEl.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
    } catch (e) {
      clockEl.textContent = '--:--';
    }
  }

  updateClock();
  setInterval(updateClock, 15000);

  /* ------------------------------------------------------------- visitors */

  var visitsEl = document.getElementById('visits');
  var visitsWrap = document.getElementById('visits-wrap');

  if (visitsEl) {
    var settled = false;
    var controller = 'AbortController' in window ? new AbortController() : null;
    var failVisits = function () {
      if (settled) return;
      settled = true;
      if (visitsWrap) visitsWrap.hidden = true;
    };
    var guard = setTimeout(function () {
      if (controller) controller.abort();
      failVisits();
    }, 4500);

    var opts = { cache: 'no-store' };
    if (controller) opts.signal = controller.signal;

    fetch('https://abacus.jasoncameron.dev/hit/luyue-work/site', opts)
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function (data) {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        if (data && typeof data.value === 'number') {
          visitsEl.textContent = data.value.toLocaleString('en-US');
        } else {
          failVisits();
        }
      })
      .catch(failVisits);
  }

  /* ---------------------------------------------------------------- email */

  var mailLink = document.getElementById('email');
  if (mailLink) {
    var address = 'lu_yue0312' + String.fromCharCode(64) + '163.com';
    mailLink.href = 'mailto:' + address;
    mailLink.title = address;
    mailLink.setAttribute('aria-label', 'Email ' + address);
  }

  /* ------------------------------------------------------------ astronomy */

  function julian(date) { return date.getTime() / 86400000 + 2440587.5; }

  function moonEcliptic(jd) {
    var T = (jd - 2451545.0) / 36525;
    var Lp = 218.3164477 + 481267.88123421 * T;
    var D = 297.8501921 + 445267.1114034 * T;
    var M = 357.5291092 + 35999.0502909 * T;
    var Mp = 134.9633964 + 477198.8675055 * T;
    var F = 93.2720950 + 483202.0175233 * T;

    var lambda = Lp
      + 6.289 * Math.sin(Mp * RAD)
      + 1.274 * Math.sin((2 * D - Mp) * RAD)
      + 0.658 * Math.sin(2 * D * RAD)
      + 0.214 * Math.sin(2 * Mp * RAD)
      - 0.186 * Math.sin(M * RAD)
      - 0.114 * Math.sin(2 * F * RAD);

    var beta = 5.128 * Math.sin(F * RAD)
      + 0.281 * Math.sin((Mp + F) * RAD)
      - 0.278 * Math.sin((F - Mp) * RAD)
      - 0.173 * Math.sin((2 * D - F) * RAD);

    return {
      lambda: ((lambda % 360) + 360) % 360,
      beta: beta,
      D: ((D % 360) + 360) % 360,
      Mp: ((Mp % 360) + 360) % 360
    };
  }

  function sunEcliptic(jd) {
    var T = (jd - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T;
    var M = 357.52911 + 35999.05029 * T;
    var C = 1.914602 * Math.sin(M * RAD)
      + 0.019993 * Math.sin(2 * M * RAD)
      + 0.000289 * Math.sin(3 * M * RAD);
    return { lambda: ((L0 + C) % 360 + 360) % 360, beta: 0, T: T };
  }

  function eclipticToEquatorial(lambda, beta, eps) {
    var l = lambda * RAD, b = beta * RAD, e = eps * RAD;
    var ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    var dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    return { ra: ((ra / RAD) % 360 + 360) % 360, dec: dec / RAD };
  }

  function sidereal(jd) {
    var T = (jd - 2451545.0) / 36525;
    var g = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * T * T - T * T * T / 38710000;
    return ((g % 360) + 360) % 360;
  }

  function horizontal(ra, dec, jd) {
    var lst = (sidereal(jd) + HK_LON + 360) % 360;
    var H = (lst - ra) * RAD;
    var d = dec * RAD;
    var p = HK_LAT * RAD;
    var alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p));
    return { alt: alt / RAD, az: ((az / RAD) + 180 + 360) % 360 };
  }

  /* -------------------------------------------------------------- canvases */

  var sky = document.getElementById('sky');
  var fx = document.getElementById('fx');
  if (!sky || !fx) return;

  var skyCtx = sky.getContext('2d');
  var fxCtx = fx.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  function sizeCanvases() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    [[sky, skyCtx], [fx, fxCtx]].forEach(function (pair) {
      pair[0].width = Math.floor(W * DPR);
      pair[0].height = Math.floor(H * DPR);
      pair[1].setTransform(DPR, 0, 0, DPR, 0, 0);
    });
    moon.r = Math.max(30, Math.min(56, Math.min(W, H) * 0.048));
    buildStars();
    updateEphemeris(new Date());
    moon.x = moon.tx;
    moon.y = moon.ty;
  }

  window.addEventListener('resize', sizeCanvases);

  /* ------------------------------------------------------------------ moon */

  var moon = {
    x: 0, y: 0, tx: 0, ty: 0, r: 40,
    elong: 180,
    limb: 0,
    alt: 0, az: 0, below: false,
    dragging: false,
    dragMoved: false,
    scale: 1
  };

  var CRATERS = [
    { x: 0.18, y: -0.22, r: 0.13, a: 0.11 },
    { x: -0.12, y: -0.42, r: 0.08, a: 0.09 },
    { x: 0.34, y: 0.12, r: 0.10, a: 0.07 },
    { x: -0.30, y: 0.24, r: 0.16, a: 0.06 },
    { x: 0.05, y: 0.46, r: 0.09, a: 0.08 },
    { x: -0.42, y: -0.05, r: 0.07, a: 0.07 },
    { x: 0.46, y: -0.34, r: 0.06, a: 0.06 }
  ];

  // A compressed patch of sky in the top corner. The whole sphere is mapped
  // into it, so the moon keeps its real azimuth/altitude relationship while
  // staying out of the reading column.
  function moonBox() {
    if (W < 520) return { x0: W - 78, x1: W - 42, y0: 72, y1: 122 };
    if (W < 900) return { x0: W - 196, x1: W - 74, y0: 84, y1: 214 };
    return { x0: W - 236, x1: W - 98, y0: 94, y1: 252 };
  }

  function screenX(az) {
    var b = moonBox();
    return b.x0 + (az / 360) * (b.x1 - b.x0);
  }

  function screenY(alt) {
    var b = moonBox();
    var a = Math.max(0, Math.min(90, alt));
    return b.y1 - (a / 90) * (b.y1 - b.y0);
  }

  function updateEphemeris(date) {
    var jd = julian(date);
    var m = moonEcliptic(jd);
    var s = sunEcliptic(jd);
    var eps = 23.439291 - 0.0130042 * s.T;
    var mEq = eclipticToEquatorial(m.lambda, m.beta, eps);
    var sEq = eclipticToEquatorial(s.lambda, 0, eps);
    var mH = horizontal(mEq.ra, mEq.dec, jd);
    var sH = horizontal(sEq.ra, sEq.dec, jd);

    moon.elong = ((m.lambda - s.lambda) % 360 + 360) % 360;

    // distance in km, from the main periodic terms -> apparent size varies ~ +-5%
    var dist = 385000.56
      - 20905.355 * Math.cos(m.Mp * RAD)
      - 3699.111 * Math.cos((2 * m.D - m.Mp) * RAD)
      - 2955.968 * Math.cos(2 * m.D * RAD)
      - 569.925 * Math.cos(2 * m.Mp * RAD);
    moon.scale = Math.max(0.94, Math.min(1.06, 384400 / dist));
    moon.alt = mH.alt;
    moon.az = mH.az;
    moon.below = mH.alt < 0;
    moon.tx = screenX(mH.az);
    moon.ty = screenY(mH.alt);

    // bright limb orientation taken from the real sky geometry, not the screen
    var dAz = ((sH.az - mH.az + 540) % 360) - 180;
    moon.limb = Math.atan2(mH.alt - sH.alt, dAz * Math.cos(mH.alt * RAD));
  }

  function moonPath(ctx, r, elong) {
    var cosE = Math.cos(elong * RAD);
    var rx = Math.max(0.4, Math.abs(cosE) * r);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (cosE > 0) {
      // crescent: the lit sliver sits between the limb and a terminator that bulges toward it
      ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
    } else {
      // gibbous: the terminator bulges away, leaving the far side dark
      ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    }
    ctx.closePath();
  }

  function drawMoon(ctx, now) {
    var dark = isDark();
    var hovering = document.body.classList.contains('over-moon');
    var cx = moon.x;
    var cy = moon.y;
    var r = moon.r * (moon.scale || 1);

    if (dark && !moon.below) {
      var pulse = 1 + Math.sin(now * 0.00016) * 0.05;
      var glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.5 * pulse);
      glow.addColorStop(0, 'rgba(246, 242, 231, 0.10)');
      glow.addColorStop(0.45, 'rgba(246, 242, 231, 0.035)');
      glow.addColorStop(1, 'rgba(246, 242, 231, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(moon.limb);

    // earthshine: the dark limb is faintly lit by sunlight bounced off Earth
    if (dark) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(246, 242, 231, 0.028)';
      ctx.fill();
    }

    moonPath(ctx, r, moon.elong);

    if (dark) {
      var g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, 'rgba(246, 242, 231, 0.82)');
      g.addColorStop(1, 'rgba(233, 227, 210, 0.94)');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = hovering
        ? 'rgba(38, 36, 30, 0.20)'
        : 'rgba(38, 36, 30, 0.14)';
    }
    ctx.fill();

    ctx.save();
    ctx.clip();
    for (var i = 0; i < CRATERS.length; i++) {
      var c = CRATERS[i];
      ctx.beginPath();
      ctx.arc(c.x * r, c.y * r, c.r * r, 0, Math.PI * 2);
      ctx.fillStyle = dark
        ? 'rgba(120, 116, 104, ' + (c.a * 0.7) + ')'
        : 'rgba(38, 36, 30, ' + (c.a * 0.5) + ')';
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  var levels = [];
  for (var li = 0; li < 28; li++) levels.push(0);

  function drawBars(ctx, now) {
    var active = false;
    for (var i = 0; i < levels.length; i++) if (levels[i] > 0.5) active = true;
    if (!active) return;

    var dark = isDark();
    var cx = moon.x, cy = moon.y, r = moon.r;
    ctx.save();
    ctx.lineCap = 'round';
    for (var j = 0; j < levels.length; j++) {
      var t = j / (levels.length - 1);
      var a = -Math.PI / 2 + t * Math.PI;
      var window0 = Math.sin(Math.PI * t);
      var amp = Math.max(0, levels[j]) * window0;
      var inner = r * 1.1;
      var outer = inner + 2 + amp * r * 0.62;
      var ang = a + moon.limb;
      var x0 = cx + Math.cos(ang) * inner;
      var y0 = cy + Math.sin(ang) * inner;
      var x1 = cx + Math.cos(ang) * outer;
      var y1 = cy + Math.sin(ang) * outer;
      ctx.strokeStyle = dark
        ? 'rgba(246, 242, 231, ' + (0.14 + amp * 0.5) + ')'
        : 'rgba(38, 36, 30, ' + (0.10 + amp * 0.34) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------- stars */

  var stars = [];
  var streaks = [];
  var streakWait = 5200;

  function buildStars() {
    var count = Math.max(45, Math.min(130, Math.round((W * H) / 17000)));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.94,
        r: 0.35 + Math.random() * 1.15,
        a: 0.2 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0013,
        drift: 0.003 + Math.random() * 0.008
      });
    }
  }

  function drawStars(ctx, now, dt) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.drift * dt;
      if (s.x > W + 2) s.x = -2;
      var alpha = s.a * (0.55 + 0.45 * Math.sin(now * s.speed + s.phase));
      if (alpha <= 0.02) continue;
      ctx.fillStyle = 'rgba(238, 242, 252, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStreak(ctx, s) {
    var tailX = s.x - s.vx * s.len;
    var tailY = s.y - s.vy * s.len;
    var g = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    g.addColorStop(0, 'rgba(255, 252, 244, ' + (0.85 * s.fade) + ')');
    g.addColorStop(0.35, 'rgba(200, 214, 240, ' + (0.32 * s.fade) + ')');
    g.addColorStop(1, 'rgba(200, 214, 240, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 253, 246, ' + (0.9 * s.fade) + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }


  /* Big Dipper: fixed asterism, drawn faintly so it reads as a constellation
     rather than decoration. Its real sky position rotates once a sidereal day;
     here it is anchored so it never collides with the layout. */
  var DIPPER = [
    [0.06, 0.54], [0.13, 0.76], [0.36, 0.78], [0.32, 0.53],
    [0.51, 0.47], [0.70, 0.39], [0.89, 0.27]
  ];
  var DIPPER_LINKS = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]];

  function drawDipper(ctx, now) {
    var w = Math.min(230, W * 0.24);
    if (w < 90) return;
    var h = w * 0.62;
    var x0 = W * 0.055;
    var y0 = 78;

    ctx.strokeStyle = 'rgba(226, 234, 248, 0.075)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (var i = 0; i < DIPPER_LINKS.length; i++) {
      var l = DIPPER_LINKS[i];
      var p = DIPPER[l[0]], q = DIPPER[l[1]];
      ctx.moveTo(x0 + p[0] * w, y0 + p[1] * h);
      ctx.lineTo(x0 + q[0] * w, y0 + q[1] * h);
    }
    ctx.stroke();

    for (var j = 0; j < DIPPER.length; j++) {
      var st = DIPPER[j];
      var tw = 0.55 + 0.45 * Math.sin(now * 0.0009 + j * 1.7);
      ctx.fillStyle = 'rgba(240, 244, 255, ' + (0.52 * tw).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x0 + st[0] * w, y0 + st[1] * h, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------------- sky */

  var skyRunning = false;
  var skyLast = 0;

  function skyFrame(now) {
    if (!skyRunning) return;
    var dt = skyLast ? Math.min(64, now - skyLast) : 16;
    skyLast = now;

    var dark = isDark();
    skyCtx.clearRect(0, 0, W, H);

    if (dark) {
      drawStars(skyCtx, now, dt);
      drawDipper(skyCtx, now);
    }

    // moon eases toward the real sky position unless the user is dragging it
    if (!moon.dragging) {
      moon.x += (moon.tx - moon.x) * 0.06;
      moon.y += (moon.ty - moon.y) * 0.06;
    }

    drawMoon(skyCtx, now);
    drawBars(skyCtx, now);

    if (dark && !calmQuery.matches) {
      streakWait -= dt;
      if (streakWait <= 0) {
        streakWait = 8000 + Math.random() * 10000;
        var angle = Math.PI * (0.16 + Math.random() * 0.1);
        streaks.push({
          x: W * (0.2 + Math.random() * 0.65),
          y: H * (0.04 + Math.random() * 0.3),
          vx: -Math.cos(angle) * 0.7,
          vy: Math.sin(angle) * 0.7,
          len: 110 + Math.random() * 90,
          life: 0,
          max: 900,
          fade: 1
        });
      }
      for (var j = streaks.length - 1; j >= 0; j--) {
        var k = streaks[j];
        k.life += dt;
        if (k.life > k.max) { streaks.splice(j, 1); continue; }
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.fade = Math.sin(Math.PI * (k.life / k.max));
        drawStreak(skyCtx, k);
      }
    }

    requestAnimationFrame(skyFrame);
  }

  function startSky() {
    if (skyRunning) return;
    skyRunning = true;
    skyLast = 0;
    requestAnimationFrame(skyFrame);
  }

  function stopSky() {
    skyRunning = false;
    streaks = [];
  }

  function syncSky() {
    if (document.hidden) { stopSky(); return; }
    startSky();
  }

  document.addEventListener('visibilitychange', syncSky);

  /* --------------------------------------------------------------- effects */

  var particles = [];
  var rockets = [];
  var balloons = [];
  var fxRunning = false;
  var fxLast = 0;
  var PALETTE = [
    ['#ff8f7a', '#ffd9a0'], ['#8ab4dd', '#dcecff'], ['#e2695d', '#ffb4a6'],
    ['#f0d9a8', '#fff6e0'], ['#a8c6e8', '#ffd2c4']
  ];

  function fxStart() {
    if (fxRunning) return;
    fxRunning = true;
    fxLast = 0;
    requestAnimationFrame(fxFrame);
  }

  function explode(x, y, shape) {
    var pair = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    var count = calmQuery.matches ? 34 : 96 + Math.round(Math.random() * 48);
    var kind = shape || (Math.random() < 0.28 ? 'ring' : 'peony');

    for (var i = 0; i < count; i++) {
      var angle;
      var speed;
      if (kind === 'ring') {
        angle = (i / count) * Math.PI * 2;
        speed = 230 + Math.random() * 26;
      } else {
        angle = Math.random() * Math.PI * 2;
        speed = 90 + Math.pow(Math.random(), 0.55) * 300;
      }
      particles.push({
        x: x, y: y,
        px: x, py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        max: 900 + Math.random() * 1100,
        color: Math.random() < 0.7 ? pair[0] : pair[1],
        size: 0.9 + Math.random() * 1.7,
        delay: Math.random() * 40
      });
    }

    particles.push({ ring: true, x: x, y: y, age: 0, max: 620, color: pair[1], size: 1 });
    particles.push({ flash: true, x: x, y: y, age: 0, max: 260, color: '#fff6e6', size: 1 });
  }

  function fxFrame(now) {
    var dt = fxLast ? Math.min(48, now - fxLast) : 16;
    fxLast = now;

    // fade previous frame instead of clearing: this is what gives the sparks tails
    fxCtx.globalCompositeOperation = 'destination-out';
    fxCtx.fillStyle = 'rgba(0, 0, 0, ' + (calmQuery.matches ? 0.42 : 0.11) + ')';
    fxCtx.fillRect(0, 0, W, H);
    fxCtx.globalCompositeOperation = isDark() ? 'lighter' : 'source-over';

    for (var r = rockets.length - 1; r >= 0; r--) {
      var rk = rockets[r];
      rk.age += dt;
      var p = Math.min(1, rk.age / rk.flight);
      var ease = 1 - Math.pow(1 - p, 2.1);
      rk.y = rk.y0 + (rk.ty - rk.y0) * ease;
      var wobble = Math.sin(rk.age * 0.02) * 1.6 * (1 - p);

      for (var s = 0; s < 3; s++) {
        fxCtx.fillStyle = 'rgba(255, ' + (196 + s * 12) + ', ' + (140 + s * 20) + ', ' + (0.5 - s * 0.13) + ')';
        fxCtx.beginPath();
        fxCtx.arc(rk.x + wobble + (Math.random() - 0.5) * 1.4, rk.y + 6 + s * 5, 1.5 - s * 0.35, 0, Math.PI * 2);
        fxCtx.fill();
      }
      fxCtx.fillStyle = 'rgba(255, 248, 226, 0.95)';
      fxCtx.beginPath();
      fxCtx.arc(rk.x + wobble, rk.y, 1.9, 0, Math.PI * 2);
      fxCtx.fill();

      if (p >= 1) {
        explode(rk.x, rk.y, rk.shape);
        rockets.splice(r, 1);
      }
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var pt = particles[i];
      pt.age += dt;
      if (pt.age > pt.max) { particles.splice(i, 1); continue; }
      var k = 1 - pt.age / pt.max;

      if (pt.flash) {
        var fr = 3 + (1 - k) * 22;
        var fg = fxCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, fr);
        fg.addColorStop(0, 'rgba(255, 250, 235, ' + (0.55 * k) + ')');
        fg.addColorStop(1, 'rgba(255, 240, 210, 0)');
        fxCtx.fillStyle = fg;
        fxCtx.beginPath();
        fxCtx.arc(pt.x, pt.y, fr, 0, Math.PI * 2);
        fxCtx.fill();
        continue;
      }

      if (pt.ring) {
        var rr = 6 + (1 - k) * 74;
        fxCtx.globalAlpha = k * 0.5;
        fxCtx.strokeStyle = pt.color;
        fxCtx.lineWidth = 1.5 * k + 0.35;
        fxCtx.beginPath();
        fxCtx.arc(pt.x, pt.y, rr, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.globalAlpha = 1;
        continue;
      }

      var damp = Math.pow(0.62, dt / 1000);
      pt.vx *= damp;
      pt.vy = pt.vy * damp + 130 * dt / 1000;
      pt.px = pt.x;
      pt.py = pt.y;
      pt.x += pt.vx * dt / 1000;
      pt.y += pt.vy * dt / 1000;

      fxCtx.globalAlpha = Math.max(0, k) * 0.95;
      fxCtx.strokeStyle = pt.color;
      fxCtx.lineWidth = pt.size;
      fxCtx.lineCap = 'round';
      fxCtx.beginPath();
      fxCtx.moveTo(pt.px, pt.py);
      fxCtx.lineTo(pt.x, pt.y);
      fxCtx.stroke();

      fxCtx.globalAlpha = Math.max(0, k) * 0.5;
      fxCtx.fillStyle = pt.color;
      fxCtx.beginPath();
      fxCtx.arc(pt.x, pt.y, pt.size * 0.8, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.globalAlpha = 1;
    }

    fxCtx.globalCompositeOperation = 'source-over';

    for (var b = balloons.length - 1; b >= 0; b--) {
      var bl = balloons[b];
      bl.age += dt;
      bl.y += bl.vy * dt / 1000;
      var sway = Math.sin(bl.age * 0.0015 + bl.phase) * bl.amp;
      var x = bl.x + sway;
      if (bl.y < -180) { balloons.splice(b, 1); continue; }

      var grd = fxCtx.createRadialGradient(x - bl.r * 0.38, bl.y - bl.r * 0.42, bl.r * 0.1, x, bl.y, bl.r * 1.2);
      grd.addColorStop(0, bl.light);
      grd.addColorStop(1, bl.color);
      fxCtx.fillStyle = grd;
      fxCtx.beginPath();
      fxCtx.ellipse(x, bl.y, bl.r * 0.84, bl.r, 0, 0, Math.PI * 2);
      fxCtx.fill();

      fxCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      fxCtx.lineWidth = 1.4;
      fxCtx.beginPath();
      fxCtx.ellipse(x, bl.y, bl.r * 0.84, bl.r, 0, Math.PI * 1.08, Math.PI * 1.42);
      fxCtx.stroke();

      fxCtx.fillStyle = bl.color;
      fxCtx.beginPath();
      fxCtx.moveTo(x - 2.8, bl.y + bl.r * 0.96);
      fxCtx.lineTo(x + 2.8, bl.y + bl.r * 0.96);
      fxCtx.lineTo(x, bl.y + bl.r * 1.16);
      fxCtx.closePath();
      fxCtx.fill();

      fxCtx.strokeStyle = 'rgba(226, 222, 210, 0.55)';
      fxCtx.lineWidth = 0.9;
      fxCtx.beginPath();
      fxCtx.moveTo(x, bl.y + bl.r * 1.12);
      for (var st = 1; st <= 12; st++) {
        var t = st / 12;
        fxCtx.lineTo(x + Math.sin(bl.age * 0.0022 + t * 3.4) * 5 * t, bl.y + bl.r * 1.12 + t * 54);
      }
      fxCtx.stroke();
    }

    if (rockets.length || particles.length || balloons.length) {
      requestAnimationFrame(fxFrame);
    } else {
      fxRunning = false;
      fxCtx.clearRect(0, 0, W, H);
    }
  }

  function launch(count) {
    var n = count || 4;
    var shapes = ['peony', 'ring', 'peony', 'willow'];
    for (var i = 0; i < n; i++) {
      (function (index) {
        setTimeout(function () {
          rockets.push({
            x: W * (0.16 + Math.random() * 0.68),
            y0: H + 10,
            y: H + 10,
            ty: H * (0.14 + Math.random() * 0.22),
            age: 0,
            flight: 620 + Math.random() * 300,
            shape: shapes[index % shapes.length]
          });
          fxStart();
        }, index * 240);
      })(i);
    }
  }

  function releaseBalloons(anchor) {
    var rect = anchor.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height * 0.28;
    for (var i = 0; i < 7; i++) {
      balloons.push({
        x: cx + (Math.random() - 0.5) * rect.width * 1.6,
        y: cy + (Math.random() - 0.5) * 40,
        r: 16 + Math.random() * 10,
        vy: -(52 + Math.random() * 34),
        phase: Math.random() * Math.PI * 2,
        amp: 8 + Math.random() * 12,
        age: 0,
        color: i % 2 ? '#c4402f' : '#3f7fbf',
        light: i % 2 ? '#f09585' : '#9cc4e8'
      });
    }
    fxStart();
  }

  /* ---------------------------------------------------------------- music */

  var audio = document.getElementById('player');
  var audioCtx = null;
  var analyser = null;
  var freqData = null;
  var playing = false;
  var nextUpdate = 0;

  function ensureAnalyser() {
    if (analyser || !audio) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      var source = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      analyser = null;
    }
  }

  function updateLevels(t) {
    var target = [];
    if (playing && analyser) {
      analyser.getByteFrequencyData(freqData);
      for (var i = 0; i < levels.length; i++) {
        var idx = Math.floor(Math.pow(i / levels.length, 1.5) * 96) + 2;
        target.push(Math.min(1, (freqData[idx] || 0) / 190));
      }
    } else if (playing) {
      for (var j = 0; j < levels.length; j++) {
        target.push(0.35 + 0.3 * Math.sin(t * 0.003 + j * 0.55));
      }
    } else {
      for (var k = 0; k < levels.length; k++) target.push(0);
    }
    for (var m = 0; m < levels.length; m++) {
      levels[m] += (target[m] - levels[m]) * (playing ? 0.28 : 0.12);
    }
  }

  function setPlaying(on) {
    playing = on;
    if (on) startSky();
  }

  function toggleMusic() {
    if (!audio) return;
    if (audio.paused) {
      ensureAnalyser();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      audio.volume = 0;
      var p = audio.play();
      if (p && p.then) {
        p.then(function () { setPlaying(true); fadeTo(0.34, 180); }).catch(function () {});
      } else {
        setPlaying(true);
        fadeTo(0.34, 180);
      }
    } else {
      setPlaying(false);
      fadeTo(0, 340, function () { audio.pause(); });
    }
  }

  var fadeTimer = 0;
  function fadeTo(target, duration, done) {
    if (!audio) return;
    clearInterval(fadeTimer);
    var start = audio.volume;
    var began = Date.now();
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - began) / duration);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k >= 1) {
        clearInterval(fadeTimer);
        if (done) done();
      }
    }, 40);
  }

  if (audio) {
    // warm the file in the background so the first tap starts instantly
    var warm = function () {
      if (!audio || !audio.paused || audio.currentTime > 0) return;
      audio.preload = 'auto';
      try { audio.load(); } catch (e) {}
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 2200);

    audio.addEventListener('pause', function () { setPlaying(false); });
    audio.addEventListener('play', function () { setPlaying(true); });
  }

  /* ---------------------------------------------------------- interaction */

  function moonHit(x, y) {
    var dx = x - moon.x;
    var dy = y - moon.y;
    return Math.sqrt(dx * dx + dy * dy) < moon.r * 1.45;
  }

  var pointerDown = false;
  var dragged = false;
  var downX = 0, downY = 0;

  document.addEventListener('pointermove', function (e) {
    if (pointerDown) {
      var far = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      if (!moon.dragging && far > 6) {
        moon.dragging = true;
        dragged = true;
      }
      if (moon.dragging) {
        moon.x = e.clientX;
        moon.y = e.clientY;
        startSky();
        return;
      }
    }
    var hit = moonHit(e.clientX, e.clientY);
    if (hit !== document.body.classList.contains('over-moon')) {
      document.body.classList.toggle('over-moon', hit);
    }
  }, { passive: true });

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'a' || tag === 'button') return;
    if (!moonHit(e.clientX, e.clientY)) return;
    pointerDown = true;
    dragged = false;
    moon.dragging = false;
    downX = e.clientX;
    downY = e.clientY;
    startSky();
    e.preventDefault();
  });

  document.addEventListener('pointerup', function (e) {
    if (!pointerDown) return;
    pointerDown = false;
    moon.dragging = false;
    if (dragged) {
      // let it drift back toward the real position
      updateEphemeris(new Date());
    } else {
      toggleMusic();
    }
  });

  document.addEventListener('pointercancel', function () {
    pointerDown = false;
    moon.dragging = false;
  });

  /* portrait: tap for balloons, hold for fireworks */
  var portrait = document.getElementById('portrait');
  if (portrait) {
    var holdTimer = 0;
    var held = false;

    portrait.addEventListener('pointerdown', function () {
      held = false;
      holdTimer = setTimeout(function () {
        held = true;
        launch(4);
      }, 520);
    });

    portrait.addEventListener('pointerup', function () {
      clearTimeout(holdTimer);
      if (!held) releaseBalloons(portrait);
    });

    portrait.addEventListener('pointerleave', function () {
      clearTimeout(holdTimer);
    });

    portrait.addEventListener('pointercancel', function () {
      clearTimeout(holdTimer);
    });

    portrait.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }


  /* ---------------------------------------------------------------- typing */

  function startTyping(done) {
    if (calmQuery.matches) { if (done) done(); return; }
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-type]'));
    if (!els.length) { if (done) done(); return; }

    var texts = els.map(function (el) { return el.textContent; });

    els.forEach(function (el) {
      var h = el.getBoundingClientRect().height;
      if (h > 0) el.style.minHeight = h + 'px';
      el.textContent = '';
    });

    var index = 0;

    function nextBlock() {
      if (index >= els.length) { if (done) done(); return; }
      var el = els[index];
      var text = texts[index];
      el.classList.add('typing');

      var caret = document.createElement('span');
      caret.className = 'caret';
      el.appendChild(caret);

      var pos = 0;

      function step() {
        if (pos >= text.length) {
          caret.remove();
          el.classList.remove('typing');
          el.classList.add('typed');
          index++;
          setTimeout(nextBlock, 240);
          return;
        }
        var ch = text.charAt(pos++);
        caret.insertAdjacentText('beforebegin', ch);
        var delay = 9;
        if (ch === '.' || ch === '!' || ch === '?') delay = 250;
        else if (ch === ',' || ch === ';' || ch === ':') delay = 120;
        else if (ch === ' ') delay = 13;
        setTimeout(step, delay + Math.random() * 7);
      }

      step();
    }

    nextBlock();
  }


  /* ---------------------------------------------------------- cycling motto */

  function startMotto() {
    var wrap = document.getElementById('motto-text');
    if (!wrap) return;

    var EN = 'Broaden learning, keep within propriety\nHold fast to who I am\nServe with loyalty and forbearance';
    var CN = '博文约礼、坚守本我、忠恕任事';

    if (calmQuery.matches) { wrap.textContent = CN; return; }

    var out = document.createTextNode('');
    var caret = document.createElement('span');
    caret.className = 'caret';
    wrap.appendChild(out);
    wrap.appendChild(caret);

    function typeText(text, speed, done) {
      var i = 0;
      (function step() {
        if (i >= text.length) { done(); return; }
        var ch = text.charAt(i++);
        out.nodeValue += ch;
        var d = speed;
        if (ch === '\n') d = 260;
        else if (ch === ',' || ch === ';') d = speed * 5;
        setTimeout(step, d);
      })();
    }

    function erase(speed, done) {
      (function step() {
        if (!out.nodeValue) { done(); return; }
        out.nodeValue = out.nodeValue.slice(0, -1);
        setTimeout(step, speed);
      })();
    }

    function cycle() {
      typeText(EN, 24, function () {
        setTimeout(function () {
          erase(8, function () {
            setTimeout(function () {
              typeText(CN, 42, function () {
                // three quiet minutes on the Chinese, then the loop turns over
                setTimeout(function () {
                  erase(22, function () {
                    setTimeout(cycle, 900);
                  });
                }, 180000);
              });
            }, 520);
          });
        }, 12000);
      });
    }

    cycle();
  }

  /* ------------------------------------------------------------------ boot */

  if (!storedTheme()) setThemeAttr(isNightHere() ? 'dark' : 'light');

  setInterval(function () { updateEphemeris(new Date()); }, 20000);
  sizeCanvases();
  updateEphemeris(new Date());
  moon.x = moon.tx;
  moon.y = moon.ty;
  syncSky();
  startTyping(startMotto);

  var levelTimer = setInterval(function () { updateLevels(Date.now()); }, 60);

  window.addEventListener('pagehide', function () { clearInterval(levelTimer); });
})();
