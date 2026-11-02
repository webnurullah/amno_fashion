/* ==========================================================================
   AMNU Fashion — storefront pages (1/2)
   home · category · shop (listing) · product · bag · checkout · thanks
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const Shop = A.shop;
  const { Cart, Auth, Recent } = Shop;
  const { $, $$, esc, icon, money } = A;
  const settings = Shop.settings;
  const { card, grid, rail, catName, pctOff, stageOf, codeOf, priceHTML } = Shop;
  const P = (Shop.pages = {});

  const newest = (list) => list.slice().sort((a, b) => new Date(b.created) - new Date(a.created));
  const popular = (list) => list.slice().sort((a, b) => b.sold - a.sold);

  /* tall studio card for a collection */
  const collectionCard = (title, href, p, sub) => `<a class="dcard stage ${stageOf(p)}" style="--tint:${p.color}" href="${href}">${S.thumb(p)}<span class="dcard-title">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>`;
  const sectionHead = (title, link, linkLabel = 'Explore All') => `<div class="section-h"><h2>${esc(title)}</h2>${link ? `<a class="u-link" href="${link}">${esc(linkLabel)}</a>` : ''}</div>`;
  const recentRail = (exclude) => {
    const l = Recent.list().filter((p) => p.id !== exclude);
    return l.length ? `<section class="section container"><div class="section-h"><h2>Recently Viewed</h2></div>${rail(l.map(card).join(''), 'products')}</section>` : '';
  };

  /* ======================================================================
     Home
     ====================================================================== */
  P.home = () => {
    const pub = S.published();
    const set = (id) => pub.find((p) => p.id === id) || pub[0];
    $('#hero-title').textContent = settings.heroTitle;
    $('#hero-sub').textContent = settings.heroSub;
    $('#tile-art-a').innerHTML = [set(2), set(1), set(4)].map((p, i) => `<div class="tile-pj p${i}">${S.thumb(p)}</div>`).join('');
    $('#tile-art-c').innerHTML = [set(13), set(14), set(16)].map((p, i) => `<div class="tile-pj p${i}">${S.thumb(p)}</div>`).join('');
    $('#tile-art-d').innerHTML = [set(16), set(9)].map((p, i) => `<div class="tile-pj p${i}">${S.thumb(p)}</div>`).join('');
    (() => {
      const bn = S.banners(); const track = $('#hero-track');
      const mine = bn.home.filter((b) => b.image && b.active !== false);
      if (mine.length) {
        if (bn.showDefaults === false) [...track.children].forEach((t) => { t.hidden = true; });
        track.insertAdjacentHTML('afterbegin', mine.map((b) => `<a class="tile tile-img" href="${esc(b.link || 'shop.html')}" aria-label="${esc(b.title || 'Featured banner')}"><div class="tile-art" style="background-image:url('${b.image}')" aria-hidden="true"></div>${b.title || b.sub || b.cta ? `<div class="tile-copy">${b.title ? `<h2 class="tile-h">${esc(b.title)}</h2>` : ''}${b.sub ? `<p>${esc(b.sub)}</p>` : ''}${b.cta ? `<span class="btn btn-primary">${esc(b.cta)}</span>` : ''}</div>` : ''}</a>`).join(''));
      }
    })();
    (() => {
      const track = $('#hero-track'); const slides = [...track.children].filter((t) => !t.hidden); const dots = $('#hero-dots');
      const per = () => 1;
      let idx = 0; let timer;
      const step = () => slides[0].getBoundingClientRect().width + 20;
      const max = () => Math.max(0, slides.length - per());
      const go = (n) => { idx = (n + max() + 1) % (max() + 1); track.style.transform = `translateX(${-idx * step()}px)`; [...dots.children].forEach((d, k) => d.classList.toggle('on', k === idx)); };
      const build = () => { dots.innerHTML = Array.from({ length: max() + 1 }, (_, k) => `<button type="button" aria-label="Slide ${k + 1}"></button>`).join(''); go(Math.min(idx, max())); };
      const play = () => { clearInterval(timer); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(idx + 1), 5000); };
      $('#hero-prev').addEventListener('click', () => { go(idx - 1); play(); });
      $('#hero-next').addEventListener('click', () => { go(idx + 1); play(); });
      dots.addEventListener('click', (ev) => { const k = [...dots.children].indexOf(ev.target.closest('button')); if (k >= 0) { go(k); play(); } });
      const root = $('.hero-slider'); root.addEventListener('mouseenter', () => clearInterval(timer)); root.addEventListener('mouseleave', play);
      let sx = null; track.addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', (ev) => { if (sx == null) return; const dx = ev.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); play(); } sx = null; });
      window.addEventListener('resize', build); build(); play();
    })();

    const byCat = (slug) => pub.find((p) => p.cats[0] === slug) || pub.find((p) => p.cats.includes(slug)) || pub[0];
    const catCards = (slugs) => slugs.map((s) => { const c = S.categories().find((x) => x.slug === s); return c ? collectionCard(c.name, `shop.html?cat=${s}`, byCat(s), A.plural(S.categoryCount(s), 'style')) : ''; }).join('');
    $('#dept-panjabi').innerHTML = rail(catCards(['eid', 'wedding', 'embroidered', 'cotton', 'silk']), 'cards');
    $('#dept-kids').innerHTML = rail(catCards(['kids', 'sets']) + collectionCard('Father & Son', 'shop.html?cat=sets', set(16), 'Matching sets') + collectionCard('Eid for Kids', 'shop.html?cat=kids', set(13), 'Festive picks'), 'cards');
    $('#dept-stores').innerHTML = S.showrooms().map((l) => `<article class="store-card glass"><span class="store-ico">${icon('store', 22)}</span><div class="grow"><h3>${esc(l.name)}</h3><p class="muted small">${esc(l.address)}</p><p class="xs muted">${esc(l.hours)}</p></div><div class="col gap-8"><a class="btn btn-glass btn-sm" href="stores.html">Details</a></div></article>`).join('');

    $('#new-rail').innerHTML = rail(newest(pub).slice(0, 8).map(card).join(''), 'products');
    $('#trend-rail').innerHTML = rail(popular(pub).slice(0, 8).map(card).join(''), 'products');
    $('#recent-host').innerHTML = recentRail();

    const craft = [
      ['Fabric first', 'Cotton, linen, jamdani and silk-touch fabrics chosen for how they feel after a long day. Every roll is checked before it is cut.', 'gem'],
      ['Tailored fit', 'Consistent size charts, generous placket allowances and clean shoulder lines so a size M is always an M.', 'ruler'],
      ['Hand finishing', 'Buttons set, edges turned and embroidery checked by hand by our master tailors.', 'sparkle'],
      ['Colour-fast dyes', 'Fabrics are pre-washed and tested so colours stay deep after wash after wash.', 'zap'],
      ['Strong stitching', 'Reinforced seams at every stress point: collar, placket, sleeves and hem.', 'scissors'],
      ['Quality check', 'Every piece is inspected for stitching, size and finish before it leaves the showroom or warehouse.', 'shield'],
      ['Easy exchange', 'Wrong size? Exchange online or in any showroom within 7 days.', 'refresh']
    ];
    $('#craft-cards').innerHTML = craft.map(([t, d, ic]) => `<article class="cf-card"><span class="craft-ico">${icon(ic, 26)}</span><p>${d}</p><h3>${t}</h3></article>`).join('');
    const cbg = S.banners().craftBg; if (cbg) $('#craft').style.backgroundImage = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url('${cbg}')`;
    (() => {
      const cards = [...$('#craft-cards').children]; const bar = $('#cf-bar i'); let cur = Math.floor(cards.length / 2); let timer;
      const place = () => {
        const w = $('#craft-cards').clientWidth; const narrow = w < 700; const step = narrow ? w * 0.2 : Math.min(190, w / 6);
        cards.forEach((c, i) => {
          const d = i - cur; const ad = Math.abs(d);
          c.style.transform = `translateX(calc(-50% + ${d * step}px)) scale(${1 - Math.min(ad, 3) * 0.12})`;
          c.style.zIndex = String(10 - ad); c.style.opacity = ad > (narrow ? 1 : 3) ? '0' : String(1 - ad * 0.12);
          c.style.filter = ad ? `blur(${Math.min(ad, 3) * 0.7}px) brightness(${1 - ad * 0.08})` : 'none';
          c.classList.toggle('on', !ad); c.setAttribute('aria-hidden', ad ? 'true' : 'false');
        });
        bar.style.width = (100 / cards.length) + '%'; bar.style.marginLeft = (cur * 100 / cards.length) + '%';
      };
      const go = (n) => { cur = (n + cards.length) % cards.length; place(); };
      const play = () => { clearInterval(timer); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(cur + 1), 4500); };
      $('#cf-prev').addEventListener('click', () => { go(cur - 1); play(); });
      $('#cf-next').addEventListener('click', () => { go(cur + 1); play(); });
      cards.forEach((c, i) => c.addEventListener('click', () => { go(i); play(); }));
      const stage = $('#craft'); stage.addEventListener('mouseenter', () => clearInterval(timer)); stage.addEventListener('mouseleave', play);
      let sx = null; $('#craft-cards').addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; }, { passive: true });
      $('#craft-cards').addEventListener('touchend', (ev) => { if (sx == null) return; const dx = ev.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); play(); } sx = null; });
      window.addEventListener('resize', place); place(); play();
    })();
    Shop.syncRails();
  };

  /* ======================================================================
     Department landing
     ====================================================================== */
  const DEPTS = {
    panjabi: { title: 'Panjabi', sub: 'Eid, weddings and every day in between', cats: ['eid', 'wedding', 'embroidered', 'cotton', 'silk'], hero: [2, 1, 4] },
    kids: { title: 'Kids', sub: 'Little ones, big occasions', cats: ['kids'], hero: [13, 14, 16] },
    sets: { title: 'Sets', sub: 'Panjabi and pajama, ready to wear', cats: ['sets'], hero: [16, 13, 9] }
  };
  P.category = () => {
    const key = A.qs.get('c') in DEPTS ? A.qs.get('c') : 'panjabi';
    const d = DEPTS[key];
    document.title = `${d.title} — ${settings.storeName}`;
    const pub = S.published();
    const inDept = pub.filter((p) => p.cats.some((c) => d.cats.includes(c)));
    $('#cat-banner').innerHTML = `<div class="banner glass"><div class="banner-copy"><span class="kicker">${esc(d.title)}</span><h1>${esc(d.sub)}</h1><a class="btn btn-primary btn-lg" href="shop.html${d.cats.length === 1 ? '?cat=' + d.cats[0] : ''}">Shop all ${esc(d.title.toLowerCase())}</a></div><div class="banner-art">${d.hero.map((id, i) => `<div class="tile-pj p${i}">${S.thumb(pub.find((p) => p.id === id) || pub[i])}</div>`).join('')}</div></div>`;
    $('#cat-title').textContent = `${d.title}: Shop By Category`;
    const circles = S.categories().filter((c) => d.cats.includes(c.slug)).map((c) => { const p = pub.find((x) => x.cats[0] === c.slug) || pub.find((x) => x.cats.includes(c.slug)) || pub[0]; return `<a class="circle" href="shop.html?cat=${c.slug}"><span class="circle-img stage ${stageOf(p)}" style="--tint:${p.color}">${S.thumb(p)}</span><span>${esc(c.name)}</span></a>`; }).join('');
    $('#cat-circles').innerHTML = rail(circles, 'circles');
    $('#cat-new').innerHTML = rail(newest(inDept).slice(0, 8).map(card).join(''), 'products');
    $('#cat-trend').innerHTML = rail(popular(inDept).slice(0, 8).map(card).join(''), 'products');
    $('#new-link').href = `shop.html?sort=new${d.cats.length === 1 ? '&cat=' + d.cats[0] : ''}`;
    $('#trend-link').href = `shop.html${d.cats.length === 1 ? '?cat=' + d.cats[0] : ''}`;
    $('#recent-host').innerHTML = recentRail();
    Shop.syncRails();
  };

  /* ======================================================================
     Listing
     ====================================================================== */
  /* ======================================================================
     Collection banner scenes: a different illustrated set for every category
     ====================================================================== */
  const SCENES = {
    all: { sky: ['#8fbde8', '#f6e4cc'], far: '#b58470', mid: '#d6a07a', wall: '#cf8960', wall2: '#a9603d', floor: ['#f2d9b9', '#d8b189'], leaf: '#d9732f', leaf2: '#9c4a22', grass: '#cfa56d', left: 'circle', right: 'arch', tree: true, sun: '#fff1c9' },
    eid: { sky: ['#6fa8e0', '#fbe7c9'], far: '#a67c8f', mid: '#cf9a86', wall: '#c98a63', wall2: '#9f5a3a', floor: ['#f4dcbc', '#dcb88f'], leaf: '#e08a2c', leaf2: '#a8481e', grass: '#d8b373', left: 'arch', right: 'circle', tree: true, sun: '#fff6d8' },
    wedding: { sky: ['#f3b6a0', '#ffe9c7'], far: '#b9798a', mid: '#d99a8e', wall: '#e3a98e', wall2: '#b56a55', floor: ['#fbe0c4', '#e2b99a'], leaf: '#e8a23b', leaf2: '#b8582a', grass: '#e0b87f', left: 'arch2', right: 'arch2', tree: false, sun: '#fff0cf', lights: true },
    embroidered: { sky: ['#a7d8e6', '#f2f6e8'], far: '#7fa79a', mid: '#9cc2ae', wall: '#e9e1cc', wall2: '#bfb597', floor: ['#efe8d6', '#d4cbb0'], leaf: '#3f8f6b', leaf2: '#216548', grass: '#6fb08a', left: 'arch', right: 'arch', tree: true, sun: '#ffffff', hedge: true },
    cotton: { sky: ['#5fa8ee', '#e2f1fb'], far: '#8fb4d6', mid: '#b9d6ea', wall: '#f4f1ea', wall2: '#cfc9bd', floor: ['#f7efe0', '#e3d7bd'], leaf: '#4f9d68', leaf2: '#2e6e47', grass: '#a8c98a', left: 'columns', right: 'circle', tree: false, sun: '#ffffff', sea: true },
    silk: { sky: ['#101a3d', '#34457c'], far: '#2b3560', mid: '#3d4a7d', wall: '#2a3566', wall2: '#1a2247', floor: ['#4a4a6d', '#2c2c4a'], leaf: '#d6a84a', leaf2: '#8a6a1f', grass: '#4d5a8c', left: 'arch', right: 'circle', tree: false, moon: true, glow: '#f4c95d' },
    kids: { sky: ['#8ed6ff', '#fff3c4'], far: '#9bd89b', mid: '#7fcf8a', wall: '#ffd6a6', wall2: '#f7a97a', floor: ['#b9e6a0', '#8ed07f'], leaf: '#ff7a8a', leaf2: '#d94b6b', grass: '#6cc47a', left: 'none', right: 'none', tree: true, sun: '#fff08a', balloons: true },
    sets: { sky: ['#bcd9c9', '#f4f1dd'], far: '#8aa48a', mid: '#a9c0a3', wall: '#d8cfae', wall2: '#a89f7b', floor: ['#ece3c8', '#cfc4a0'], leaf: '#6d8f4a', leaf2: '#44632d', grass: '#97b27a', left: 'columns', right: 'arch', tree: true, sun: '#fffbe6' }
  };
  const sceneSVG = (key) => {
    const c = SCENES[key] || SCENES.all; const id = 'sc' + key;
    const cloud = (x, y, s) => `<g opacity=".85" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="60" ry="16" fill="#fff"/><ellipse cx="-25" cy="-12" rx="34" ry="20" fill="#fff"/><ellipse cx="22" cy="-16" rx="40" ry="24" fill="#fff"/></g>`;
    const bush = (x, y, s, col) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="46" ry="30" fill="${col}"/><ellipse cx="-28" cy="8" rx="30" ry="22" fill="${col}" opacity=".85"/><ellipse cx="30" cy="10" rx="28" ry="20" fill="${col}" opacity=".9"/></g>`;
    const grassTuft = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c.grass}"><path d="M0 0 C-6 -40 -16 -70 -26 -84 C-8 -62 4 -34 10 0Z"/><path d="M6 0 C6 -50 14 -86 30 -104 C20 -70 22 -34 22 0Z"/><path d="M-10 0 C-30 -30 -52 -50 -74 -58 C-48 -42 -30 -20 -22 0Z"/></g>`;
    const leaves = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<ellipse cx="${(i % 4) * 22 - 30}" cy="${-Math.floor(i / 2) * 20}" rx="14" ry="7" transform="rotate(${i * 37} ${(i % 4) * 22 - 30} ${-Math.floor(i / 2) * 20})" fill="${i % 2 ? c.leaf : c.leaf2}"/>`).join('')}</g>`;
    const leftWall = c.left === 'none' ? '' : `<rect x="0" y="0" width="430" height="300" fill="url(#${id}w)"/>` + ({
      circle: `<circle cx="215" cy="140" r="96" fill="${c.wall2}"/><clipPath id="${id}c"><circle cx="215" cy="140" r="82"/></clipPath><g clip-path="url(#${id}c)"><rect x="100" y="40" width="230" height="220" fill="url(#${id}s)"/><path d="M110 170 L170 120 L215 160 L270 110 L330 170 V230 H110Z" fill="${c.mid}"/><ellipse cx="215" cy="215" rx="110" ry="30" fill="${c.leaf}" opacity=".7"/></g>`,
      arch: `<path d="M120 300 V160 a95 95 0 0 1 190 0 V300Z" fill="${c.wall2}"/><path d="M135 300 V165 a80 80 0 0 1 160 0 V300Z" fill="${c.glow || '#2a1a12'}" opacity="${c.glow ? '.55' : '.82'}"/>`,
      arch2: `<path d="M70 300 V170 a60 60 0 0 1 120 0 V300Z" fill="${c.wall2}"/><path d="M82 300 V172 a48 48 0 0 1 96 0 V300Z" fill="#fff2d2" opacity=".55"/><path d="M230 300 V170 a60 60 0 0 1 120 0 V300Z" fill="${c.wall2}"/><path d="M242 300 V172 a48 48 0 0 1 96 0 V300Z" fill="#fff2d2" opacity=".55"/>`,
      columns: [60, 190, 320].map((x) => `<rect x="${x}" y="20" width="46" height="280" fill="${c.wall2}"/><rect x="${x - 6}" y="14" width="58" height="14" fill="${c.wall}"/>`).join('')
    }[c.left] || '');
    const rightWall = c.right === 'none' ? '' : `<rect x="1170" y="0" width="430" height="300" fill="url(#${id}w)"/>` + ({
      circle: `<circle cx="1385" cy="140" r="96" fill="${c.wall2}"/><clipPath id="${id}d"><circle cx="1385" cy="140" r="82"/></clipPath><g clip-path="url(#${id}d)"><rect x="1270" y="40" width="230" height="220" fill="url(#${id}s)"/><path d="M1280 170 L1340 120 L1385 160 L1440 110 L1500 170 V230 H1280Z" fill="${c.mid}"/></g>`,
      arch: `<path d="M1270 300 V165 a70 70 0 0 1 140 0 V300Z" fill="${c.wall2}"/><path d="M1284 300 V168 a56 56 0 0 1 112 0 V300Z" fill="${c.glow || '#241711'}" opacity="${c.glow ? '.55' : '.88'}"/>`,
      arch2: `<path d="M1250 300 V170 a60 60 0 0 1 120 0 V300Z" fill="${c.wall2}"/><path d="M1262 300 V172 a48 48 0 0 1 96 0 V300Z" fill="#fff2d2" opacity=".55"/><path d="M1410 300 V170 a60 60 0 0 1 120 0 V300Z" fill="${c.wall2}"/><path d="M1422 300 V172 a48 48 0 0 1 96 0 V300Z" fill="#fff2d2" opacity=".55"/>`,
      columns: [1190, 1320, 1450].map((x) => `<rect x="${x}" y="20" width="46" height="280" fill="${c.wall2}"/><rect x="${x - 6}" y="14" width="58" height="14" fill="${c.wall}"/>`).join('')
    }[c.right] || '');
    const tree = c.tree ? `<rect x="1500" y="40" width="12" height="270" fill="#3b2a22"/><rect x="1470" y="120" width="8" height="190" fill="#3b2a22"/><g>${[[1420, 60, 70], [1500, 30, 80], [1560, 90, 70], [1450, 120, 60], [1530, 140, 60], [1380, 110, 50]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? c.leaf : c.leaf2}" opacity=".88"/>`).join('')}</g>` : '';
    const stars = c.moon ? Array.from({ length: 36 }, (_, i) => `<circle cx="${(i * 197) % 1600}" cy="${(i * 53) % 180 + 10}" r="${i % 5 ? 1.4 : 2.4}" fill="#fff" opacity=".8"/>`).join('') + `<circle cx="760" cy="80" r="46" fill="#f7f1d4"/><circle cx="778" cy="70" r="40" fill="${c.sky[0]}"/>` : '';
    const sun = c.sun ? `<circle cx="1050" cy="120" r="120" fill="${c.sun}" opacity=".5"/><circle cx="1050" cy="120" r="46" fill="${c.sun}"/>` : '';
    const sea = c.sea ? `<rect x="0" y="236" width="1600" height="70" fill="#4b97d6"/><path d="M0 250 Q80 238 160 250 T320 250 T480 250 T640 250 T800 250 T960 250 T1120 250 T1280 250 T1440 250 T1600 250" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>` : '';
    const lights = c.lights ? `<path d="M0 40 Q400 110 800 40 T1600 40" stroke="#8a5a30" stroke-width="2" fill="none"/>${Array.from({ length: 28 }, (_, i) => { const x = i * 58 + 20; const y = 40 + Math.sin((x / 800) * Math.PI) * 38 * (x < 800 ? 1 : 1) + 0; return `<circle cx="${x}" cy="${40 + Math.abs(Math.sin(x / 800 * Math.PI)) * 52}" r="6" fill="#ffe08a"/><circle cx="${x}" cy="${40 + Math.abs(Math.sin(x / 800 * Math.PI)) * 52}" r="14" fill="#ffe08a" opacity=".25"/>`; }).join('')}` : '';
    const balloons = c.balloons ? [[300, 110, '#ff6b81'], [380, 80, '#ffd23f'], [1200, 100, '#4cc9f0'], [1270, 70, '#b388ff'], [640, 60, '#ff9f45'], [980, 74, '#ff6b81']].map(([x, y, col]) => `<line x1="${x}" y1="${y + 34}" x2="${x - 10}" y2="${y + 130}" stroke="#fff" opacity=".7"/><ellipse cx="${x}" cy="${y}" rx="24" ry="31" fill="${col}"/>`).join('') : '';
    const hedge = c.hedge ? `<rect x="0" y="236" width="1600" height="64" rx="30" fill="${c.leaf2}"/><rect x="0" y="252" width="1600" height="48" fill="${c.leaf}" opacity=".9"/>` : '';
    return `<svg viewBox="0 0 1600 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky[0]}"/><stop offset="1" stop-color="${c.sky[1]}"/></linearGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.floor[0]}"/><stop offset="1" stop-color="${c.floor[1]}"/></linearGradient><linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.wall}"/><stop offset="1" stop-color="${c.wall2}"/></linearGradient></defs>
      <rect width="1600" height="400" fill="url(#${id}s)"/>${stars}${sun}${c.moon ? '' : cloud(300, 70, 1.1) + cloud(700, 50, .9) + cloud(1050, 90, 1.2) + cloud(1300, 56, .8)}
      <path d="M0 270 L150 200 L300 250 L480 185 L680 250 L880 190 L1080 245 L1280 190 L1450 240 L1600 205 V310 H0Z" fill="${c.far}"/><path d="M0 285 L220 235 L420 280 L640 230 L860 285 L1100 235 L1340 282 L1600 240 V320 H0Z" fill="${c.mid}"/>${sea}
      <rect y="290" width="1600" height="110" fill="url(#${id}f)"/><path d="M200 400 L520 292 L640 292 L440 400Z M780 400 L930 292 L1040 292 L980 400Z" fill="#fff" opacity=".14"/>
      ${leftWall}${rightWall}${tree}${hedge}${lights}${balloons}
      ${bush(60, 330, 1.4, c.leaf2)}${bush(150, 360, 1.1, c.leaf)}${grassTuft(110, 392, 1.1)}${grassTuft(300, 388, .8)}${leaves(1480, 340, 1.5)}${bush(1530, 360, 1.5, c.leaf2)}${bush(1360, 372, 1.1, c.leaf)}${grassTuft(1300, 392, 1)}${grassTuft(1560, 396, 1.2)}
    </svg>`;
  };

  P.shop = () => {
    const all = S.published();
    const maxPrice = Math.ceil(Math.max(...all.map((p) => S.price(p))) / 50) * 50;
    const minPrice = Math.floor(Math.min(...all.map((p) => S.price(p))) / 50) * 50;
    const st = {
      cat: A.qs.get('cat') || '', q: A.qs.get('q') || '', sort: A.qs.get('sort') || 'default', max: Number(A.qs.get('max')) || maxPrice,
      sizes: (A.qs.get('size') || '').split(',').filter(Boolean), colors: (A.qs.get('color') || '').split(',').filter(Boolean), sale: A.qs.get('sale') === '1', n: 8
    };
    const colorMap = new Map();
    all.forEach((p) => p.colors.forEach((c) => { if (!colorMap.has(c.hex)) colorMap.set(c.hex, c.name); }));
    const sizeList = [...new Set(all.flatMap((p) => p.sizes))];
    const SORTS = [['default', 'Default'], ['new', 'Newest'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['popular', 'Best selling']];

    const pct = settings.digitalDiscountPct;
    const catPic = (slug) => all.find((x) => (slug ? x.cats.includes(slug) : true)) || all[0];
    const catCircle = (slug, name) => { const q = catPic(slug); return `<a class="circle ${st.cat === slug ? 'on' : ''}" href="${slug ? 'shop.html?cat=' + slug : 'shop.html'}"><span class="circle-img stage ${stageOf(q)}" style="--tint:${q.color}">${S.thumb(q)}</span><span>${esc(name)}</span></a>`; };
    $('#sub-chips').innerHTML = rail(catCircle('', 'All') + S.categories().map((c) => catCircle(c.slug, c.name)).join(''), 'circles');
    $('#crumb-cat').textContent = st.cat ? catName(st.cat) : 'All Panjabi';
    (() => {
      const inCat = st.cat ? all.filter((p) => p.cats.includes(st.cat)) : all;
      const pics = (inCat.length ? inCat : all).slice(0, 5);
      const title = st.cat ? catName(st.cat) : 'All Panjabi';
      const tag = st.sale ? 'Online offer' : st.sort === 'new' ? 'New arrivals' : st.cat ? 'Collection' : 'Our collection';
      const bimg = S.banners().cats[st.cat || 'all'] || S.banners().cats.all;
      if (bimg) { $('#cat-hero').className = 'cat-hero has-img'; $('#cat-hero').removeAttribute('style'); $('#cat-hero').innerHTML = `<img src="${bimg}" alt="${esc(title)}">`; return; }
      $('#cat-hero').className = 'cat-hero scene'; $('#cat-hero').innerHTML = `${sceneSVG(st.cat || 'all')}<div class="cat-hero-art" aria-hidden="true">${pics.slice(0, 3).map((p, i) => `<div class="cat-pj c${i}">${S.thumb(p)}</div>`).join('')}</div><span class="cat-hero-tag">${esc(title)}</span>`;
    })();
    document.title = `${st.cat ? catName(st.cat) : 'Shop'} — ${settings.storeName}`;

    const filtered = () => {
      const by = {
        default: (a, b) => (b.featured - a.featured) || (b.sold - a.sold), new: (a, b) => new Date(b.created) - new Date(a.created),
        'price-asc': (a, b) => S.price(a) - S.price(b), 'price-desc': (a, b) => S.price(b) - S.price(a), popular: (a, b) => b.sold - a.sold
      };
      return all.filter((p) => (!st.cat || p.cats.includes(st.cat)) && (!st.q || [p.name, p.fabric, p.colorName, p.style, p.sku, ...p.cats, ...p.tags].join(' ').toLowerCase().includes(st.q.toLowerCase())) &&
        S.price(p) <= st.max && (!st.sizes.length || st.sizes.some((s) => p.sizes.includes(s) && S.onlineStock(p.id, s) > 0)) &&
        (!st.colors.length || p.colors.some((c) => st.colors.includes(c.hex.slice(1)))) && (!st.sale || p.sale)).sort(by[st.sort] || by.default);
    };
    const sync = () => {
      const p = new URLSearchParams();
      if (st.cat) p.set('cat', st.cat); if (st.q) p.set('q', st.q); if (st.sort !== 'default') p.set('sort', st.sort); if (st.max < maxPrice) p.set('max', st.max);
      if (st.sizes.length) p.set('size', st.sizes.join(',')); if (st.colors.length) p.set('color', st.colors.join(',')); if (st.sale) p.set('sale', '1');
      try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); } catch (e) { /* file:// */ }
    };
    const render = () => {
      const list = filtered();
      $('#shop-grid').innerHTML = grid(list.slice(0, st.n), 'No products match your filters');
      const more = $('#load-more'); more.hidden = list.length <= st.n; more.textContent = `Load more (${list.length - st.n} left)`;
      const chips = [];
      st.sizes.forEach((s) => chips.push(['size:' + s, 'Size ' + S.sizeLabel(s)]));
      st.colors.forEach((h) => chips.push(['color:' + h, colorMap.get('#' + h) || h]));
      if (st.q) chips.push(['q', `“${st.q}”`]); if (st.max < maxPrice) chips.push(['max', 'Up to ' + money(st.max)]); if (st.sale) chips.push(['sale', 'Promo only']);
      $('#active-filters').innerHTML = chips.map(([k, l]) => `<button class="chip small-chip" data-clear="${esc(k)}" type="button">${esc(l)} ${icon('x', 13)}</button>`).join('');
      $('#fb-color').dataset.n = st.colors.length || ''; $('#fb-size').dataset.n = st.sizes.length || ''; $('#fb-price').dataset.n = st.max < maxPrice ? 1 : '';
      $('#fb-sort span').textContent = 'Sort: ' + (SORTS.find((x) => x[0] === st.sort) || SORTS[0])[1];
      sync();
    };

    const pops = {
      color: () => `<div class="pop-swatches">${[...colorMap].map(([hex, name]) => `<button type="button" class="swatch ${st.colors.includes(hex.slice(1)) ? 'on' : ''}" data-color-f="${hex.slice(1)}" style="--c:${hex}" title="${esc(name)}" aria-label="${esc(name)}" aria-pressed="${st.colors.includes(hex.slice(1))}"></button>`).join('')}</div>`,
      size: () => `<div class="pop-pills">${sizeList.map((s) => `<button type="button" class="size ${st.sizes.includes(s) ? 'on' : ''}" data-size-f="${s}" aria-pressed="${st.sizes.includes(s)}">${esc(S.sizeLabel(s))}</button>`).join('')}</div>`,
      price: () => `<div class="pop-price"><div class="row between small"><span>${money(minPrice)}</span><b id="pp-val">Up to ${money(st.max)}</b></div><input type="range" id="pp-range" min="${minPrice}" max="${maxPrice}" step="50" value="${st.max}" aria-label="Maximum price"><label class="check small"><input type="checkbox" id="pp-sale" ${st.sale ? 'checked' : ''}> Promo items only</label></div>`,
      sort: () => `<div class="pop-list">${SORTS.map(([k, l]) => `<button type="button" class="pop-opt ${st.sort === k ? 'on' : ''}" data-sort-f="${k}">${l}${st.sort === k ? icon('check', 16) : ''}</button>`).join('')}</div>`
    };
    const closePops = () => $$('.fb-wrap.open').forEach((w) => w.classList.remove('open'));
    $('#filter-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pop]');
      if (btn) {
        const wrap = btn.parentElement; const open = wrap.classList.contains('open'); closePops();
        if (!open) { $('.pop', wrap).innerHTML = pops[btn.dataset.pop](); wrap.classList.add('open'); }
        return;
      }
      const c = e.target.closest('[data-color-f]'); if (c) { const h = c.dataset.colorF; st.colors = st.colors.includes(h) ? st.colors.filter((x) => x !== h) : [...st.colors, h]; c.classList.toggle('on'); st.n = 8; render(); return; }
      const s = e.target.closest('[data-size-f]'); if (s) { const z = s.dataset.sizeF; st.sizes = st.sizes.includes(z) ? st.sizes.filter((x) => x !== z) : [...st.sizes, z]; s.classList.toggle('on'); st.n = 8; render(); return; }
      const o = e.target.closest('[data-sort-f]'); if (o) { st.sort = o.dataset.sortF; closePops(); render(); }
    });
    $('#filter-bar').addEventListener('input', (e) => {
      if (e.target.id === 'pp-range') { st.max = Number(e.target.value); $('#pp-val').textContent = 'Up to ' + money(st.max); st.n = 8; render(); }
      if (e.target.id === 'pp-sale') { st.sale = e.target.checked; st.n = 8; render(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.fb-wrap')) closePops(); });
    $('#active-filters').addEventListener('click', (e) => {
      const b = e.target.closest('[data-clear]'); if (!b) return;
      const [k, v] = b.dataset.clear.split(':');
      if (k === 'size') st.sizes = st.sizes.filter((x) => x !== v); if (k === 'color') st.colors = st.colors.filter((x) => x !== v);
      if (k === 'q') st.q = ''; if (k === 'max') st.max = maxPrice; if (k === 'sale') st.sale = false;
      render();
    });
    $('#load-more').addEventListener('click', () => { st.n += 8; render(); });
    render();
  };

  /* ======================================================================
     Product
     ====================================================================== */
  P.product = () => {
    const p = S.product(A.qs.get('id') || A.qs.get('slug'));
    const root = $('#pdp');
    if (!p || p.status !== 'publish') {
      root.innerHTML = `<div class="empty glass pad" style="grid-column:1/-1"><h2>Product not found</h2><p class="muted">It may have been removed or is no longer available.</p><a class="btn btn-primary" href="shop.html">Back to shop</a></div>`;
      if ($('#pdp-rail-host')) $('#pdp-rail-host').hidden = true;
      return;
    }
    document.title = `${p.name} — ${settings.storeName}`;
    Recent.add(p.id);
    $('#crumb-name').textContent = p.name;
    $('#crumb-cat').innerHTML = `<a href="shop.html?cat=${p.cats[0]}">${esc(catName(p.cats[0]))}</a>`;
    const v = { color: p.color, size: '', view: 0, more: false, dir: 0 };
    const VIEWS = [['front', 'Front'], ['back', 'Back'], ['detail', 'Collar'], ['fabric', 'Fabric']];
    const images = () => (p.image ? [p.image, ...(p.gallery || [])].map((src) => `<img class="pj" src="${esc(src)}" alt="${esc(p.name)}">`) : VIEWS.map(([k]) => A.panjabi(v.color, p.style, k)));

    const paint = () => {
      const imgs = images();
      v.view = (v.view + imgs.length) % imgs.length;
      const color = p.colors.find((c) => c.hex === v.color) || p.colors[0];
      const left = v.size ? S.onlineStock(p.id, v.size) : null;
      const total = Shop.onlineTotal(p);
      const url = location.href.split('#')[0];
      root.innerHTML = `
        <div class="pdp-gallery">
          <div class="pdp-main stage ${stageOf(p)} ${v.dir ? (v.dir > 0 ? 'go-next' : 'go-prev') : ''}" style="--tint:${v.color}">${imgs[v.view]}
            ${p.sale ? '<span class="promo-tag">Promo</span>' : ''}
            ${imgs.length > 1 ? `<button class="gal-arrow l" data-view="-1" aria-label="Previous image">${icon('chevron-left', 18)}</button><button class="gal-arrow r" data-view="1" aria-label="Next image">${icon('chevron-right', 18)}</button>` : ''}</div>
          <div class="gal-progress"><span class="num small">${v.view + 1} / ${imgs.length}</span><i><b style="width:${((v.view + 1) / imgs.length) * 100}%"></b></i></div>
        </div>
        <div class="pdp-info">
          <h1>${esc(p.name)}</h1>
          <div class="muted">Product Code: ${esc(codeOf(p))}</div>
          <div class="pdp-price">${priceHTML(p)}</div>
          <div class="pdp-opt"><span class="muted">Color: <b class="ink">${esc(color.name)}</b></span><div class="cthumbs lg">${Shop.colorThumbs(p, v.color)}</div></div>
          <div class="pdp-opt"><div class="row between"><b>Select Size</b><button class="btn-link" type="button" data-sizeguide>Size Guide ${icon('ruler', 16)}</button></div>
            <div class="size-pills">${Shop.sizePills(p, v.size)}</div>
            ${left != null && left <= 3 ? `<p class="lowstock">Only ${left} left</p>` : ''}
            ${total <= 0 ? '<p class="lowstock">Sold out online. Try Find in store.</p>' : ''}
            <p class="xs err" id="size-err" hidden>Please choose a size first.</p></div>
          <div class="pdp-cta"><button class="btn btn-primary btn-lg btn-block" data-add ${total <= 0 ? 'disabled' : ''}>${icon('bag-plus', 20)} Add to bag</button><button class="btn btn-outline btn-lg btn-block" data-find>Find in store</button></div>
          <div class="share" aria-label="Share"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on Facebook">${icon('facebook', 20)}</a><a href="${esc(settings.messenger)}" target="_blank" rel="noopener" aria-label="Message us">${icon('message', 20)}</a><a href="https://wa.me/?text=${encodeURIComponent(p.name + ' ' + url)}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">${icon('whatsapp', 20)}</a><button type="button" data-copy aria-label="Copy link">${icon('link', 20)}</button></div>
          <div class="desc ${v.more ? 'open' : ''}"><p>${esc(p.short)}</p><div class="desc-more">${p.long}</div><button class="btn-link small" type="button" data-more>${v.more ? 'Show less' : 'Read more'}</button></div>
          <div class="acc">
            <details><summary>Details${icon('plus', 16)}</summary><div class="acc-b"><table class="gtable"><tbody><tr><th>Style</th><td style="text-transform:capitalize">${esc(p.style)}</td></tr><tr><th>Sizes</th><td>${p.sizes.map((s) => esc(S.sizeLabel(s))).join(', ')}</td></tr><tr><th>Colours</th><td>${p.colors.map((c) => esc(c.name)).join(', ')}</td></tr><tr><th>Code</th><td>${esc(codeOf(p))}</td></tr></tbody></table></div></details>
            <details><summary>Materials${icon('plus', 16)}</summary><div class="acc-b"><p class="muted">${esc(p.fabric)}</p></div></details>
            <details><summary>Care${icon('plus', 16)}</summary><div class="acc-b"><p class="muted">Gentle machine wash in cold water. Cool iron on the reverse. Do not bleach. Dry in shade.</p></div></details>
          </div>
        </div>`;
    };
    root.addEventListener('click', (e) => {
      const t = e.target;
      const c = t.closest('[data-color]'); if (c) { v.color = c.dataset.color; if (v.size && S.onlineStock(p.id, v.size) <= 0) v.size = ''; paint(); return; }
      const s = t.closest('[data-size]'); if (s) { v.size = s.dataset.size; paint(); return; }
      const g = t.closest('[data-view]'); if (g) { v.dir = Number(g.dataset.view); v.view += v.dir; paint(); v.dir = 0; return; }
      if (t.closest('[data-more]')) { v.more = !v.more; paint(); return; }
      if (t.closest('[data-find]')) { Shop.findInStore(p, v.size || null); return; }
      if (t.closest('[data-copy]')) { try { navigator.clipboard.writeText(location.href); A.toast('Link copied'); } catch (er) { A.toast('Copy the address from your browser bar'); } return; }
      if (t.closest('[data-add]')) {
        if (!v.size) { $('#size-err').hidden = false; $('.size-pills').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        if (Cart.add({ id: p.id, size: v.size, color: v.color, qty: 1 })) Shop.openDrawer(); else A.toast('That size just sold out online', 'err');
      }
    });
    let sx = null; let sy = null;
    root.addEventListener('touchstart', (e) => { if (!e.target.closest('.pdp-main')) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; const dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      v.dir = dx < 0 ? 1 : -1; v.view += v.dir; paint(); v.dir = 0;
    });
    paint();
    const rel = S.published().filter((x) => x.id !== p.id).map((x) => ({ x, score: x.cats.filter((c) => p.cats.includes(c)).length * 10 + (x.style === p.style ? 2 : 0) + x.rating })).sort((a, b) => b.score - a.score).slice(0, 8).map((r) => r.x);
    $('#related').innerHTML = rail(rel.map(card).join(''), 'products');
    $('#recent-host').innerHTML = recentRail(p.id);
    Shop.syncRails();
  };

  /* ======================================================================
     Bag
     ====================================================================== */
  P.bag = () => {
    let couponMsg = '';
    const render = () => {
      const lines = Cart.lines();
      const sel = lines.filter((l) => l.sel !== false);
      const t = Cart.totals();
      $('#bag-title').innerHTML = `Shopping Bag <small class="muted">(${A.plural(Cart.count(), 'Item')})</small>`;
      if (!lines.length) {
        $('#bag-list').innerHTML = `<div class="empty">${icon('bag', 48)}<h2>Your bag is empty</h2><p class="muted">Looks like you haven't added anything yet.</p><a class="btn btn-primary btn-lg" href="shop.html">Browse the collection</a></div>`;
        $('#bag-summary').hidden = true; return;
      }
      $('#bag-summary').hidden = false;
      $('#bag-list').innerHTML = `<div class="bag-head"><label class="check"><input type="checkbox" id="sel-all" ${sel.length === lines.length ? 'checked' : ''}> <span>Select All</span> <span class="muted xs">(${sel.length} selected)</span></label><button class="icon-btn" data-del-sel aria-label="Remove selected" ${sel.length ? '' : 'disabled'}>${icon('trash', 18)}</button></div>` +
        lines.map((l) => {
          const avail = S.onlineStock(l.id, l.size);
          return `<div class="bag-line" data-key="${esc(l.key)}">
            <input type="checkbox" class="line-sel" data-sel="${esc(l.key)}" ${l.sel !== false ? 'checked' : ''} aria-label="Select ${esc(l.p.name)}">
            <a class="bl-thumb stage ${stageOf(l.p)}" style="--tint:${l.color}" href="product.html?id=${l.p.id}">${S.thumb(l.p, 'front', l.color)}</a>
            <div class="bl-info"><a class="bl-name" href="product.html?id=${l.p.id}">${esc(l.p.name)}</a>
              <dl class="bl-dl"><dt>Code:</dt><dd>${esc(codeOf(l.p))}</dd><dt>SIZE:</dt><dd>${esc(S.sizeLabel(l.size))}</dd><dt>Color:</dt><dd>${esc((l.p.colors.find((c) => c.hex === l.color) || {}).name || '')}</dd></dl>
              <div class="bl-price">${priceHTML(l.p)}</div>
              <div class="row between">${Shop.qtyBox(l.qty, l.key)}<b class="num bl-total">${money(S.price(l.p) * l.qty)}</b></div>
              ${avail <= 3 ? `<p class="lowstock">Only ${avail} left</p>` : ''}</div>
            <button class="icon-btn" data-remove="${esc(l.key)}" aria-label="Remove ${esc(l.p.name)}">${icon('trash', 18)}</button></div>`;
        }).join('') + `<a class="btn btn-outline btn-block" href="shop.html" style="margin-top:18px">CONTINUE SHOPPING</a>`;

      $('#bag-summary').innerHTML = `<div class="sum-card glass"><h2>Order Summary</h2>
          <div class="sum-row"><span>Sub total</span><span class="num">${money(t.subtotal)}</span></div>
          ${t.couponDiscount ? `<div class="sum-row"><span>Promo ${esc(Cart.couponCode().toUpperCase())}</span><span class="num ok">− ${money(t.couponDiscount)}</span></div>` : ''}
          ${t.vat ? `<div class="sum-row"><span>VAT (${settings.vatRate}%)</span><span class="num">${money(t.vat)}</span></div>` : ''}
          <hr><div class="sum-row total"><span>Total</span><b class="num">${money(t.total)}</b></div>
          ${t.savings ? `<p class="xs ok">You are saving ${money(t.savings)} on this order.</p>` : ''}</div>
        <details class="promo-box glass-soft" ${Cart.couponCode() || couponMsg ? 'open' : ''}><summary>Have a promo code?</summary>
          ${Cart.couponCode() && !t.couponError ? `<div class="coupon-on"><span>${icon('tag', 16)} <b>${esc(Cart.couponCode().toUpperCase())}</b> applied</span><button class="btn-link small" data-coupon-remove type="button">Remove</button></div>` : `<div class="row gap-8" style="margin-top:10px"><input id="coupon-in" type="text" placeholder="e.g. WELCOME10" autocomplete="off"><button class="btn btn-glass" data-coupon-apply type="button">Apply</button></div>`}
          ${t.couponError || couponMsg ? `<span class="xs err">${esc(t.couponError || couponMsg)}</span>` : ''}</details>
        <a class="help glass-soft" href="tel:${esc(settings.phone.replace(/[^\d+]/g, ''))}"><span>Help with your order</span><b>${icon('phone', 16)} ${esc(settings.phone)}</b></a>
        <a class="btn btn-primary btn-lg btn-block ${sel.length ? '' : 'disabled'}" href="${sel.length ? 'checkout.html' : '#'}" ${sel.length ? '' : 'aria-disabled="true"'}>Proceed to checkout</a>`;
    };
    document.addEventListener('amnu:cart', render);
    $('#bag-list').addEventListener('click', (e) => {
      const t = e.target;
      const rm = t.closest('[data-remove]'); if (rm) { Cart.remove(rm.dataset.remove); return; }
      if (t.closest('[data-del-sel]')) { Cart.removeSelected(); return; }
      const q = t.closest('.qty [data-q]'); if (q) { const l = Cart.items().find((x) => x.key === q.closest('.qty').dataset.key); if (l) Cart.setQty(l.key, l.qty + Number(q.dataset.q)); }
    });
    $('#bag-list').addEventListener('change', (e) => {
      if (e.target.id === 'sel-all') Cart.toggleAll(e.target.checked);
      if (e.target.dataset.sel) Cart.toggle(e.target.dataset.sel, e.target.checked);
    });
    $('#bag-summary').addEventListener('click', (e) => {
      if (e.target.closest('[data-coupon-apply]')) {
        const code = $('#coupon-in').value.trim(); if (!code) return;
        DB.set('cart.coupon', code);
        const t = Cart.totals();
        if (t.couponError) { couponMsg = t.couponError; DB.remove('cart.coupon'); render(); A.toast(couponMsg, 'err'); } else { couponMsg = ''; render(); A.toast('Promo code applied'); }
      }
      if (e.target.closest('[data-coupon-remove]')) { couponMsg = ''; DB.remove('cart.coupon'); render(); }
      if (e.target.closest('a.disabled')) e.preventDefault();
    });
    render();
    $('#suggest').innerHTML = rail(popular(S.published()).slice(0, 8).map(card).join(''), 'products');
    $('#recent-host').innerHTML = recentRail();
    Shop.syncRails();
  };

  /* ======================================================================
     Checkout (3 steps: shipping details → shipping method → payment)
     ====================================================================== */
  const BRANCHES = ['Main branch', 'Bus stand branch', 'Bazar road branch', 'Station road branch'];
  P.checkout = () => {
    const root = $('#co-steps');
    if (!Cart.selected().length) {
      $('#co-wrap').innerHTML = `<div class="empty glass pad"><h2>Your bag is empty</h2><p class="muted">Select items in your bag before checking out.</p><a class="btn btn-primary" href="bag.html">Go to bag</a></div>`;
      return;
    }
    const user = Auth.user();
    const addrs = (user && user.addresses) || [];
    const def = addrs.find((a) => a.default) || addrs[0] || null;
    const st = {
      step: 1, addr: def, editing: !def, addrId: def ? def.id : null, method: '', loc: def ? (def.district === 'Dhaka' ? 'inside' : 'outside') : '',
      pickup: '', cDistrict: '', cBranch: '', pay: 'cod', via: 'bkash', trx: '', terms: false, errs: {}
    };
    const cfg = S.settings();
    const fulfil = () => (st.method === 'store' && st.pickup ? st.pickup : S.onlineLoc());
    const shipCost = () => {
      const t0 = Cart.totals();
      const base = t0.subtotal - t0.couponDiscount;
      if (st.method === 'store') return 0;
      if (st.method === 'courier') return cfg.shipping.pickup;
      if (st.method === 'home') return base >= cfg.shipping.freeOver ? 0 : (st.loc === 'inside' ? cfg.shipping.dhaka : cfg.shipping.outside);
      return null;
    };
    const totals = () => Cart.totals({ shipping: shipCost(), digital: st.pay === 'digital' });
    const methodLabel = () => ({ home: st.loc === 'inside' ? 'Inside Dhaka · Home delivery' : 'Outside Dhaka · Home delivery', courier: `Courier branch pickup (${st.cDistrict} · ${st.cBranch})`, store: `Showroom pickup (${S.locName(st.pickup)})` }[st.method] || '');

    const head = (n, title, done) => `<div class="step-h ${st.step === n ? 'on' : ''} ${st.step < n ? 'todo' : ''}"><span class="step-n">${done ? icon('check', 16) : n}</span><h2>${title}</h2>${done && st.step !== n ? `<button class="btn-link" data-edit="${n}" type="button">Edit</button>` : ''}</div>`;
    const field = (name, label, val, extra = '') => `<div class="field ${st.errs[name] ? 'err' : ''}"><label for="a-${name}">${label}</label><input id="a-${name}" data-f="${name}" value="${esc(val || '')}" ${extra}><span class="msg">${esc(st.errs[name] || '')}</span></div>`;

    const step1 = () => {
      let body;
      if (st.step === 1) {
        body = `${addrs.length && !st.editing ? `<div class="addr-list">${addrs.map((a) => `<label class="addr-card ${a.id === st.addrId ? 'on' : ''}"><input type="radio" name="addr" value="${a.id}" ${a.id === st.addrId ? 'checked' : ''}><div><b>${esc(a.label || a.district)}</b>${a.default ? '<span class="tag-default">Default</span>' : ''}<p>${esc(a.name)}</p><p class="muted small">${esc(a.address)}, ${esc(a.district)}</p><p class="muted small">${esc(a.phone)}</p></div></label>`).join('')}</div><button class="btn-link" data-new-addr type="button">+ Use a different address</button>`
          : `<div class="form-grid">${field('name', 'Full name *', (st.addr || {}).name || (user || {}).name, 'autocomplete="name"')}${field('phone', 'Mobile number *', (st.addr || {}).phone || (user || {}).phone, 'type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"')}
              ${field('email', 'Email (optional)', (st.addr || {}).email || (user || {}).email, 'type="email" autocomplete="email"')}
              <div class="field ${st.errs.district ? 'err' : ''}"><label for="a-district">District *</label><select id="a-district" data-f="district"><option value="">Select district…</option>${S.districts.map((d) => `<option ${((st.addr || {}).district === d) ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select><span class="msg">${esc(st.errs.district || '')}</span></div>
              <div class="field full ${st.errs.address ? 'err' : ''}"><label for="a-address">Full address *</label><textarea id="a-address" data-f="address" rows="2" placeholder="House, road, area, thana">${esc((st.addr || {}).address || '')}</textarea><span class="msg">${esc(st.errs.address || '')}</span></div></div>
              ${user ? '<label class="check small"><input type="checkbox" id="save-addr" checked> Save this address to my account</label>' : '<p class="xs muted"><a class="u" href="login.html?next=checkout.html">Sign in</a> to use saved addresses and earn loyalty points.</p>'}`}
          <button class="btn btn-primary" data-s1 type="button">Continue</button>`;
      } else if (st.addr) body = `<div class="addr-card static"><div><b>${esc(st.addr.district)}</b><p>${esc(st.addr.name)}</p><p class="muted small">${esc(st.addr.address)}</p><p class="muted small">${esc(st.addr.phone)}</p></div></div>`;
      else body = '';
      return `<section class="step glass">${head(1, 'Shipping Details', st.step > 1)}<div class="step-b">${body}</div></section>`;
    };

    const step2 = () => {
      let body = '';
      if (st.step === 2) {
        const base = Cart.totals(); const free = base.subtotal - base.couponDiscount >= cfg.shipping.freeOver;
        const opt = (k, title, fee, sub) => `<label class="option ${st.method === k ? 'on' : ''}"><input type="radio" name="method" value="${k}" ${st.method === k ? 'checked' : ''}><span class="grow"><b>${title}</b><span class="xs muted" style="display:block">${sub}</span></span><b class="num">${fee}</b></label>`;
        body = `<p class="hint-line">Select economy shipping for ground shipping with the least environmental impact</p>
          <div class="field sel"><label for="s-loc">Select Location*</label><select id="s-loc"><option value="inside" ${st.loc === 'inside' ? 'selected' : ''}>Inside Dhaka City</option><option value="outside" ${st.loc === 'outside' ? 'selected' : ''}>Outside Dhaka City</option></select></div>
          <div class="options two">${opt('home', `${st.loc === 'inside' ? 'Inside' : 'Outside'} Dhaka — Home delivery`, free ? 'Free' : money(st.loc === 'inside' ? cfg.shipping.dhaka : cfg.shipping.outside), st.loc === 'inside' ? 'Delivered to your door in 1–2 working days' : 'Delivered by courier in 3–5 working days')}
            ${st.loc === 'outside' ? opt('courier', 'Courier branch pickup', money(cfg.shipping.pickup), 'Collect from your nearest courier branch') : ''}
            ${opt('store', 'Pick up from a showroom', 'Free', 'Reserve online, collect in store')}</div>
          ${st.method === 'courier' ? `<h4 class="req">Courier pickup location</h4><div class="form-grid"><div class="field sel"><label for="c-dist">Select District *</label><select id="c-dist"><option value="">Select Your District</option>${S.districts.filter((d) => d !== 'Dhaka').map((d) => `<option ${st.cDistrict === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div class="field sel"><label for="c-branch">Select Branch Name *</label><select id="c-branch"><option value="">Select your branch</option>${BRANCHES.map((b) => `<option ${st.cBranch === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div></div>` : ''}
          ${st.method === 'store' ? `<h4 class="req">Choose a showroom</h4><div class="options">${S.showrooms().map((l) => `<label class="option ${st.pickup === l.id ? 'on' : ''}"><input type="radio" name="pickup" value="${l.id}" ${st.pickup === l.id ? 'checked' : ''}><span class="grow"><b>${esc(l.name)}</b><span class="xs muted" style="display:block">${esc(l.address)} · ${esc(l.hours)}</span></span>${pickupStock(l.id)}</label>`).join('')}</div>` : ''}
          ${st.method === 'store' && st.pickup && !canS2() ? '<p class="xs err">This showroom doesn\'t have all the items you selected in stock. Choose another showroom or home delivery.</p>' : ''}
          <button class="btn btn-primary btn-lg btn-block" data-s2 type="button" ${canS2() ? '' : 'disabled'}>Proceed to Payment</button>`;
      } else if (st.step > 2) body = `<div class="addr-card static"><div><b>${esc(methodLabel())}</b><p class="muted small">${shipCost() ? money(shipCost()) : 'Free'}</p></div></div>`;
      return `<section class="step glass ${st.step < 2 ? 'dim' : ''}">${head(2, 'Choose your shipping method', st.step > 2)}<div class="step-b">${body}</div></section>`;
    };
    const pickupStock = (loc) => {
      const ok = Cart.selected().every((l) => S.stock(l.id, loc, l.size) >= l.qty);
      return `<span class="badge ${ok ? 'b-ok' : 'b-err'}">${ok ? 'Available' : 'Not all items in stock'}</span>`;
    };
    const canS2 = () => (st.method === 'home') || (st.method === 'courier' && st.cDistrict && st.cBranch) || (st.method === 'store' && st.pickup && Cart.selected().every((l) => S.stock(l.id, st.pickup, l.size) >= l.qty));

    const step3 = () => {
      let body = '';
      if (st.step === 3) {
        const t = totals();
        const pct = cfg.digitalDiscountPct;
        body = `<div class="options two">
            <label class="option ${st.pay === 'cod' ? 'on' : ''}"><input type="radio" name="pay" value="cod" ${st.pay === 'cod' ? 'checked' : ''}><span><b>${st.method === 'store' ? 'Pay at the showroom' : 'Cash on Delivery'}</b><span class="xs muted" style="display:block">Pay for your product when you get it in hand</span></span></label>
            <label class="option ${st.pay === 'digital' ? 'on' : ''}"><input type="radio" name="pay" value="digital" ${st.pay === 'digital' ? 'checked' : ''}><span><b>Digital Payment</b><span class="xs muted" style="display:block">${pct ? `Save ${pct}% on entire order with digital payment. ` : ''}Pay through bKash, Nagad or card.</span></span></label></div>
          ${st.pay === 'digital' ? `<div class="via">${['bkash', 'nagad', 'card'].map((k) => `<label class="chip ${st.via === k ? 'active' : ''}"><input type="radio" name="via" value="${k}" hidden ${st.via === k ? 'checked' : ''}>${S.payLabel[k]}</label>`).join('')}</div>
            ${st.via === 'card' ? '<p class="xs muted">You will be redirected to a secure payment page after confirming. (Demo: connect a gateway such as SSLCommerz.)</p>' : `<div class="pay-note glass-soft"><p class="small">Send <b>${money(t.total)}</b> to <b>${esc(st.via === 'bkash' ? cfg.bkashNumber : cfg.nagadNumber)}</b> (Send Money), then enter the Transaction ID.</p><div class="field ${st.errs.trx ? 'err' : ''}" style="margin-top:10px"><label for="trx">Transaction ID *</label><input id="trx" value="${esc(st.trx)}" placeholder="e.g. 9H7K2LMN4P" autocomplete="off"><span class="msg">${esc(st.errs.trx || '')}</span></div></div>`}` : ''}
          <label class="check terms"><input type="checkbox" id="terms" ${st.terms ? 'checked' : ''}> <span>I read and accept <a class="u" href="policy.html?p=privacy" target="_blank">Privacy Policy</a>, <a class="u" href="policy.html?p=exchange" target="_blank">Exchange &amp; Return</a> and <a class="u" href="policy.html?p=terms" target="_blank">Terms &amp; Conditions</a></span></label>
          <button class="btn btn-primary btn-lg btn-block" data-confirm type="button" ${st.terms ? '' : 'disabled'}>Confirm Order</button>`;
      }
      return `<section class="step glass ${st.step < 3 ? 'dim' : ''}">${head(3, 'Choose your payment method', false)}<div class="step-b">${body}</div></section>`;
    };

    const summary = () => {
      const t = totals();
      return `<div class="sum-card glass"><h2>Order Summary</h2>
          <div class="sum-row"><span>Sub total</span><span class="num">${money(t.subtotal)}</span></div>
          ${t.couponDiscount ? `<div class="sum-row"><span>Promo ${esc(Cart.couponCode().toUpperCase())}</span><span class="num ok">− ${money(t.couponDiscount)}</span></div>` : ''}
          ${t.digitalDiscount ? `<div class="sum-row"><span>Digital payment (${cfg.digitalDiscountPct}%)</span><span class="num ok">− ${money(t.digitalDiscount)}</span></div>` : ''}
          ${t.vat ? `<div class="sum-row"><span>VAT (${cfg.vatRate}%)</span><span class="num">${money(t.vat)}</span></div>` : ''}
          ${st.method ? `<div class="sum-row"><span>${esc(methodLabel() || 'Delivery')}</span><span class="num">${t.shipping ? money(t.shipping) : 'Free'}</span></div>` : ''}
          <hr><div class="sum-row total"><span>Total</span><b class="num">${money(t.total)}</b></div></div>
        <details class="bag-box glass" open><summary>Your Bag ${icon('chevron-up', 18)}</summary><div class="bag-box-b">${t.lines.map((l) => `<div class="cb-line"><span class="cb-thumb stage ${stageOf(l.p)}" style="--tint:${l.color}">${S.thumb(l.p, 'front', l.color)}</span><div class="grow"><b class="small">${esc(l.p.name)}</b><dl class="bl-dl"><dt>Code:</dt><dd>${esc(codeOf(l.p))}</dd><dt>SIZE:</dt><dd>${esc(S.sizeLabel(l.size))}</dd><dt>Color:</dt><dd>${esc((l.p.colors.find((c) => c.hex === l.color) || {}).name || '')}</dd><dt>Quantity:</dt><dd>${l.qty}</dd></dl>${priceHTML(l.p)}</div><b class="num small">${money(S.price(l.p) * l.qty)}</b></div>`).join('')}</div></details>`;
    };

    const paint = () => { root.innerHTML = step1() + step2() + step3(); $('#co-summary').innerHTML = summary(); };

    const collect = () => {
      const g = (n) => { const el = $(`[data-f="${n}"]`, root); return el ? el.value.trim() : ''; };
      return { name: g('name'), phone: g('phone').replace(/\s/g, ''), email: g('email'), district: g('district'), address: g('address') };
    };
    root.addEventListener('click', (e) => {
      const t = e.target;
      const ed = t.closest('[data-edit]'); if (ed) { st.step = Number(ed.dataset.edit); paint(); return; }
      if (t.closest('[data-new-addr]')) { st.editing = true; st.addr = null; paint(); return; }
      if (t.closest('[data-s1]')) {
        let a;
        if (addrs.length && !st.editing) a = addrs.find((x) => x.id === st.addrId);
        else {
          a = collect(); st.errs = {};
          if (a.name.length < 2) st.errs.name = 'Please enter your name.';
          if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(a.phone.replace(/-/g, ''))) st.errs.phone = 'Enter a valid mobile number (01XXXXXXXXX).';
          if (a.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) st.errs.email = 'That email does not look right.';
          if (!a.district) st.errs.district = 'Please choose your district.';
          if (a.address.length < 8) st.errs.address = 'Please enter your full address.';
          if (Object.keys(st.errs).length) { st.addr = a; paint(); A.toast('Please fix the highlighted fields', 'err'); return; }
          if (user && $('#save-addr') && $('#save-addr').checked) {
            const list = addrs.slice(); const rec = Object.assign({ id: A.uid(), label: a.district, default: !list.length }, a); list.push(rec); Auth.save({ addresses: list }); a = rec;
          }
        }
        st.addr = a; st.loc = a.district === 'Dhaka' ? 'inside' : 'outside'; if (st.method === 'courier' && st.loc === 'inside') st.method = ''; st.step = 2; paint(); return;
      }
      if (t.closest('[data-s2]')) { st.step = 3; paint(); return; }
      if (t.closest('[data-confirm]')) place();
    });
    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'addr') { st.addrId = t.value; paint(); return; }
      if (t.id === 's-loc') { st.loc = t.value; if (st.method === 'courier' && st.loc === 'inside') st.method = ''; paint(); return; }
      if (t.name === 'method') { st.method = t.value; if (st.method === 'store' && !st.pickup) st.pickup = (S.showrooms()[0] || {}).id || ''; paint(); return; }
      if (t.name === 'pickup') { st.pickup = t.value; paint(); return; }
      if (t.id === 'c-dist') { st.cDistrict = t.value; paint(); return; }
      if (t.id === 'c-branch') { st.cBranch = t.value; paint(); return; }
      if (t.name === 'pay') { st.pay = t.value; paint(); return; }
      if (t.name === 'via') { st.via = t.value; paint(); return; }
      if (t.id === 'terms') { st.terms = t.checked; $('[data-confirm]', root).disabled = !st.terms; }
    });
    root.addEventListener('input', (e) => { if (e.target.id === 'trx') st.trx = e.target.value; });

    function place() {
      st.errs = {};
      if (st.pay === 'digital' && st.via !== 'card' && st.trx.trim().length < 6) { st.errs.trx = 'Please enter the transaction ID.'; paint(); A.toast('Enter the transaction ID', 'err'); return; }
      const loc = fulfil();
      const short = Cart.selected().filter((l) => S.stock(l.id, loc, l.size) < l.qty);
      if (short.length) { A.toast(`${short[0].p.name} (${S.sizeLabel(short[0].size)}) is no longer available in that quantity.`, 'err'); return; }
      const t = totals();
      const pay = st.pay === 'cod' ? 'cod' : st.via;
      const payments = [];
      if (t.total > 0) payments.push({ method: pay, amount: t.total });
      const a = st.addr;
      const order = S.addOrder({
        channel: 'online', storeId: loc, customer: { name: a.name, phone: a.phone, email: a.email || '', district: a.district, address: a.address },
        items: t.lines.map((l) => ({ pid: l.p.id, name: l.p.name, price: S.price(l.p), cost: l.p.cost, qty: l.qty, size: l.size, color: (l.p.colors.find((c) => c.hex === l.color) || {}).name || '', hex: l.color, style: l.p.style })),
        subtotal: t.subtotal, shipping: t.shipping || 0, discount: t.discount, coupon: t.couponDiscount || t.freeShip ? Cart.couponCode().toUpperCase() : '', vat: t.vat, total: t.total,
        payment: pay, payments, payRef: st.trx.trim(), shippingMethod: methodLabel(), pickup: st.method === 'store' ? st.pickup : '',
        status: t.total <= 0 ? 'processing' : st.pay === 'cod' ? 'processing' : pay === 'card' ? 'pending' : 'on-hold',
        notes: [{ text: 'Order placed by customer from the storefront.', date: new Date().toISOString(), by: 'System' }]
      });
      if (t.couponDiscount || t.freeShip) { const cs = S.coupons(); const c = cs.find((x) => x.code.toLowerCase() === Cart.couponCode().toLowerCase()); if (c) { c.used += 1; S.saveCoupons(cs); } }
      Cart.clearPurchased();
      location.href = `thank-you.html?order=${order.id}`;
    }
    paint();
  };

  /* ======================================================================
     Thank you
     ====================================================================== */
  P.thanks = () => {
    const o = S.order(A.qs.get('order'));
    const root = $('#thanks');
    if (!o) { root.innerHTML = `<div class="thanks"><h1>Order not found</h1><p class="muted">We couldn't find that order. Use the tracking page with your order number and phone.</p><a class="btn btn-primary" href="track-order.html">Track an order</a></div>`; return; }
    root.innerHTML = `<div class="thanks">
      <span class="thanks-ico">${icon('check', 40)}</span>
      <h1>Thank you!</h1>
      <p class="muted">Your order has been placed successfully. You can check your order updates by visiting the Order History page from your profile menu.</p>
      <div class="thanks-meta glass"><div><span class="xs muted">Order number</span><b>#${o.id}</b></div><div><span class="xs muted">Total</span><b>${money(o.total)}</b></div><div><span class="xs muted">Payment</span><b>${esc(S.payLabel[o.payment])}</b></div><div><span class="xs muted">${o.pickup ? 'Pick up at' : 'Delivering to'}</span><b>${esc(o.pickup ? S.locName(o.pickup) : o.customer.district)}</b></div></div>
      <a class="btn btn-primary btn-lg" href="index.html">CONTINUE SHOPPING</a><a class="btn btn-outline btn-lg" href="account.html#orders">ORDER HISTORY</a>
      <a class="u small" href="track-order.html?order=${o.id}">Track this order</a></div>`;
  };
})();
