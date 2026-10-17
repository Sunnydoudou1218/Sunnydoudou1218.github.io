(function () {
  'use strict';

  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ theme */

  var themeBtn = document.getElementById('theme-toggle');

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return darkQuery.matches ? 'dark' : 'light';
  }

  function isDark() { return currentTheme() === 'dark'; }

  function applyTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncSky();
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

  /* ---------------------------------------------------------------- topbar */

  var bar = document.querySelector('.topbar');
  if (bar) {
    var onScroll = function () {
      if (window.scrollY > 8) bar.classList.add('scrolled');
      else bar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------------- clock */

  var clockEl = document.getElementById('clock');
  if (clockEl) {
    var timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false
    });
    var tick = function () { clockEl.textContent = timeFmt.format(new Date()); };
    tick();
    setInterval(tick, 10000);
  }

  /* -------------------------------------------------------------- visitors */

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

  /* ----------------------------------------------------------------- email */

  var mailLink = document.getElementById('email');
  if (mailLink) {
    var address = 'lu_yue0312' + String.fromCharCode(64) + '163.com';
    mailLink.href = 'mailto:' + address;
    mailLink.textContent = address;
    mailLink.removeAttribute('rel');
  }

  /* --------------------------------------------------------------- canvases */

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
    buildStars();
  }

  window.addEventListener('resize', sizeCanvases);

  /* ------------------------------------------------------------------- sky */

  var stars = [];
  var streaks = [];
  var skyRunning = false;
  var skyLast = 0;
  var streakWait = 5000;

  function buildStars() {
    var count = Math.round((W * H) / 9000);
    count = Math.max(70, Math.min(230, count));
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

  function drawMoon(ctx, now) {
    var r = Math.max(24, Math.min(44, W * 0.033));
    var cx = W - Math.max(64, W * 0.13);
    var cy = Math.max(86, H * 0.15);
    var breathe = 1 + Math.sin(now * 0.00016) * 0.06;

    var glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3.6 * breathe);
    glow.addColorStop(0, 'rgba(243, 239, 226, 0.13)');
    glow.addColorStop(0.45, 'rgba(243, 239, 226, 0.05)');
    glow.addColorStop(1, 'rgba(243, 239, 226, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 3.6 * breathe, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(246, 242, 231, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + r * 0.58, cy - r * 0.3, r * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

  function skyFrame(now) {
    if (!skyRunning) return;
    var dt = skyLast ? Math.min(64, now - skyLast) : 16;
    skyLast = now;

    skyCtx.clearRect(0, 0, W, H);
    drawMoon(skyCtx, now);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.drift * dt;
      if (s.x > W + 2) s.x = -2;
      var twinkle = 0.55 + 0.45 * Math.sin(now * s.speed + s.phase);
      var alpha = s.a * twinkle;
      if (alpha <= 0.02) continue;
      skyCtx.fillStyle = 'rgba(238, 242, 252, ' + alpha.toFixed(3) + ')';
      skyCtx.beginPath();
      skyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      skyCtx.fill();
    }

    if (!calmQuery.matches) {
      streakWait -= dt;
      if (streakWait <= 0) {
        streakWait = 7000 + Math.random() * 9000;
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
    skyCtx.clearRect(0, 0, W, H);
    streaks = [];
  }

  function syncSky() {
    if (isDark() && !document.hidden) startSky();
    else stopSky();
  }

  document.addEventListener('visibilitychange', syncSky);

  /* ---------------------------------------------------------------- effects */

  var particles = [];
  var rockets = [];
  var balloons = [];
  var fxRunning = false;
  var fxLast = 0;

  var PALETTE = ['#e2695d', '#d94a3d', '#74a9d8', '#4a86c8', '#f0d9a8', '#f5f2ea'];

  function fxStart() {
    if (fxRunning) return;
    fxRunning = true;
    fxLast = 0;
    requestAnimationFrame(fxFrame);
  }

  function explode(x, y) {
    var count = calmQuery.matches ? 34 : 78 + Math.round(Math.random() * 34);
    var base = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    particles.push({
      ring: true, x: x, y: y, age: 0, max: 620,
      color: base, size: 1
    });
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 40 + Math.random() * 210;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        max: 900 + Math.random() * 900,
        color: Math.random() < 0.72 ? base : PALETTE[Math.floor(Math.random() * PALETTE.length)],
        size: 1.0 + Math.random() * 1.8
      });
    }
  }

  function fxFrame(now) {
    var dt = fxLast ? Math.min(48, now - fxLast) : 16;
    fxLast = now;

    fxCtx.clearRect(0, 0, W, H);
    fxCtx.globalCompositeOperation = isDark() ? 'lighter' : 'source-over';

    for (var r = rockets.length - 1; r >= 0; r--) {
      var rk = rockets[r];
      rk.age += dt;
      var p = Math.min(1, rk.age / rk.flight);
      rk.y = H + 8 - (H + 8 - rk.ty) * (1 - Math.pow(1 - p, 2));
      fxCtx.fillStyle = 'rgba(255, 236, 200, 0.9)';
      fxCtx.beginPath();
      fxCtx.arc(rk.x, rk.y, 1.7, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.fillStyle = 'rgba(255, 200, 140, 0.22)';
      fxCtx.beginPath();
      fxCtx.arc(rk.x, rk.y + 8, 2.6, 0, Math.PI * 2);
      fxCtx.fill();
      if (p >= 1) {
        explode(rk.x, rk.y);
        rockets.splice(r, 1);
      }
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var pt = particles[i];
      pt.age += dt;
      if (pt.age > pt.max) { particles.splice(i, 1); continue; }
      var k = 1 - pt.age / pt.max;

      if (pt.ring) {
        var rr = 6 + (1 - k) * 64;
        fxCtx.globalAlpha = k * 0.55;
        fxCtx.strokeStyle = pt.color;
        fxCtx.lineWidth = 1.6 * k + 0.4;
        fxCtx.beginPath();
        fxCtx.arc(pt.x, pt.y, rr, 0, Math.PI * 2);
        fxCtx.stroke();
        continue;
      }

      pt.vy += 0.000155 * dt * 60;
      pt.vx *= 0.9985; pt.vy *= 0.9985;
      pt.x += pt.vx * dt / 16.6;
      pt.y += pt.vy * dt / 16.6;
      fxCtx.globalAlpha = Math.max(0, k) * 0.92;
      fxCtx.fillStyle = pt.color;
      fxCtx.beginPath();
      fxCtx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;

    fxCtx.globalCompositeOperation = 'source-over';

    for (var b = balloons.length - 1; b >= 0; b--) {
      var bl = balloons[b];
      bl.age += dt;
      bl.y += bl.vy * dt / 1000;
      var sway = Math.sin(bl.age * 0.0016 + bl.phase) * bl.amp;
      var x = bl.x + sway;
      if (bl.y < -140) { balloons.splice(b, 1); continue; }

      var grd = fxCtx.createRadialGradient(x - bl.r * 0.35, bl.y - bl.r * 0.4, bl.r * 0.1, x, bl.y, bl.r * 1.15);
      grd.addColorStop(0, bl.light);
      grd.addColorStop(1, bl.color);
      fxCtx.fillStyle = grd;
      fxCtx.beginPath();
      fxCtx.ellipse(x, bl.y, bl.r * 0.82, bl.r, 0, 0, Math.PI * 2);
      fxCtx.fill();

      fxCtx.fillStyle = bl.color;
      fxCtx.beginPath();
      fxCtx.moveTo(x - 2.6, bl.y + bl.r * 0.96);
      fxCtx.lineTo(x + 2.6, bl.y + bl.r * 0.96);
      fxCtx.lineTo(x, bl.y + bl.r * 1.14);
      fxCtx.closePath();
      fxCtx.fill();

      fxCtx.strokeStyle = 'rgba(226, 222, 210, 0.5)';
      fxCtx.lineWidth = 0.9;
      fxCtx.beginPath();
      fxCtx.moveTo(x, bl.y + bl.r * 1.1);
      for (var s = 1; s <= 10; s++) {
        var t = s / 10;
        fxCtx.lineTo(x + Math.sin(bl.age * 0.002 + t * 3.2) * 4.5 * t, bl.y + bl.r * 1.1 + t * 44);
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
    var n = count || 3;
    for (var i = 0; i < n; i++) {
      (function (delay) {
        setTimeout(function () {
          rockets.push({
            x: W * (0.18 + Math.random() * 0.64),
            y: H + 8,
            ty: H * (0.16 + Math.random() * 0.22),
            age: 0,
            flight: 620 + Math.random() * 320
          });
          fxStart();
        }, delay);
      })(i * 230);
    }
  }

  function releaseBalloons(anchor) {
    var rect = anchor.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height * 0.32;
    var n = 6;
    for (var i = 0; i < n; i++) {
      balloons.push({
        x: cx + (Math.random() - 0.5) * rect.width * 1.4,
        y: cy + (Math.random() - 0.5) * 30,
        r: 15 + Math.random() * 9,
        vy: -(34 + Math.random() * 26),
        phase: Math.random() * Math.PI * 2,
        amp: 7 + Math.random() * 11,
        age: 0,
        color: i % 2 ? '#c4402f' : '#3f7fbf',
        light: i % 2 ? '#e8897a' : '#8ab4dd'
      });
    }
    fxStart();
  }

  var portrait = document.getElementById('portrait');
  if (portrait) {
    portrait.addEventListener('click', function () { releaseBalloons(portrait); });
  }

  var fwBtn = document.getElementById('fw-btn');
  if (fwBtn) {
    fwBtn.addEventListener('click', function () { launch(4); });
  }

  var balloonBtn = document.getElementById('balloon-btn');
  if (balloonBtn) {
    balloonBtn.addEventListener('click', function () {
      releaseBalloons(portrait || balloonBtn);
    });
  }

  /* ----------------------------------------------------------------- music */

  var audio = document.getElementById('player');
  var musicBtn = document.getElementById('music-btn');
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

  if (audio && musicBtn) {
    audio.volume = 0;
    musicBtn.addEventListener('click', function () {
      if (audio.paused) {
        audio.volume = 0;
        var played = audio.play();
        if (played && played.then) {
          played.then(function () {
            musicBtn.classList.add('playing');
            fadeTo(0.32, 900);
          }).catch(function () {});
        } else {
          musicBtn.classList.add('playing');
          fadeTo(0.32, 900);
        }
      } else {
        fadeTo(0, 320, function () { audio.pause(); });
        musicBtn.classList.remove('playing');
      }
    });
    audio.addEventListener('pause', function () { musicBtn.classList.remove('playing'); });
    audio.addEventListener('play', function () { musicBtn.classList.add('playing'); });
    audio.addEventListener('error', function () {
      musicBtn.disabled = true;
      musicBtn.title = 'Audio unavailable';
    });
  }

  /* ------------------------------------------------------------------ boot */

  sizeCanvases();
  syncSky();
})();
