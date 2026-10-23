/* Procedural Gotham at night.
   Static layer: noise-textured clouds with the signal projected onto them, four depths of gothic / deco
   towers with lit facades and bloom, noise fog between layers, a rooftop foreground.
   Live layer: drifting fog, sweeping searchlights, aircraft beacons, rain at three depths, lightning.
   Film grain is a CSS overlay so it blends across both canvases. */
(function () {
  const BAT = new Path2D(
    "M50 13.5 L52.3 13.5 L54.3 4 L56.2 15 Q61 16.5 67 12.5 Q80 4.5 99 2.5 Q91 9 90.5 18.5 Q85.5 17 79.5 22.5 Q74.5 21.5 67.5 28 Q60.5 28 55 34 Q52 36 50 42.5 Q48 36 45 34 Q39.5 28 32.5 28 Q25.5 21.5 20.5 22.5 Q14.5 17 9.5 18.5 Q9 9 1 2.5 Q20 4.5 33 12.5 Q39 16.5 43.8 15 L45.7 4 L47.7 13.5 Z"
  );

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    const R = rng(seed);
    const P = new Uint8Array(256).map((_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
    const V = Float32Array.from({ length: 256 }, R);
    const h = (x, y) => V[P[(P[x & 255] + y) & 255]];
    const fade = (t) => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = fade(x - xi), v = fade(y - yi);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct = 5) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { s += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    }
    return { n2, fbm };
  }

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // Shared between the static render and the live layer
  let G = null;

  /* ───────────────────────── static scene ───────────────────────── */

  function draw(el) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = el.clientWidth, H = el.clientHeight;
    el.width = W * dpr; el.height = H * dpr;
    const c = el.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = rng(7);
    const r = (a, b) => a + R() * (b - a);
    const s = Math.max(1, Math.min(H / 650, 1.6));
    const N = makeNoise(3);

    const lights = canvas(W, H); // emissive pixels, bloomed at the end
    const L = lights.getContext("2d");

    // wide layouts put the signal above the centre column; the popup keeps it top-right
    const wide = W > 1000;
    const sx = wide ? W * 0.5 : W * 0.72, sy = wide ? H * 0.12 : H * 0.16;
    const sr = Math.max(80, Math.min(W * 0.17, H * 0.25, 250)) * (wide ? 0.8 : 1);
    const rx = sr * 0.62, ry = sr * 0.38;
    const beacons = [];

    // sky
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#020309");
    sky.addColorStop(0.4, "#070d1a");
    sky.addColorStop(0.68, "#13213a");
    sky.addColorStop(0.86, "#26344c");
    sky.addColorStop(1, "#3a3f4c"); // sodium haze over the streets
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // halo around the signal
    const halo = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
    halo.addColorStop(0, "rgba(190,205,230,0.22)");
    halo.addColorStop(0.4, "rgba(120,140,175,0.08)");
    halo.addColorStop(1, "rgba(120,140,175,0)");
    c.fillStyle = halo;
    c.fillRect(0, 0, W, H);

    // clouds: fbm density, lit by the city from below and by the signal, with the signal projected on them
    {
      const sc = 3, w = Math.ceil(W / sc), h = Math.ceil(H / sc);
      const m = canvas(w, h), mc = m.getContext("2d");
      mc.filter = "blur(0.5px)";
      mc.fillStyle = "#fff";
      mc.beginPath();
      mc.ellipse(sx / sc, sy / sc, rx / sc, ry / sc, -0.1, 0, Math.PI * 2);
      mc.fill();
      mc.globalCompositeOperation = "destination-out";
      mc.translate(sx / sc, sy / sc);
      mc.rotate(-0.1);
      const bw = (rx * 1.42) / sc, k = bw / 100;
      mc.translate(-bw / 2, -22 * k);
      mc.scale(k, k);
      mc.fill(BAT);
      const mask = mc.getImageData(0, 0, w, h).data;

      const cv = canvas(w, h), cc = cv.getContext("2d");
      const img = cc.createImageData(w, h), d = img.data;
      const zoom = 240 * Math.max(1, W / 900);
      for (let y = 0; y < h; y++) {
        const py = y * sc, yr = py / H;
        const horizon = smooth(0.2, 0.8, yr);
        const thin = 1 - smooth(0.42, 0.78, yr) * 0.9;
        for (let x = 0; x < w; x++) {
          const px = x * sc;
          // domain warp for wispy, wind-sheared shapes
          const wx = N.fbm(px / zoom + 3.1, py / (zoom * 0.5), 3);
          const n = N.fbm(px / (zoom * 1.6) + wx * 1.4, py / (zoom * 0.55) + wx * 0.6, 6);
          const dS = Math.hypot((px - sx) / (rx * 2.4), (py - sy) / (ry * 3.4));
          const lit = Math.exp(-dS * dS * 1.1);
          // keep a cloud deck around the signal so it has something to land on
          const dens = Math.min(1, smooth(0.4, 0.78, n) * thin + lit * 0.5 * smooth(0.25, 0.7, n));
          let rr = 30 + 70 * lit + 46 * horizon, gg = 38 + 76 * lit + 40 * horizon, bb = 54 + 86 * lit + 34 * horizon;
          // darker cores, brighter edges where light scatters through
          const core = smooth(0.62, 0.9, n);
          rr -= core * 14; gg -= core * 14; bb -= core * 12;
          let a = dens * 0.92;
          const mk = mask[(y * w + x) * 4 + 3] / 255;
          if (mk > 0) {
            const proj = mk * (0.14 + 0.86 * dens) * 0.9;
            rr += 170 * proj; gg += 178 * proj; bb += 192 * proj;
            a = Math.max(a, proj * 0.85);
          }
          const i = (y * w + x) * 4;
          d[i] = rr; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = a * 255;
        }
      }
      cc.putImageData(img, 0, 0);
      c.save();
      c.imageSmoothingQuality = "high";
      c.filter = "blur(0.8px)";
      c.drawImage(cv, 0, 0, W, H);
      c.restore();
    }

    // signal beam from a rooftop, textured by noise so it reads as light through rain and haze
    const bx = wide ? W * 0.57 : W * 0.6, by = H * 0.76;
    {
      const beam = canvas(W, H), b = beam.getContext("2d");
      b.filter = `blur(${Math.round(4 * s)}px)`;
      const bg = b.createLinearGradient(bx, by, sx, sy);
      bg.addColorStop(0, "rgba(225,232,245,0.30)");
      bg.addColorStop(0.5, "rgba(210,220,240,0.12)");
      bg.addColorStop(1, "rgba(210,220,240,0.05)");
      b.fillStyle = bg;
      b.beginPath();
      b.moveTo(bx - 4 * s, by);
      b.lineTo(bx + 4 * s, by);
      b.lineTo(sx + rx * 0.95, sy + ry * 0.4);
      b.lineTo(sx - rx * 0.95, sy - ry * 0.4);
      b.closePath();
      b.fill();
      b.filter = "none";
      b.globalCompositeOperation = "destination-out";
      b.drawImage(noiseCanvas(W, H, 5, 0.55, 0.9, 140), 0, 0);
      c.drawImage(beam, 0, 0);
    }

    // skyline
    const layers = [
      { top: [0.5, 0.64], color: [40, 54, 76], win: 0.05, dim: 0.35, glass: 0, rim: 0.04, fog: [74, 94, 122, 0.6], scale: 0.6 },
      { top: [0.5, 0.72], color: [22, 32, 50], win: 0.08, dim: 0.6, glass: 0.015, rim: 0.07, fog: [56, 72, 98, 0.5], scale: 0.78, landmark: true },
      { top: [0.6, 0.82], color: [11, 17, 28], win: 0.1, dim: 0.85, glass: 0.025, rim: 0.11, fog: [44, 54, 72, 0.42], scale: 0.95, street: true },
      { top: [0.7, 0.92], color: [4, 7, 12], win: 0.11, dim: 1, glass: 0.03, rim: 0.15, fog: null, scale: 1.25, neon: true },
    ];

    layers.forEach((ly, li) => {
      const col = `rgb(${ly.color})`;
      if (ly.street) {
        // sodium street light glowing up between the buildings
        const sg = c.createLinearGradient(0, H * 0.7, 0, H);
        sg.addColorStop(0, "rgba(255,170,95,0)");
        sg.addColorStop(1, "rgba(255,170,95,0.16)");
        c.fillStyle = sg;
        c.fillRect(0, H * 0.7, W, H * 0.3);
      }
      let x = -30;
      let neonLeft = ly.neon ? 2 : 0;
      while (x < W + 30) {
        const w = r(14, 40) * s * ly.scale;
        let top = r(ly.top[0], ly.top[1]) * H;
        if (R() < 0.1) top -= r(0.06, 0.16) * H; // the odd tall tower
        const isLandmark = ly.landmark && x <= W * 0.24 && x + w > W * 0.24;
        if (isLandmark) top = H * 0.3;
        const k = R();
        const kind = isLandmark ? "landmark" : k < 0.2 ? "deco" : k < 0.3 ? "gothic" : k < 0.6 ? "roof" : "flat";
        building(x, isLandmark ? Math.max(w, 46 * s) : w, top, kind, ly, li, col);
        if (neonLeft && x > W * 0.05 && R() < 0.12) {
          neon(x + w * r(0.2, 0.7), top + r(10, 40) * s, R() < 0.6 ? "255,70,60" : "90,220,230");
          neonLeft--;
        }
        x += (isLandmark ? Math.max(w, 46 * s) : w) + (R() < 0.3 ? r(1, 8) * s : 0);
      }
      if (ly.fog) fogBand(ly.top[0] * H - 40 * s, H, ly.fog, li);
    });

    function building(x, w, top, kind, ly, li, col) {
      c.fillStyle = col;
      if (kind === "landmark") {
        // art-deco tower: setbacks, lit crown bands, spire
        const tiers = [[0, 0], [0.12, 22], [0.24, 40], [0.36, 56]];
        tiers.forEach(([inset, up]) => c.fillRect(x + w * inset, top - up * s, w * (1 - inset * 2), H));
        const spTop = top - 120 * s;
        c.beginPath();
        c.moveTo(x + w * 0.44, top - 56 * s);
        c.lineTo(x + w * 0.5, spTop);
        c.lineTo(x + w * 0.56, top - 56 * s);
        c.fill();
        beacons.push({ x: x + w * 0.5, y: spTop + 2 * s, p: R() });
        for (let i = 0; i < 4; i++) {
          const yy = top - (8 + i * 14) * s;
          const inset = 0.08 + i * 0.1;
          L.fillStyle = `rgba(255,214,160,${0.5 - i * 0.08})`;
          L.fillRect(x + w * inset, yy, w * (1 - inset * 2), 1.4 * s);
        }
      } else if (kind === "deco") {
        c.fillRect(x, top, w, H);
        const t2 = r(10, 22) * s;
        c.fillRect(x + w * 0.15, top - t2, w * 0.7, t2 + 1);
        c.fillRect(x + w * 0.3, top - t2 - 12 * s, w * 0.4, 13 * s);
        if (R() < 0.6) {
          const h = r(18, 36) * s;
          c.fillRect(x + w * 0.5 - 0.6 * s, top - t2 - 12 * s - h, 1.2 * s, h);
          beacons.push({ x: x + w * 0.5, y: top - t2 - 12 * s - h, p: R() });
        }
      } else if (kind === "gothic") {
        c.fillRect(x, top, w, H);
        const peak = r(30, 60) * s;
        const sw = Math.min(w * 0.4, 9 * s);
        c.fillRect(x + w / 2 - sw / 2, top - peak * 0.35, sw, peak * 0.35 + 1);
        c.beginPath();
        c.moveTo(x + w / 2 - sw / 2, top - peak * 0.35);
        c.lineTo(x + w / 2, top - peak);
        c.lineTo(x + w / 2 + sw / 2, top - peak * 0.35);
        c.fill();
        // corner pinnacles
        for (const px of [x + 1.5 * s, x + w - 1.5 * s]) {
          c.beginPath();
          c.moveTo(px - 2 * s, top);
          c.lineTo(px, top - peak * 0.3);
          c.lineTo(px + 2 * s, top);
          c.fill();
        }
        // rose window on nearer layers
        if (li >= 2 && R() < 0.5) {
          L.fillStyle = "rgba(255,190,120,0.35)";
          L.beginPath();
          L.arc(x + w / 2, top + 6 * s, Math.min(w * 0.12, 3 * s), 0, Math.PI * 2);
          L.fill();
        }
      } else if (kind === "roof") {
        c.fillRect(x, top, w, H);
        if (R() < 0.6) {
          // water tank on stilts
          const tx = x + w * r(0.2, 0.6), tw = Math.min(w * 0.35, 12 * s), th = tw * 0.9;
          c.fillRect(tx, top - th - 5 * s, tw, th);
          c.beginPath();
          c.moveTo(tx - 1, top - th - 5 * s);
          c.lineTo(tx + tw / 2, top - th - 10 * s);
          c.lineTo(tx + tw + 1, top - th - 5 * s);
          c.fill();
          c.fillRect(tx + 1, top - 5 * s, 1 * s, 5 * s);
          c.fillRect(tx + tw - 2 * s, top - 5 * s, 1 * s, 5 * s);
        } else {
          const h = r(14, 30) * s;
          c.fillRect(x + w * 0.7, top - h, 1.2 * s, h);
          beacons.push({ x: x + w * 0.7 + 0.6 * s, y: top - h, p: R() });
        }
      } else {
        c.fillRect(x, top, w, H);
        if (R() < 0.5) c.fillRect(x + w * r(0.1, 0.5), top - 4 * s, w * 0.3, 4 * s); // plant room
      }

      // facade texture: pilasters, a faint glass grid, lit windows
      const step = 3.4 * s * ly.scale;
      const ww = 1.1 * s * ly.scale, wh = 1.7 * s * ly.scale;
      if (ly.glass) {
        c.fillStyle = `rgba(150,170,200,${ly.glass})`;
        for (let px = x + step * 0.6; px < x + w - step * 0.4; px += step) c.fillRect(px, top + step, ww, H - top);
      }
      // lit windows cluster on floors, like real offices
      for (let wy = top + step; wy < H; wy += step * 1.15) {
        const floorLit = R() < 0.35 ? 3.5 : 0.6;
        for (let wx = x + step * 0.6; wx < x + w - step * 0.4; wx += step) {
          if (R() < ly.win * floorLit) {
            const warm = R() < 0.8;
            const a = r(0.4, 0.95) * ly.dim;
            const rgb = warm ? (R() < 0.5 ? "255,206,140" : "255,226,180") : "185,210,255";
            c.fillStyle = `rgba(${rgb},${a})`;
            c.fillRect(wx, wy, ww, wh);
            L.fillStyle = `rgba(${rgb},${a * 0.8})`;
            L.fillRect(wx, wy, ww, wh);
          }
        }
      }
      // rim light: roof edge and the face turned toward the signal
      c.fillStyle = `rgba(160,185,220,${ly.rim})`;
      c.fillRect(x, top, w, Math.max(1, 0.8 * s));
      if (x + w < sx) c.fillRect(x + w - Math.max(1, 0.8 * s), top, Math.max(1, 0.8 * s), (H - top) * 0.6);
    }

    function neon(x, y, rgb) {
      const h = r(14, 26) * s, w = 3.2 * s;
      c.fillStyle = `rgba(${rgb},0.85)`;
      c.fillRect(x, y, w, h);
      L.fillStyle = `rgba(${rgb},1)`;
      L.fillRect(x - 1, y - 1, w + 2, h + 2);
    }

    function fogBand(y0, y1, [fr, fg, fb, fa], seed) {
      const sc = 4, w = Math.ceil(W / sc), h = Math.ceil((y1 - y0) / sc);
      const cv = canvas(w, h), cc = cv.getContext("2d");
      const img = cc.createImageData(w, h), d = img.data;
      const Nf = makeNoise(20 + seed);
      for (let y = 0; y < h; y++) {
        const v = smooth(0, 1, y / h);
        for (let x = 0; x < w; x++) {
          const n = Nf.fbm((x * sc) / 180, (y * sc) / 60, 4);
          const i = (y * w + x) * 4;
          d[i] = fr; d[i + 1] = fg; d[i + 2] = fb;
          d[i + 3] = Math.min(1, v * (0.35 + n * 0.9)) * fa * 255;
        }
      }
      cc.putImageData(img, 0, 0);
      c.drawImage(cv, 0, y0, W, y1 - y0);
    }

    // bloom: window light bleeding into the wet air
    c.save();
    c.globalCompositeOperation = "lighter";
    c.filter = `blur(${2 * s}px)`;
    c.globalAlpha = 0.9;
    c.drawImage(lights, 0, 0);
    c.filter = `blur(${9 * s}px)`;
    c.globalAlpha = 0.7;
    c.drawImage(lights, 0, 0);
    c.restore();

    // grade + vignette
    const v = c.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,2,6,0.7)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);

    G = { W, H, s, beacons, sx, sy, sr, bx, by };
  }

  // alpha-noise canvas; used to break up the beam and as drifting fog
  function noiseCanvas(W, H, seed, lo, hi, scale) {
    const sc = 4, w = Math.ceil(W / sc), h = Math.ceil(H / sc);
    const cv = canvas(w, h), cc = cv.getContext("2d");
    const img = cc.createImageData(w, h), d = img.data;
    const N = makeNoise(seed);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 0;
        d[i + 3] = smooth(lo, hi, N.fbm((x * sc) / scale, (y * sc) / scale, 4)) * 255;
      }
    cc.putImageData(img, 0, 0);
    const out = canvas(W, H);
    out.getContext("2d").drawImage(cv, 0, 0, W, H);
    return out;
  }

  // horizontally tileable fog texture
  function fogTexture(W, h, seed, rgb) {
    const sc = 4, w = Math.ceil(W / sc), hh = Math.ceil(h / sc);
    const cv = canvas(w, hh), cc = cv.getContext("2d");
    const img = cc.createImageData(w, hh), d = img.data;
    const N = makeNoise(seed);
    for (let y = 0; y < hh; y++) {
      const v = Math.sin((y / hh) * Math.PI);
      for (let x = 0; x < w; x++) {
        const t = x / w;
        const fx = (x * sc) / 220, fy = (y * sc) / 70;
        const n = N.fbm(fx, fy, 4) * (1 - t) + N.fbm(fx + (w * sc) / 220, fy, 4) * t;
        const i = (y * w + x) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
        d[i + 3] = smooth(0.35, 0.85, n) * v * 255;
      }
    }
    cc.putImageData(img, 0, 0);
    return cv;
  }

  /* ───────────────────────── live layer ───────────────────────── */

  function live(el) {
    const ctx = el.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const R = rng(11);
    let W, H, drops, fogA, fogB, beamSprite, searchlights;
    let flash = 0, nextFlash = performance.now() + 9000 + R() * 15000;

    function setup() {
      W = el.clientWidth; H = el.clientHeight;
      el.width = W; el.height = H; // 1x is plenty for soft effects
      const area = (W * H) / 2400;
      drops = [];
      [[0.45, 0.045, 5, 6, 0.6], [0.35, 0.08, 9, 10, 0.9], [0.2, 0.15, 16, 16, 1.3]].forEach(([share, a, len, v, lw]) => {
        for (let i = 0; i < area * share; i++)
          drops.push({ x: R() * W, y: R() * H, l: len * (0.7 + R() * 0.6), v: v * (0.8 + R() * 0.5), a: a * (0.6 + R() * 0.8), lw });
      });
      fogA = fogTexture(W, H * 0.35, 31, [110, 128, 158]);
      fogB = fogTexture(W, H * 0.3, 47, [80, 96, 124]);

      // one searchlight beam sprite, rotated per frame
      const bh = Math.hypot(W, H) * 0.9, bw = 90;
      beamSprite = canvas(bw, bh);
      const b = beamSprite.getContext("2d");
      const gx = b.createLinearGradient(0, 0, bw, 0);
      gx.addColorStop(0, "rgba(200,215,240,0)");
      gx.addColorStop(0.5, "rgba(200,215,240,1)");
      gx.addColorStop(1, "rgba(200,215,240,0)");
      b.fillStyle = gx;
      b.beginPath();
      b.moveTo(bw / 2 - 3, bh);
      b.lineTo(bw / 2 + 3, bh);
      b.lineTo(bw, 0);
      b.lineTo(0, 0);
      b.fill();
      b.globalCompositeOperation = "destination-in";
      const gy = b.createLinearGradient(0, bh, 0, 0);
      gy.addColorStop(0, "rgba(0,0,0,0.5)");
      gy.addColorStop(0.5, "rgba(0,0,0,0.15)");
      gy.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = gy;
      b.fillRect(0, 0, bw, bh);

      searchlights = [
        { x: W * 0.12, y: H * 0.74, base: -0.35, amp: 0.28, sp: 0.09, ph: 0 },
        { x: W * 0.9, y: H * 0.72, base: 0.4, amp: 0.25, sp: 0.07, ph: 2 },
      ];
      if (W > 760) searchlights.push({ x: W * 0.42, y: H * 0.78, base: -0.1, amp: 0.4, sp: 0.05, ph: 4 });
    }

    function frame(t) {
      const sec = t / 1000;
      ctx.clearRect(0, 0, W, H);

      // searchlights
      ctx.globalCompositeOperation = "lighter";
      for (const l of searchlights) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.translate(l.x, l.y);
        ctx.rotate(l.base + Math.sin(sec * l.sp * Math.PI * 2 * 0.25 + l.ph) * l.amp);
        ctx.drawImage(beamSprite, -beamSprite.width / 2, -beamSprite.height);
        ctx.restore();
      }

      // drifting fog
      ctx.globalCompositeOperation = "source-over";
      const drift = (img, y, speed, alpha) => {
        const off = ((sec * speed) % W + W) % W;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -off, y, W, img.height * 4);
        ctx.drawImage(img, W - off, y, W, img.height * 4);
      };
      drift(fogA, H * 0.5, 7, 0.32);
      drift(fogB, H * 0.68, 13, 0.38);
      ctx.globalAlpha = 1;

      // aircraft beacons
      if (G) {
        for (const b of G.beacons) {
          const on = ((sec * 0.45 + b.p) % 1) < 0.18;
          if (!on) continue;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6 * G.s);
          g.addColorStop(0, "rgba(255,70,60,0.95)");
          g.addColorStop(0.3, "rgba(255,60,50,0.35)");
          g.addColorStop(1, "rgba(255,60,50,0)");
          ctx.fillStyle = g;
          ctx.fillRect(b.x - 6 * G.s, b.y - 6 * G.s, 12 * G.s, 12 * G.s);
        }
      }

      // lightning: a double flicker lighting the cloud deck
      if (!still && t > nextFlash) {
        flash = 1;
        nextFlash = t + 14000 + R() * 26000;
      }
      if (flash > 0.01) {
        const f = flash * (0.6 + 0.4 * Math.sin(t / 30));
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
        g.addColorStop(0, `rgba(190,205,240,${0.22 * f})`);
        g.addColorStop(1, "rgba(190,205,240,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        flash *= 0.86;
      }

      // rain
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.strokeStyle = `rgba(200,212,235,${d.a})`;
        ctx.lineWidth = d.lw;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.2, d.y + d.l);
        ctx.stroke();
        if (!still) {
          d.y += d.v;
          d.x -= d.v * 0.2;
          if (d.y > H) { d.y = -d.l - R() * 40; d.x = R() * (W + 60); }
        }
      }
    }

    setup();
    window.addEventListener("resize", setup);
    if (still) { frame(0); return; }
    let last = 0;
    (function loop(t) {
      requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      frame(t);
    })(0);
  }

  // film grain as a CSS overlay so it blends over everything underneath
  function grain() {
    const n = canvas(180, 180), g = n.getContext("2d");
    const img = g.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const el = document.createElement("div");
    el.className = "grain";
    el.style.backgroundImage = `url(${n.toDataURL()})`;
    document.body.insertBefore(el, document.body.querySelector(".app"));
  }

  window.NightScene = {
    mount(sceneEl, liveEl) {
      draw(sceneEl);
      let t;
      window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => draw(sceneEl), 150); });
      if (liveEl) live(liveEl);
      grain();
    },
  };
})();
