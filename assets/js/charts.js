/* ==========================================================================
   Amnu Fashion — tiny dependency-free SVG/HTML charts for the admin
   area(): single-series area/line with crosshair tooltip + keyboard + table
   spark(): inline sparkline        columns(): thin rounded columns
   hbars(): ranked horizontal bars   (colours come from --viz-* CSS variables)
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs = {}, parent) => {
    const e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };

  /* clean axis ticks: 0 … niceMax */
  function niceScale(max, count = 4) {
    if (max <= 0) return { max: 1, ticks: [0, 1] };
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 1000; v += step) ticks.push(v);
    return { max: top, ticks };
  }

  /* monotone cubic interpolation → smooth line that never overshoots the data */
  function monotonePath(pts) {
    const n = pts.length;
    if (n < 2) return '';
    if (n === 2) return `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}`;
    const dx = []; const m = []; const t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${pts[i][0] + h} ${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
    }
    return d;
  }

  const tipFor = (host) => {
    let tip = host.querySelector('.viz-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip'; tip.setAttribute('role', 'status'); host.appendChild(tip); }
    return tip;
  };
  const placeTip = (host, tip, x, y) => {
    const w = tip.offsetWidth; const h = tip.offsetHeight;
    let left = x + 14; if (left + w > host.clientWidth - 4) left = x - w - 14;
    tip.style.transform = `translate(${Math.max(4, left)}px, ${Math.max(4, y - h / 2)}px)`;
  };

  /* ------------------------------------------------------------------ area */
  /** data: [{ x: Date|string, y: number, label?: string }]   opts: { height, fmt, name, id } */
  function area(host, data, opts = {}) {
    const fmt = opts.fmt || A.money;
    const name = opts.name || 'Value';
    const H = opts.height || 280;
    host.classList.add('viz');
    host.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'viz-stage';
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', `${name} chart. Use left and right arrow keys to inspect values.`);
    host.appendChild(stage);

    const draw = () => {
      const W = Math.max(280, stage.clientWidth || host.clientWidth);
      stage.querySelectorAll('svg').forEach((s) => s.remove());
      const m = { l: 54, r: 18, t: 16, b: 30 };
      const iw = W - m.l - m.r; const ih = H - m.t - m.b;
      const scale = niceScale(Math.max(...data.map((d) => d.y)) * 1.05);
      const X = (i) => m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
      const Y = (v) => m.t + ih - (v / scale.max) * ih;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-hidden': 'true' });
      stage.insertBefore(svg, stage.firstChild);

      scale.ticks.forEach((v) => {
        svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'viz-grid' }, svg);
        const t = svgEl('text', { x: m.l - 10, y: Y(v) + 4, class: 'viz-axis', 'text-anchor': 'end' }, svg);
        t.textContent = v === 0 ? '0' : (opts.axisFmt || ((n) => '৳' + A.compact(n)))(v);
      });
      const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 78))));
      data.forEach((d, i) => {
        if (i % every !== 0 && i !== data.length - 1) return;
        if (i !== data.length - 1 && data.length - 1 - i < Math.ceil(every * 0.8)) return;
        const t = svgEl('text', { x: X(i), y: H - 8, class: 'viz-axis', 'text-anchor': i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle' }, svg);
        t.textContent = d.label || A.dateShort(d.x);
      });

      const pts = data.map((d, i) => [X(i), Y(d.y)]);
      const line = monotonePath(pts);
      const gid = 'g' + A.uid();
      const defs = svgEl('defs', {}, svg);
      const lg = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svgEl('stop', { offset: '0', 'stop-color': 'var(--viz-1)', 'stop-opacity': '.2' }, lg);
      svgEl('stop', { offset: '1', 'stop-color': 'var(--viz-1)', 'stop-opacity': '0' }, lg);
      svgEl('path', { d: `${line}L${X(data.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`, fill: `url(#${gid})` }, svg);
      svgEl('path', { d: line, class: 'viz-line' }, svg);

      /* end-dot with surface ring */
      const last = pts[pts.length - 1];
      svgEl('circle', { cx: last[0], cy: last[1], r: 4, class: 'viz-dot' }, svg);

      /* hover layer */
      const cross = svgEl('line', { class: 'viz-cross', y1: m.t, y2: m.t + ih, opacity: 0 }, svg);
      const dot = svgEl('circle', { r: 5, class: 'viz-dot', opacity: 0 }, svg);
      const tip = tipFor(stage);
      let cur = -1;
      const show = (i) => {
        i = A.clamp(i, 0, data.length - 1); cur = i;
        const d = data[i];
        const prev = data[i - 1];
        cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 1);
        dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(d.y)); dot.setAttribute('opacity', 1);
        const delta = prev && prev.y ? ((d.y - prev.y) / prev.y) * 100 : null;
        tip.innerHTML = `<div class="viz-tip-h">${A.esc(d.tip || A.dateShort(d.x))}</div><div class="viz-tip-r"><span class="viz-key"></span>${A.esc(name)}<b>${fmt(d.y)}</b></div>${delta == null ? '' : `<div class="viz-tip-s">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% vs previous</div>`}`;
        tip.classList.add('on');
        placeTip(stage, tip, X(i), Y(d.y));
      };
      const hide = () => { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); tip.classList.remove('on'); cur = -1; };
      stage.onpointermove = (e) => {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left;
        show(Math.round(((px - m.l) / iw) * (data.length - 1)));
      };
      stage.onpointerleave = hide;
      stage.onblur = hide;
      stage.onkeydown = (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); show(cur < 0 ? 0 : cur + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur < 0 ? data.length - 1 : cur - 1); }
        if (e.key === 'Escape') hide();
      };
    };
    draw();
    if (opts.table !== false) {
      const det = document.createElement('details');
      det.className = 'viz-table';
      det.innerHTML = `<summary>View as table</summary><div class="table-wrap"><table class="viz-t"><thead><tr><th>Date</th><th class="right">${A.esc(name)}</th></tr></thead><tbody>${data.map((d) => `<tr><td>${A.esc(d.tip || A.dateShort(d.x))}</td><td class="right num">${fmt(d.y)}</td></tr>`).join('')}</tbody></table></div>`;
      host.appendChild(det);
    }
    if (window.ResizeObserver) {
      let w = stage.clientWidth;
      new ResizeObserver(() => { if (Math.abs(stage.clientWidth - w) > 2) { w = stage.clientWidth; draw(); } }).observe(stage);
    }
    return { redraw: draw };
  }

  /* ----------------------------------------------------------------- spark */
  function spark(host, values, opts = {}) {
    const W = opts.width || 96; const H = opts.height || 36; const pad = 4;
    const max = Math.max(...values); const min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), H - pad - ((v - min) / span) * (H - pad * 2)]);
    const last = pts[pts.length - 1];
    host.innerHTML = `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${monotonePath(pts)}" class="viz-line"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" class="viz-dot"/></svg>`;
  }

  /* --------------------------------------------------------------- columns */
  /** data: [{ label, value, tip? }] */
  function columns(host, data, opts = {}) {
    const fmt = opts.fmt || ((n) => String(n));
    const name = opts.name || 'Value';
    const H = opts.height || 220;
    host.classList.add('viz');
    host.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'viz-stage';
    host.appendChild(stage);
    const draw = () => {
      stage.querySelectorAll('svg').forEach((s) => s.remove());
      const W = Math.max(280, stage.clientWidth);
      const m = { l: 40, r: 10, t: 14, b: 28 };
      const iw = W - m.l - m.r; const ih = H - m.t - m.b;
      const scale = niceScale(Math.max(...data.map((d) => d.value)) * 1.05, 4);
      const band = iw / data.length;
      const bw = Math.min(24, band * 0.62);
      const Y = (v) => m.t + ih - (v / scale.max) * ih;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
      stage.insertBefore(svg, stage.firstChild);
      scale.ticks.forEach((v) => {
        svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'viz-grid' }, svg);
        svgEl('text', { x: m.l - 8, y: Y(v) + 4, class: 'viz-axis', 'text-anchor': 'end' }, svg).textContent = A.compact(v);
      });
      const every = Math.max(1, Math.ceil(data.length / Math.floor(iw / 56)));
      const tip = tipFor(stage);
      data.forEach((d, i) => {
        const x = m.l + band * i + (band - bw) / 2;
        const y = Y(d.value); const r = Math.min(4, bw / 2, ih - (y - m.t));
        const path = d.value <= 0 ? '' : `M${x} ${Y(0)}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${Y(0)}Z`;
        const bar = svgEl('path', { d: path, class: 'viz-bar' }, svg);
        const hit = svgEl('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, fill: 'transparent' }, svg);
        hit.addEventListener('pointerenter', () => {
          bar.classList.add('hot');
          tip.innerHTML = `<div class="viz-tip-h">${A.esc(d.tip || d.label)}</div><div class="viz-tip-r"><span class="viz-key"></span>${A.esc(name)}<b>${fmt(d.value)}</b></div>`;
          tip.classList.add('on'); placeTip(stage, tip, x + bw / 2, y);
        });
        hit.addEventListener('pointerleave', () => { bar.classList.remove('hot'); tip.classList.remove('on'); });
        if (i % every === 0) svgEl('text', { x: x + bw / 2, y: H - 8, class: 'viz-axis', 'text-anchor': 'middle' }, svg).textContent = d.label;
      });
    };
    draw();
    if (window.ResizeObserver) { let w = stage.clientWidth; new ResizeObserver(() => { if (Math.abs(stage.clientWidth - w) > 2) { w = stage.clientWidth; draw(); } }).observe(stage); }
  }

  /* --------------------------------------------------------------- stacked */
  /** data: [{ label, tip?, values: [n, n] }]  series: [{ name, cls }]  – legend + per-day tooltip with total */
  function stacked(host, data, series, opts = {}) {
    const fmt = opts.fmt || A.money;
    const H = opts.height || 260;
    host.classList.add('viz');
    host.innerHTML = `<div class="viz-legend">${series.map((s) => `<span><i class="${s.cls}"></i>${A.esc(s.name)}</span>`).join('')}</div>`;
    const stage = document.createElement('div');
    stage.className = 'viz-stage';
    host.appendChild(stage);
    const draw = () => {
      stage.querySelectorAll('svg').forEach((x) => x.remove());
      const W = Math.max(280, stage.clientWidth);
      const m = { l: 54, r: 10, t: 14, b: 28 };
      const iw = W - m.l - m.r; const ih = H - m.t - m.b;
      const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
      const scale = niceScale(Math.max(...totals, 1) * 1.05, 4);
      const band = iw / data.length;
      const bw = Math.min(24, band * 0.62);
      const Y = (v) => m.t + ih - (v / scale.max) * ih;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
      stage.insertBefore(svg, stage.firstChild);
      scale.ticks.forEach((v) => {
        svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'viz-grid' }, svg);
        svgEl('text', { x: m.l - 10, y: Y(v) + 4, class: 'viz-axis', 'text-anchor': 'end' }, svg).textContent = v === 0 ? '0' : '৳' + A.compact(v);
      });
      const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 60))));
      const tip = tipFor(stage);
      data.forEach((d, i) => {
        const x = m.l + band * i + (band - bw) / 2;
        let base = Y(0);
        const last = d.values.reduce((k, v, j) => (v > 0 ? j : k), -1);
        const bars = [];
        d.values.forEach((v, k) => {
          if (v <= 0) return;
          const h = (v / scale.max) * ih;
          const gap = k < last ? 2 : 0;                 /* 2px surface gap between stacked segments */
          const top = base - h; const hh = Math.max(1, h - gap);
          const r = Math.min(4, bw / 2, hh);
          const path = k === last
            ? `M${x} ${top + hh}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${top + hh}Z`
            : `M${x} ${top + gap}H${x + bw}V${base}H${x}Z`;
          bars.push(svgEl('path', { d: path, class: 'viz-bar ' + series[k].cls }, svg));
          base = top;
        });
        const hit = svgEl('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, fill: 'transparent' }, svg);
        hit.addEventListener('pointerenter', () => {
          bars.forEach((b) => b.classList.add('hot'));
          tip.innerHTML = `<div class="viz-tip-h">${A.esc(d.tip || d.label)}</div>${series.map((s, k) => `<div class="viz-tip-r"><span class="viz-key ${s.cls}"></span>${A.esc(s.name)}<b>${fmt(d.values[k])}</b></div>`).join('')}<div class="viz-tip-s">Total ${fmt(totals[i])}</div>`;
          tip.classList.add('on'); placeTip(stage, tip, x + bw / 2, Y(totals[i]));
        });
        hit.addEventListener('pointerleave', () => { bars.forEach((b) => b.classList.remove('hot')); tip.classList.remove('on'); });
        if (i % every === 0) svgEl('text', { x: x + bw / 2, y: H - 8, class: 'viz-axis', 'text-anchor': 'middle' }, svg).textContent = d.label;
      });
    };
    draw();
    if (window.ResizeObserver) { let w = stage.clientWidth; new ResizeObserver(() => { if (Math.abs(stage.clientWidth - w) > 2) { w = stage.clientWidth; draw(); } }).observe(stage); }
  }

  /* ---------------------------------------------------------------- hbars */
  /** rows: [{ label, value, display?, sub? }] – value at the bar tip, bars ≤ 14px */
  function hbars(host, rows, opts = {}) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    host.classList.add('hbars');
    host.innerHTML = rows.map((r) => `<div class="hb-row" title="${A.esc(r.label)}: ${A.esc(r.display || r.value)}">
      <span class="hb-label">${A.esc(r.label)}${r.sub ? `<small>${A.esc(r.sub)}</small>` : ''}</span>
      <span class="hb-track"><span class="hb-bar" style="width:${Math.max(2, (r.value / max) * 100)}%"></span></span>
      <b class="hb-val num">${A.esc(r.display || (opts.fmt || String)(r.value))}</b></div>`).join('');
  }

  A.charts = { area, spark, columns, stacked, hbars };
})();
