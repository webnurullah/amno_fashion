/* ==========================================================================
   Amnu Fashion — core helpers
   Icons, storage, formatting, colour maths, Panjabi illustration generator,
   modal / toast primitives and theme handling.  Plain script, no build step.
   ========================================================================== */
(function () {
  'use strict';
  const A = (window.Amnu = window.Amnu || {});

  /* ---------- storage (localStorage, namespaced, failure-tolerant) ---------- */
  const NS = 'amnu.';
  A.DB = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(NS + key); } catch (e) { /* ignore */ } },
    reset() {
      try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    },
    dump() {
      const out = {};
      try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => { out[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k)); }); } catch (e) { /* ignore */ }
      return out;
    }
  };

  /* ---------- tiny DOM / string helpers ---------- */
  A.$ = (sel, root = document) => root.querySelector(sel);
  A.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  A.qs = new URLSearchParams(location.search);
  A.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  A.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  A.uid = () => Math.random().toString(36).slice(2, 9);
  A.slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  A.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /* ---------- formatting (BDT, en-IN digit grouping) ---------- */
  A.money = (n) => '৳' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  A.compact = (n) => {
    n = Number(n) || 0;
    if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  };
  A.date = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  A.dateShort = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  A.dateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  A.ago = (d) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    return Math.floor(s / 86400) + ' d ago';
  };
  A.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

  /* ---------- colour maths ---------- */
  const hexToRgb = (hex) => {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => A.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  /** amt > 0 mixes toward white, amt < 0 toward black */
  A.shade = (hex, amt) => {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  };
  A.alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  A.lum = (hex) => {
    const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  A.isLight = (hex) => A.lum(hex) > 0.5;

  /* ---------- icons (24px grid, stroke based) ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    bag: '<path d="M5.5 8h13l1 12.5h-15z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a7 7 0 0 1 4 5.7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10.5v6M14 10.5v6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9L12 17.8 5.8 21 7 14.1 2 9.3l6.9-1z"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m6 15 6-6 6 6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    package: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-5-5L5 21"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    layout: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/><rect x="15" y="14" width="6" height="7" rx="2"/>',
    plug: '<path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0zM12 17v5"/>',
    truck: '<path d="M1 6h13v10H1zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 7 9 6 9-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
    logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    message: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8a1 1 0 0 1 1-1z"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M12 21 8 9l4-6 4 6z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z"/><circle cx="16.5" cy="14" r="1.2"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    comment: '<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    'bag-plus': '<path d="M5.5 8h13l1 12.5h-15z"/><path d="M9 8V7a3 3 0 0 1 6 0v1M12 12.5v5M9.5 15h5"/>',
    ruler: '<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    barcode: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14"/>',
    building: '<path d="M4 21V5l8-2 8 2v16M4 21h16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M15 10.5c3 .2 6 1.3 6 2.5v4c0 1.7-2.7 3-6 3-2 0-3.8-.5-4.9-1.2"/>',
    bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    'trend-down': '<path d="m3 7 6 6 4-4 8 8M15 17h6v-6"/>',
    scale: '<path d="M12 3v18M5 21h14M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    whatsapp: '<path d="M3 21l1.6-5A8.5 8.5 0 1 1 8 19.4zM9 9c0 3.5 3 6 6 6l1.2-1.5-2-1-1 .7c-.9-.4-1.7-1.2-2.1-2.1l.7-1-1-2z"/>',
    mapnav: '<path d="m3 11 18-8-8 18-2-8z"/>',
    user2: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17 3l1 1 2-2"/>'
  };
  A.icon = (name, size, cls) => {
    const body = P[name] || P.info;
    const sz = size ? ` style="width:${size}px;height:${size}px"` : '';
    return `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"${sz}>${body}</svg>`;
  };
  /** replace <i data-icon="name" data-size="18"></i> placeholders with inline SVG */
  A.hydrate = (root = document) => {
    A.$$('[data-icon]', root).forEach((el) => {
      el.outerHTML = A.icon(el.dataset.icon, el.dataset.size, el.className);
    });
  };
  A.stars = (rating, max = 5) => {
    let out = '<span class="stars" role="img" aria-label="' + rating + ' out of 5">';
    for (let i = 1; i <= max; i++) out += A.icon('star', 15, i <= Math.round(rating) ? '' : 'off');
    return out + '</span>';
  };

  /* ---------- Panjabi illustration ----------
     Every product without an uploaded photo is drawn from its colour + style so
     the template looks complete with zero image assets.
     style: plain | embroidered | jacquard | stripe     view: front | back | detail | fabric */
  let pjId = 0;
  A.panjabi = (color = '#1f2a5c', style = 'plain', view = 'front', stand) => {
    if (stand == null) stand = view === 'front' || view === 'back';
    const id = 'pj' + ++pjId;
    const light = A.shade(color, 0.24);
    const dark = A.shade(color, -0.3);
    const deep = A.shade(color, -0.5);
    const pale = A.isLight(color);
    const trim = pale ? '#a97b24' : '#f2d28e';
    const edge = A.alpha(deep, pale ? 0.4 : 0.6);
    const body = 'M86 16 L56 30 L12 150 L36 160 L62 92 L54 252 Q100 259 146 252 L138 92 L164 160 L188 150 L144 30 L114 16 Q100 38 86 16 Z';

    let pattern = '';
    let overlay = '';
    if (style === 'jacquard') {
      pattern = `<pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M7 1.5 12.5 7 7 12.5 1.5 7z" fill="none" stroke="${A.shade(color, pale ? -0.2 : 0.3)}" stroke-opacity=".55" stroke-width="1"/><circle cx="7" cy="7" r="1.1" fill="${A.shade(color, pale ? -0.25 : 0.35)}" fill-opacity=".6"/></pattern>`;
      overlay = `<path d="${body}" fill="url(#${id}p)"/>`;
    } else if (style === 'stripe') {
      pattern = `<pattern id="${id}p" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="1.2" height="7" fill="${A.shade(color, pale ? -0.3 : 0.4)}" fill-opacity=".4"/></pattern>`;
      overlay = `<path d="${body}" fill="url(#${id}p)"/>`;
    }

    const defs = `<defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
      <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b98f35"/><stop offset=".5" stop-color="#f0d58a"/><stop offset="1" stop-color="#b98f35"/></linearGradient>
      ${pattern}</defs>`;

    if (view === 'fabric') {
      const swatch = `<rect width="200" height="262" fill="url(#${id}f)"/>` + (style === 'jacquard' || style === 'stripe' ? `<rect width="200" height="262" fill="url(#${id}p)" transform="scale(1.6)"/>` : `<rect width="200" height="262" fill="url(#${id}s)"/>`) +
        (style === 'embroidered' ? `<path d="M0 60 Q50 20 100 60 T200 60M0 130 Q50 90 100 130 T200 130M0 200 Q50 160 100 200 T200 200" fill="none" stroke="${trim}" stroke-opacity=".7" stroke-width="1.6"/>` : '');
      return `<svg class="pj" viewBox="0 0 200 262" role="img" aria-label="Fabric swatch" preserveAspectRatio="xMidYMid slice">${defs}${swatch}</svg>`;
    }

    const buttons = [46, 66, 86, 106, 126].map((y) => `<circle cx="100" cy="${y}" r="2.6" fill="${trim}" stroke="${edge}" stroke-width=".8"/>`).join('');
    let front = '';
    if (view === 'back') {
      front = `<path d="M100 40 V250" stroke="${edge}" stroke-width="1" stroke-dasharray="2 3"/><path d="M86 16 Q100 28 114 16 L120 18 Q100 36 80 18 Z" fill="${dark}"/>`;
    } else {
      let emb = '';
      if (style === 'embroidered') {
        emb = `<path d="M94 24 V142 M106 24 V142" stroke="${trim}" stroke-width="1.1" fill="none"/>` +
          [38, 58, 78, 98, 118, 138].map((y) => `<path d="M100 ${y - 5} l3.4 5 -3.4 5 -3.4 -5z" fill="${trim}" fill-opacity=".9"/>`).join('') +
          `<path d="M70 36 Q100 82 130 36" stroke="${trim}" stroke-width="1.4" fill="none"/><path d="M76 40 Q100 76 124 40" stroke="${trim}" stroke-width=".9" stroke-dasharray="1.5 3" fill="none"/>` +
          `<path d="M57 238 Q100 245 143 238" stroke="${trim}" stroke-width="1.6" fill="none"/><path d="M12.5 148 L36.5 158M188 148 L164 158" stroke="${trim}" stroke-width="2.4"/>`;
      } else {
        emb = `<path d="M12.5 148 L36.5 158M188 148 L164 158" stroke="${dark}" stroke-width="2.4"/>`;
      }
      front = `<rect x="94" y="22" width="12" height="122" rx="2" fill="${dark}" fill-opacity=".38"/>${emb}${buttons}` +
        `<path d="M86 16 Q100 38 114 16 L121 19 Q100 48 79 19 Z" fill="${dark}"/><path d="M86 16 Q100 38 114 16" stroke="${trim}" stroke-opacity=".7" stroke-width="1" fill="none"/>`;
    }
    const seams = `<path d="M62 92 L57 38 M138 92 L143 38" stroke="${edge}" stroke-width="1" fill="none"/><path d="M55.5 226 L54 252 M144.5 226 L146 252" stroke="${edge}" stroke-width="1.4"/>`;
    const vb = view === 'detail' ? '48 4 104 104' : stand ? '0 0 200 304' : '0 0 200 262';
    const standSvg = stand ? `<ellipse cx="100" cy="298" rx="46" ry="4" fill="rgba(0,0,0,.16)"/><rect x="97.5" y="236" width="5" height="56" rx="2" fill="url(#${id}k)"/><path d="M100 290 L70 298 M100 290 L130 298" stroke="#c4a04a" stroke-width="3.6" stroke-linecap="round"/><ellipse cx="100" cy="9" rx="8" ry="4.2" fill="#b98f35"/>` : '';
    return `<svg class="pj" viewBox="${vb}" role="img" aria-label="Panjabi illustration">${defs}${standSvg}
      <path d="${body}" fill="url(#${id}g)" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>
      ${overlay}<path d="${body}" fill="url(#${id}s)"/>${seams}${front}</svg>`;
  };

  /* ---------- toast / modal / confirm ---------- */
  A.toast = (msg, type) => {
    let host = A.$('.toasts');
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    const t = A.h(`<div class="toast glass ${type === 'err' ? 'err' : ''}">${A.icon(type === 'err' ? 'x' : 'check', 18)}<span>${A.esc(msg)}</span></div>`);
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
  };

  A.modal = ({ title = '', body = '', footer = '', wide = false, onOpen } = {}) => {
    const back = A.h(`<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${A.esc(title)}">
      <div class="modal glass-strong ${wide ? 'wide' : ''}">
        <div class="modal-h"><h3>${A.esc(title)}</h3><button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${A.icon('x', 18)}</button></div>
        <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}
      </div></div>`);
    const prev = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); if (prev && prev.focus) prev.focus(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(back);
    const first = A.$('input, select, textarea, button:not([data-close])', back);
    if (first) first.focus();
    if (onOpen) onOpen(back, close);
    return { el: back, close };
  };

  A.confirm = (message, okLabel = 'Confirm') => new Promise((resolve) => {
    const m = A.modal({
      title: 'Please confirm',
      body: `<p>${A.esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-danger" data-yes>${A.esc(okLabel)}</button>`
    });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { m.close(); resolve(true); }
      if (e.target.closest('[data-no],[data-close]') || e.target === m.el) resolve(false);
    });
  });

  /* ---------- theme (light / dark) + storefront look ---------- */
  A.applyTheme = () => {
    const mode = A.DB.get('theme', 'light');
    const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  A.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    A.DB.set('theme', next);
    A.applyTheme();
    A.$$('[data-theme-toggle]').forEach((b) => { b.innerHTML = A.icon(next === 'dark' ? 'sun' : 'moon', 18); });
  };
  A.themeIcon = () => A.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18);

  /** look = { accent, blur, opacity, radius } – the Customize panel writes this */
  A.applyLook = (look) => {
    if (!look) return;
    const s = document.documentElement.style;
    if (look.accent) {
      s.setProperty('--accent', look.accent);
      s.setProperty('--accent-2', A.shade(look.accent, 0.2));
      s.setProperty('--accent-dark', A.shade(look.accent, -0.18));
      s.setProperty('--accent-soft', A.alpha(look.accent, 0.16));
    }
    if (look.blur != null) s.setProperty('--blur', look.blur + 'px');
    if (look.opacity != null) s.setProperty('--glass-a', look.opacity);
    if (look.radius != null) {
      s.setProperty('--r-lg', look.radius + 'px');
      s.setProperty('--r-xl', Math.round(look.radius * 1.4) + 'px');
      s.setProperty('--r-md', Math.round(look.radius * 0.66) + 'px');
      s.setProperty('--r-sm', Math.round(look.radius * 0.5) + 'px');
    }
  };

  A.applyTheme();
  document.addEventListener('DOMContentLoaded', () => A.hydrate());
})();
