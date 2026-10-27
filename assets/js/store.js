/* ==========================================================================
   Amnu Fashion — storefront
   Shared chrome (header / footer / cart drawer / search), the cart, and one
   renderer per page (selected by <body data-page="…">).
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const { $, $$, esc, icon, money } = A;

  const settings = S.settings();
  A.applyLook(S.look());

  /* ======================================================================
     Cart
     ====================================================================== */
  const lineKey = (id, size, color) => [id, size, color].join('|');
  const Cart = {
    items: () => DB.get('cart', []),
    save(list) { DB.set('cart', list); document.dispatchEvent(new Event('amnu:cart')); },
    add({ id, size, color, qty = 1 }) {
      const p = S.product(id);
      if (!p || p.stock <= 0) return false;
      const list = Cart.items();
      const key = lineKey(id, size, color);
      const hit = list.find((l) => l.key === key);
      if (hit) hit.qty = Math.min(p.stock, hit.qty + qty); else list.push({ key, id, size, color, qty: Math.min(p.stock, qty) });
      Cart.save(list);
      return true;
    },
    setQty(key, qty) {
      const list = Cart.items();
      const l = list.find((x) => x.key === key);
      if (!l) return;
      const p = S.product(l.id);
      l.qty = A.clamp(qty, 1, Math.max(1, p ? p.stock : 99));
      Cart.save(list);
    },
    remove(key) { Cart.save(Cart.items().filter((l) => l.key !== key)); },
    clear() { DB.remove('cart.coupon'); Cart.save([]); },
    lines() {
      return Cart.items().map((l) => ({ ...l, p: S.product(l.id) })).filter((l) => l.p && l.p.status === 'publish');
    },
    count: () => Cart.items().reduce((n, l) => n + l.qty, 0),
    subtotal: () => Cart.lines().reduce((n, l) => n + S.price(l.p) * l.qty, 0),
    couponCode: () => DB.get('cart.coupon', ''),
    /** totals for a given district (null = not chosen yet) */
    totals(district) {
      const subtotal = Cart.subtotal();
      const code = Cart.couponCode();
      let discount = 0;
      let freeShip = false;
      let couponError = '';
      if (code) {
        const r = S.applyCoupon(code, subtotal);
        if (r.ok) { discount = r.discount; freeShip = !!r.freeShip; } else { couponError = r.error; }
      }
      const base = district ? S.shipping(district, subtotal - discount, settings) : null;
      const shipping = freeShip ? 0 : base;
      return { subtotal, discount, shipping, freeShip, couponError, total: subtotal - discount + (shipping || 0) };
    }
  };

  /* ======================================================================
     Shared view helpers
     ====================================================================== */
  const catName = (slug) => (S.categories().find((c) => c.slug === slug) || {}).name || slug;
  const pct = (p) => (p.sale ? Math.round((1 - p.sale / p.price) * 100) : 0);
  const priceHTML = (p) => `<span class="price">${money(S.price(p))}${p.sale ? `<del>${money(p.price)}</del>` : ''}</span>`;

  function card(p) {
    const wished = S.wishlist().includes(p.id);
    const out = p.stock <= 0;
    const tag = out ? '<span class="tag tag-out">Sold out</span>' : p.sale ? `<span class="tag tag-sale">-${pct(p)}%</span>` : p.badge ? `<span class="tag">${esc(p.badge)}</span>` : '';
    return `<article class="pcard glass" data-id="${p.id}">
      <a class="pcard-img" href="product.html?id=${p.id}" aria-label="${esc(p.name)}">${S.thumb(p)}${tag}</a>
      <button class="wish ${wished ? 'on' : ''}" data-wish="${p.id}" aria-label="Toggle wishlist" aria-pressed="${wished}">${icon('heart', 18)}</button>
      <div class="pcard-body">
        <a class="pcard-title" href="product.html?id=${p.id}">${esc(p.name)}</a>
        <div class="pcard-sub">${esc(catName(p.cats[0]))}</div>
        <div class="pcard-rate">${A.stars(p.rating)}<span class="xs muted">${p.reviews ? `(${p.reviews})` : ''}</span></div>
        <div class="pcard-foot">${priceHTML(p)}<button class="add-btn" data-quick="${p.id}" ${out ? 'disabled' : ''} aria-label="Quick add ${esc(p.name)} to cart">${icon(out ? 'x' : 'bag', 18)}</button></div>
      </div>
    </article>`;
  }
  const grid = (list) => list.map(card).join('') || '<div class="empty glass pad"><h3>No products found</h3><p class="muted">Try changing your filters or search.</p></div>';

  const swatches = (p, hex, attr = 'data-color') => p.colors.map((c) => `<button type="button" class="swatch ${c.hex === hex ? 'on' : ''}" ${attr}="${c.hex}" style="--c:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${c.hex === hex}"></button>`).join('');
  const sizeChips = (p, size, attr = 'data-size') => p.sizes.map((s) => `<button type="button" class="size ${s === size ? 'on' : ''}" ${attr}="${s}" aria-pressed="${s === size}">${s}</button>`).join('');
  const qtyBox = (qty, attrs = '') => `<div class="qty" ${attrs}><button type="button" data-q="-1" aria-label="Decrease quantity">${icon('minus', 14)}</button><span class="num" aria-live="polite">${qty}</span><button type="button" data-q="1" aria-label="Increase quantity">${icon('plus', 14)}</button></div>`;

  function sizeGuide() {
    A.modal({
      title: 'Size guide (sample — edit for your fit)',
      wide: true,
      body: `<div class="table-wrap"><table class="gtable"><thead><tr><th>Size</th><th>Chest (in)</th><th>Length (in)</th><th>Sleeve (in)</th><th>Shoulder (in)</th></tr></thead><tbody>
        <tr><td>M</td><td>40</td><td>40</td><td>24</td><td>17</td></tr><tr><td>L</td><td>42</td><td>41</td><td>24.5</td><td>17.5</td></tr>
        <tr><td>XL</td><td>44</td><td>42</td><td>25</td><td>18</td></tr><tr><td>XXL</td><td>46</td><td>43</td><td>25.5</td><td>18.5</td></tr></tbody></table></div>
        <p class="muted small" style="margin-top:12px">Measure a panjabi that fits you well, lay it flat and compare. Between sizes? Choose the larger size for a relaxed fit. Kids sizes run by age: 2Y – 10Y.</p>`
    });
  }

  /* ======================================================================
     Chrome: announcement, header, footer, cart drawer, search
     ====================================================================== */
  function headerHTML(page) {
    const cat = A.qs.get('cat');
    const link = (href, label, on) => `<a href="${href}" class="${on ? 'active' : ''}">${label}</a>`;
    return `<div class="announce"><span id="announce-text">${esc(settings.announcement)}</span></div>
    <header class="site-header container">
      <div class="nav glass">
        <a class="logo" href="index.html" aria-label="${esc(settings.storeName)} home"><span class="logo-mark">${icon('sparkle', 20)}</span><span class="logo-text">Amnu<small>Fashion</small></span></a>
        <nav class="menu" id="menu" aria-label="Main">
          ${link('index.html', 'Home', page === 'home')}
          ${link('shop.html', 'Shop', page === 'shop' && !cat)}
          ${link('shop.html?cat=eid', 'Eid', cat === 'eid')}
          ${link('shop.html?cat=wedding', 'Wedding', cat === 'wedding')}
          ${link('shop.html?cat=kids', 'Kids', cat === 'kids')}
          ${link('about.html', 'About', page === 'about')}
          ${link('contact.html', 'Contact', page === 'contact')}
        </nav>
        <div class="nav-actions">
          <button class="icon-btn" data-search aria-label="Search">${icon('search', 20)}</button>
          <a class="icon-btn" href="shop.html?wishlist=1" aria-label="Wishlist">${icon('heart', 20)}<span class="count" data-wish-count hidden>0</span></a>
          <button class="icon-btn" data-cart-open aria-label="Open cart">${icon('bag', 20)}<span class="count" data-cart-count hidden>0</span></button>
          <button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">${A.themeIcon()}</button>
          <a class="icon-btn hide-sm" href="admin/login.html" aria-label="Admin dashboard" title="Admin dashboard">${icon('user', 20)}</a>
          <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon('menu', 20)}</button>
        </div>
      </div>
    </header>`;
  }

  function footerHTML() {
    const s = settings;
    return `<footer class="site-footer container">
      <div class="footer-card glass">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="logo" href="index.html"><span class="logo-mark">${icon('sparkle', 20)}</span><span class="logo-text">Amnu<small>Fashion</small></span></a>
            <p class="muted small">${esc(s.tagline)}. Premium panjabi for Eid, weddings and everyday wear.</p>
            <div class="row gap-8"><a class="icon-btn" href="${esc(s.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook', 20)}</a><a class="icon-btn" href="${esc(s.messenger)}" target="_blank" rel="noopener" aria-label="Messenger">${icon('message', 20)}</a></div>
          </div>
          <div><h4>Shop</h4><ul class="flinks"><li><a href="shop.html">All panjabi</a></li><li><a href="shop.html?cat=eid">Eid collection</a></li><li><a href="shop.html?cat=wedding">Wedding &amp; groom</a></li><li><a href="shop.html?cat=cotton">Casual cotton</a></li><li><a href="shop.html?cat=kids">Kids panjabi</a></li></ul></div>
          <div><h4>Help</h4><ul class="flinks"><li><a href="track-order.html">Track your order</a></li><li><a href="contact.html">Contact us</a></li><li><a href="#" data-sizeguide>Size guide</a></li><li><a href="about.html">About us</a></li><li><a href="cart.html">My cart</a></li></ul></div>
          <div><h4>Contact</h4><ul class="flinks contact">
            <li>${icon('phone', 16)}<span>${esc(s.phone)}</span></li><li>${icon('mail', 16)}<span>${esc(s.email)}</span></li><li>${icon('pin', 16)}<span>${esc(s.address)}</span></li></ul></div>
        </div>
        <div class="footer-bottom">
          <span class="muted small">© ${new Date().getFullYear()} ${esc(s.storeName)}. All rights reserved. <a href="admin/login.html" class="admin-link">Admin dashboard</a></span>
          <div class="pay-chips"><span class="badge">Cash on Delivery</span><span class="badge b-accent">bKash</span><span class="badge b-warn">Nagad</span><span class="badge b-info">Visa / Mastercard</span></div>
        </div>
      </div>
    </footer>`;
  }

  function drawerLinesHTML() {
    const lines = Cart.lines();
    if (!lines.length) return `<div class="drawer-empty">${icon('bag', 44)}<h3>Your cart is empty</h3><p class="muted small">Add a panjabi you love and it will show up here.</p><a class="btn btn-primary" href="shop.html">Start shopping</a></div>`;
    return lines.map((l) => `<div class="mini-line" data-key="${esc(l.key)}">
      <a class="mini-thumb" href="product.html?id=${l.p.id}">${S.thumb(l.p, 'front', l.color)}</a>
      <div class="grow"><a class="mini-name" href="product.html?id=${l.p.id}">${esc(l.p.name)}</a>
        <div class="xs muted">Size ${esc(l.size)} · ${esc((l.p.colors.find((c) => c.hex === l.color) || {}).name || '')}</div>
        <div class="row between" style="margin-top:6px">${qtyBox(l.qty, `data-key="${esc(l.key)}"`)}<b class="num">${money(S.price(l.p) * l.qty)}</b></div></div>
      <button class="mini-x" data-remove="${esc(l.key)}" aria-label="Remove ${esc(l.p.name)}">${icon('x', 16)}</button></div>`).join('');
  }
  function drawerHTML() {
    const t = Cart.totals(null);
    return `<div class="drawer-h"><h3>My cart <span class="muted small">(${Cart.count()})</span></h3><button class="icon-btn" data-cart-close aria-label="Close cart">${icon('x', 20)}</button></div>
      <div class="drawer-body">${drawerLinesHTML()}</div>
      ${Cart.count() ? `<div class="drawer-f"><div class="row between"><span class="muted">Subtotal</span><b class="num">${money(t.subtotal)}</b></div><p class="xs muted">Delivery and coupons are applied at checkout.</p>
        <div class="row gap-8"><a class="btn btn-glass grow" href="cart.html">View cart</a><a class="btn btn-primary grow" href="checkout.html">Checkout</a></div></div>` : ''}`;
  }
  function syncCartUI() {
    const n = Cart.count();
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
    const w = S.wishlist().length;
    $$('[data-wish-count]').forEach((el) => { el.textContent = w; el.hidden = !w; });
    const d = $('#drawer');
    if (d) d.innerHTML = drawerHTML();
  }
  const openDrawer = () => { $('#drawer-wrap').classList.add('open'); document.body.classList.add('lock'); };
  const closeDrawer = () => { $('#drawer-wrap').classList.remove('open'); document.body.classList.remove('lock'); };

  function openSearch() {
    const m = A.modal({
      title: 'Search products',
      body: `<form class="input-group" id="sq-form" action="shop.html">${icon('search')}<input id="sq" name="q" type="search" placeholder="Search by name, fabric, colour…" autocomplete="off"></form><div class="search-results" id="sq-results"></div>`,
      onOpen(el) {
        const input = $('#sq', el);
        const out = $('#sq-results', el);
        const show = () => {
          const q = input.value.trim().toLowerCase();
          const hits = S.published().filter((p) => !q || [p.name, p.fabric, p.colorName, p.style, ...p.cats, ...p.tags].join(' ').toLowerCase().includes(q)).slice(0, 6);
          out.innerHTML = hits.length ? hits.map((p) => `<a class="sr-item" href="product.html?id=${p.id}"><span class="sr-thumb">${S.thumb(p)}</span><span class="grow"><b>${esc(p.name)}</b><span class="xs muted" style="display:block">${esc(catName(p.cats[0]))}</span></span><b class="num">${money(S.price(p))}</b></a>`).join('') : '<p class="muted center" style="padding:18px">No matches. Try “cotton”, “navy” or “wedding”.</p>';
        };
        input.addEventListener('input', A.debounce(show, 120));
        show();
      }
    });
    return m;
  }

  function mountChrome(page) {
    $('#site-header').innerHTML = headerHTML(page);
    $('#site-footer').innerHTML = footerHTML();
    const wrap = A.h(`<div class="drawer-wrap" id="drawer-wrap"><div class="drawer-scrim" data-cart-close></div><aside class="drawer glass-strong" id="drawer" aria-label="Shopping cart"></aside></div>`);
    document.body.appendChild(wrap);
    syncCartUI();
    document.addEventListener('amnu:cart', syncCartUI);

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-cart-open]')) { openDrawer(); return; }
      if (t.closest('[data-cart-close]')) { closeDrawer(); return; }
      if (t.closest('[data-search]')) { openSearch(); return; }
      if (t.closest('[data-theme-toggle]')) { A.toggleTheme(); return; }
      if (t.closest('[data-sizeguide]')) { e.preventDefault(); sizeGuide(); return; }
      const toggle = t.closest('#menu-toggle');
      if (toggle) { const open = $('#menu').classList.toggle('open'); toggle.setAttribute('aria-expanded', open); return; }

      const wish = t.closest('[data-wish]');
      if (wish) {
        e.preventDefault();
        const id = Number(wish.dataset.wish);
        const on = S.toggleWish(id);
        $$(`[data-wish="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        syncCartUI();
        A.toast(on ? 'Saved to your wishlist' : 'Removed from wishlist');
        if (document.body.dataset.page === 'shop' && A.qs.get('wishlist')) document.dispatchEvent(new Event('amnu:wish'));
        return;
      }
      const quick = t.closest('[data-quick]');
      if (quick) { quickAdd(Number(quick.dataset.quick)); return; }

      /* mini-cart line controls (drawer + cart page share these) */
      const rm = t.closest('[data-remove]');
      if (rm) { Cart.remove(rm.dataset.remove); return; }
      const q = t.closest('.qty [data-q]');
      if (q && q.closest('.qty').dataset.key) {
        const box = q.closest('.qty');
        const l = Cart.items().find((x) => x.key === box.dataset.key);
        if (l) Cart.setQty(l.key, l.qty + Number(q.dataset.q));
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    /* live preview hook for Admin → Appearance → Customize */
    window.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'amnu-look') return;
      A.applyLook(d.look);
      if (d.announcement != null && $('#announce-text')) $('#announce-text').textContent = d.announcement;
      if (d.heroTitle != null && $('#hero-title')) heroTitle(d.heroTitle);
      if (d.heroSub != null && $('#hero-sub')) $('#hero-sub').textContent = d.heroSub;
    });

    /* demo forms */
    $$('[data-demo-form]').forEach((f) => f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      A.toast(f.dataset.demoForm);
      f.reset();
    }));
    $$('[data-bind]').forEach((el) => { el.textContent = settings[el.dataset.bind] || ''; });
  }

  function quickAdd(id) {
    const p = S.product(id);
    if (!p) return;
    let size = '';
    let color = p.color;
    let qty = 1;
    const body = () => `<div class="qa"><div class="qa-img">${S.thumb(p, 'front', color)}</div><div class="col gap-16">
      <div>${priceHTML(p)}<div class="pcard-rate" style="margin-top:4px">${A.stars(p.rating)}<span class="xs muted">${p.reviews} reviews</span></div></div>
      <div><div class="label" style="margin-bottom:8px">Colour</div><div class="swatches">${swatches(p, color)}</div></div>
      <div><div class="row between" style="margin-bottom:8px"><span class="label">Size</span><button class="btn-link small" type="button" data-sizeguide>Size guide</button></div><div class="size-chips">${sizeChips(p, size)}</div><span class="xs" id="qa-err" style="color:var(--err)" hidden>Please choose a size.</span></div>
      <div>${qtyBox(qty)}</div></div></div>`;
    const m = A.modal({ title: p.name, body: body(), footer: `<a class="btn btn-glass" href="product.html?id=${p.id}">Full details</a><button class="btn btn-primary" data-add>${icon('bag', 18)} Add to cart</button>` });
    const paint = () => { $('.modal-b', m.el).innerHTML = body(); };
    m.el.addEventListener('click', (e) => {
      const t = e.target;
      const c = t.closest('[data-color]'); if (c) { color = c.dataset.color; paint(); }
      const s = t.closest('[data-size]'); if (s) { size = s.dataset.size; paint(); }
      const qb = t.closest('[data-q]'); if (qb) { qty = A.clamp(qty + Number(qb.dataset.q), 1, p.stock); paint(); }
      if (t.closest('[data-add]')) {
        if (!size) { $('#qa-err', m.el).hidden = false; return; }
        Cart.add({ id: p.id, size, color, qty });
        m.close(); openDrawer();
      }
    });
  }

  /* ======================================================================
     Pages
     ====================================================================== */
  const heroTitle = (text) => {
    const words = String(text).trim().split(' ');
    const last = words.pop();
    $('#hero-title').innerHTML = `${esc(words.join(' '))} <span class="grad">${esc(last)}</span>`;
  };

  function endOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }

  const Pages = {
    /* ---------------- home ---------------- */
    home() {
      heroTitle(settings.heroTitle);
      $('#hero-sub').textContent = settings.heroSub;
      $('#hero-free').textContent = `Free delivery over ${money(settings.shipping.freeOver)}`;
      $('#fb-link').href = settings.facebook;
      $('#msgr-link').href = settings.messenger;

      const cats = S.categories();
      $('#hero-chips').innerHTML = `<a class="chip active" href="shop.html">All</a>` + cats.map((c) => `<a class="chip" href="shop.html?cat=${c.slug}">${esc(c.name)}</a>`).join('');

      const pub = S.published();
      const hero = pub.find((p) => p.featured) || pub[0];
      const back1 = pub.find((p) => p.id === 2) || pub[1];
      const back2 = pub.find((p) => p.id === 4) || pub[2];
      $('#hero-art').innerHTML = `<div class="hero-stage glass">
        <div class="hero-bg-pj left">${S.thumb(back1)}</div><div class="hero-bg-pj right">${S.thumb(back2)}</div>
        <a class="hero-main-pj" href="product.html?id=${hero.id}" aria-label="${esc(hero.name)}">${S.thumb(hero)}</a>
        <button class="hero-heart glass" data-wish="${hero.id}" aria-label="Wishlist">${icon('heart', 20)}</button>
        <div class="hero-float f1 glass"><span class="hf-thumb">${S.thumb(hero, 'detail')}</span><div><b>${esc(hero.name.replace(' Panjabi', ''))}</b><div class="row gap-8">${A.stars(hero.rating)}<span class="xs muted">${hero.rating}</span></div><b class="price">${money(S.price(hero))}</b></div></div>
        <div class="hero-float f2 glass"><span class="label">Colour</span><div class="swatches">${hero.colors.map((c) => `<span class="swatch" style="--c:${c.hex}" title="${esc(c.name)}"></span>`).join('')}</div></div>
        <div class="hero-float f3 glass">${icon('truck', 18)}<span class="small bold">Cash on Delivery</span></div></div>`;

      $('#cat-grid').innerHTML = cats.map((c) => {
        const first = S.published().find((p) => p.cats[0] === c.slug) || S.published().find((p) => p.cats.includes(c.slug));
        return `<a class="cat-card glass" href="shop.html?cat=${c.slug}"><span class="cat-art">${first ? S.thumb(first) : ''}</span><b>${esc(c.name)}</b><span class="xs muted">${A.plural(S.categoryCount(c.slug), 'style')}</span></a>`;
      }).join('');

      $('#new-grid').innerHTML = grid(pub.slice().sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 4));

      $('#promo-art').innerHTML = [pub.find((p) => p.id === 8), pub.find((p) => p.id === 7), pub.find((p) => p.id === 2)].filter(Boolean).map((p, i) => `<div class="promo-pj p${i}">${S.thumb(p)}</div>`).join('');
      const end = endOfMonth();
      const tick = () => {
        let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        const parts = [['Days', Math.floor(s / 86400)], ['Hours', Math.floor(s % 86400 / 3600)], ['Mins', Math.floor(s % 3600 / 60)], ['Secs', s % 60]];
        $('#countdown').innerHTML = parts.map(([l, v]) => `<div class="cd glass-soft"><b class="num">${String(v).padStart(2, '0')}</b><span class="xs muted">${l}</span></div>`).join('');
      };
      tick(); setInterval(tick, 1000);

      const tabs = [['best', 'Best sellers'], ['eid', 'Eid'], ['wedding', 'Wedding'], ['cotton', 'Casual'], ['kids', 'Kids']];
      const trend = (key) => {
        const list = pub.filter((p) => key === 'best' || p.cats.includes(key)).sort((a, b) => b.sold - a.sold).slice(0, 4);
        $('#trend-grid').innerHTML = grid(list);
        $$('#trend-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.t === key));
      };
      $('#trend-tabs').innerHTML = tabs.map(([k, l]) => `<button role="tab" data-t="${k}">${l}</button>`).join('');
      $('#trend-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) trend(b.dataset.t); });
      trend('best');

      const reviews = [
        ['Rafiul K.', 'Dhaka', 'Navy jacquard for my nikah: the fabric feels premium and the fit was spot on. Delivery in two days.', 5],
        ['Imran C.', 'Chattogram', 'Ordered two cotton panjabis for Eid. Colours match the photos exactly and the stitching is clean.', 5],
        ['Mahin R.', 'Sylhet', 'COD made it easy to trust a new brand. Size guide was accurate and exchange was hassle-free.', 4]
      ];
      $('#testi-grid').innerHTML = reviews.map(([n, c, t, r]) => `<figure class="testi glass"><div>${A.stars(r)}</div><blockquote>${esc(t)}</blockquote><figcaption><span class="avatar">${esc(n[0])}</span><span><b>${esc(n)}</b><span class="xs muted" style="display:block">${esc(c)} · Verified buyer</span></span></figcaption></figure>`).join('');
    },

    /* ---------------- shop ---------------- */
    shop() {
      const all = S.published();
      const wishMode = !!A.qs.get('wishlist');
      const maxPrice = Math.ceil(Math.max(...all.map((p) => S.price(p))) / 50) * 50;
      const st = {
        cats: (A.qs.get('cat') || '').split(',').filter(Boolean),
        q: A.qs.get('q') || '',
        sort: A.qs.get('sort') || 'featured',
        max: Number(A.qs.get('max')) || maxPrice,
        sizes: (A.qs.get('size') || '').split(',').filter(Boolean),
        colors: (A.qs.get('color') || '').split(',').filter(Boolean),
        stock: A.qs.get('stock') === '1',
        sale: A.qs.get('sale') === '1',
        view: A.qs.get('view') || DB.get('shop.view', 'grid'),
        page: Number(A.qs.get('page')) || 1
      };
      const PER = 9;
      const range = $('#f-price');
      range.max = maxPrice; range.value = st.max;
      $('#f-price-hi').textContent = money(maxPrice);

      $('#f-cats').innerHTML = S.categories().map((c) => `<label class="check"><input type="checkbox" data-cat="${c.slug}" ${st.cats.includes(c.slug) ? 'checked' : ''}><span>${esc(c.name)}</span><span class="muted xs" style="margin-left:auto">${S.categoryCount(c.slug)}</span></label>`).join('');
      const sizes = [...new Set(all.flatMap((p) => p.sizes))];
      $('#f-sizes').innerHTML = sizes.map((s) => `<button type="button" class="size ${st.sizes.includes(s) ? 'on' : ''}" data-fsize="${s}" aria-pressed="${st.sizes.includes(s)}">${s}</button>`).join('');
      const colorMap = new Map();
      all.forEach((p) => { if (!colorMap.has(p.colorName)) colorMap.set(p.colorName, p.color); });
      $('#f-colors').innerHTML = [...colorMap].map(([n, hex]) => `<button type="button" class="swatch ${st.colors.includes(hex.slice(1)) ? 'on' : ''}" data-fcolor="${hex.slice(1)}" style="--c:${hex}" title="${esc(n)}" aria-label="${esc(n)}" aria-pressed="${st.colors.includes(hex.slice(1))}"></button>`).join('');
      $('#f-stock').checked = st.stock; $('#f-sale').checked = st.sale;
      $('#shop-q').value = st.q; $('#shop-sort').value = st.sort;

      const sync = () => {
        const p = new URLSearchParams();
        if (wishMode) p.set('wishlist', '1');
        if (st.cats.length) p.set('cat', st.cats.join(','));
        if (st.q) p.set('q', st.q);
        if (st.sort !== 'featured') p.set('sort', st.sort);
        if (st.max < maxPrice) p.set('max', st.max);
        if (st.sizes.length) p.set('size', st.sizes.join(','));
        if (st.colors.length) p.set('color', st.colors.join(','));
        if (st.stock) p.set('stock', '1');
        if (st.sale) p.set('sale', '1');
        if (st.page > 1) p.set('page', st.page);
        try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); } catch (e) { /* file:// */ }
      };

      const filtered = () => {
        const wl = S.wishlist();
        let list = all.filter((p) =>
          (!wishMode || wl.includes(p.id)) &&
          (!st.cats.length || st.cats.some((c) => p.cats.includes(c))) &&
          (!st.q || [p.name, p.fabric, p.colorName, p.style, ...p.cats, ...p.tags].join(' ').toLowerCase().includes(st.q.toLowerCase())) &&
          S.price(p) <= st.max &&
          (!st.sizes.length || st.sizes.some((s) => p.sizes.includes(s))) &&
          (!st.colors.length || st.colors.includes(p.color.slice(1))) &&
          (!st.stock || p.stock > 0) && (!st.sale || p.sale));
        const by = {
          featured: (a, b) => (b.featured - a.featured) || (b.sold - a.sold),
          new: (a, b) => new Date(b.created) - new Date(a.created),
          'price-asc': (a, b) => S.price(a) - S.price(b),
          'price-desc': (a, b) => S.price(b) - S.price(a),
          rating: (a, b) => b.rating - a.rating,
          popular: (a, b) => b.sold - a.sold
        };
        return list.sort(by[st.sort] || by.featured);
      };

      const render = () => {
        const list = filtered();
        const pages = Math.max(1, Math.ceil(list.length / PER));
        st.page = A.clamp(st.page, 1, pages);
        const slice = list.slice((st.page - 1) * PER, st.page * PER);
        const grid$ = $('#shop-grid');
        grid$.className = 'grid-products' + (st.view === 'list' ? ' list' : '');
        grid$.innerHTML = grid(slice);
        $('#shop-title').textContent = wishMode ? 'My wishlist' : st.cats.length === 1 ? catName(st.cats[0]) : 'All Panjabi';
        $('#shop-count').textContent = list.length ? `Showing ${(st.page - 1) * PER + 1}–${(st.page - 1) * PER + slice.length} of ${list.length} products` : 'No products match your filters';
        $('#f-price-val').textContent = '· up to ' + money(st.max);
        $$('#view-toggle button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === st.view));

        const chips = [];
        st.cats.forEach((c) => chips.push([`cat:${c}`, catName(c)]));
        st.sizes.forEach((s) => chips.push([`size:${s}`, 'Size ' + s]));
        st.colors.forEach((c) => chips.push([`color:${c}`, [...colorMap].find(([, h]) => h.slice(1) === c)?.[0] || c]));
        if (st.q) chips.push(['q', `“${st.q}”`]);
        if (st.max < maxPrice) chips.push(['max', 'Up to ' + money(st.max)]);
        if (st.stock) chips.push(['stock', 'In stock']);
        if (st.sale) chips.push(['sale', 'On sale']);
        $('#active-filters').innerHTML = chips.map(([k, l]) => `<button class="chip active" data-clear="${esc(k)}" type="button">${esc(l)} ${icon('x', 14)}</button>`).join('');

        $('#pager').innerHTML = pages > 1 ? `<button class="btn btn-glass btn-icon btn-sm" data-page="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevron-left', 18)}</button>` +
          Array.from({ length: pages }, (_, i) => `<button class="btn btn-sm btn-icon ${i + 1 === st.page ? 'btn-primary' : 'btn-glass'}" data-page="${i + 1}" ${i + 1 === st.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('') +
          `<button class="btn btn-glass btn-icon btn-sm" data-page="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron-right', 18)}</button>` : '';
        sync();
      };
      const refresh = (resetPage = true) => { if (resetPage) st.page = 1; render(); };

      $('#f-cats').addEventListener('change', (e) => { const c = e.target.dataset.cat; st.cats = e.target.checked ? [...st.cats, c] : st.cats.filter((x) => x !== c); refresh(); });
      range.addEventListener('input', () => { st.max = Number(range.value); refresh(); });
      $('#f-sizes').addEventListener('click', (e) => { const b = e.target.closest('[data-fsize]'); if (!b) return; const s = b.dataset.fsize; st.sizes = st.sizes.includes(s) ? st.sizes.filter((x) => x !== s) : [...st.sizes, s]; b.classList.toggle('on'); b.setAttribute('aria-pressed', st.sizes.includes(s)); refresh(); });
      $('#f-colors').addEventListener('click', (e) => { const b = e.target.closest('[data-fcolor]'); if (!b) return; const c = b.dataset.fcolor; st.colors = st.colors.includes(c) ? st.colors.filter((x) => x !== c) : [...st.colors, c]; b.classList.toggle('on'); b.setAttribute('aria-pressed', st.colors.includes(c)); refresh(); });
      $('#f-stock').addEventListener('change', (e) => { st.stock = e.target.checked; refresh(); });
      $('#f-sale').addEventListener('change', (e) => { st.sale = e.target.checked; refresh(); });
      $('#shop-q').addEventListener('input', A.debounce((e) => { st.q = e.target.value.trim(); refresh(); }, 180));
      $('#shop-sort').addEventListener('change', (e) => { st.sort = e.target.value; refresh(); });
      $('#view-toggle').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (!b) return; st.view = b.dataset.view; DB.set('shop.view', st.view); render(); });
      $('#pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (!b) return; st.page = Number(b.dataset.page); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      $('#active-filters').addEventListener('click', (e) => {
        const b = e.target.closest('[data-clear]'); if (!b) return;
        const [k, v] = b.dataset.clear.split(':');
        if (k === 'cat') { st.cats = st.cats.filter((x) => x !== v); $(`[data-cat="${v}"]`).checked = false; }
        if (k === 'size') { st.sizes = st.sizes.filter((x) => x !== v); $(`[data-fsize="${v}"]`).classList.remove('on'); }
        if (k === 'color') { st.colors = st.colors.filter((x) => x !== v); $(`[data-fcolor="${v}"]`).classList.remove('on'); }
        if (k === 'q') { st.q = ''; $('#shop-q').value = ''; }
        if (k === 'max') { st.max = maxPrice; range.value = maxPrice; }
        if (k === 'stock') { st.stock = false; $('#f-stock').checked = false; }
        if (k === 'sale') { st.sale = false; $('#f-sale').checked = false; }
        refresh();
      });
      $('#f-reset').addEventListener('click', () => {
        Object.assign(st, { cats: [], q: '', max: maxPrice, sizes: [], colors: [], stock: false, sale: false });
        $$('#f-cats input').forEach((i) => { i.checked = false; });
        $$('#f-sizes .on, #f-colors .on').forEach((i) => i.classList.remove('on'));
        range.value = maxPrice; $('#f-stock').checked = false; $('#f-sale').checked = false; $('#shop-q').value = '';
        refresh();
      });
      $('#filter-open').addEventListener('click', () => { $('#filters').classList.add('open'); document.body.classList.add('lock'); });
      $('#filter-close').addEventListener('click', () => { $('#filters').classList.remove('open'); document.body.classList.remove('lock'); });
      document.addEventListener('amnu:wish', () => render());
      render();
    },

    /* ---------------- product ---------------- */
    product() {
      const key = A.qs.get('id') || A.qs.get('slug');
      const p = S.product(key);
      const root = $('#pdp');
      if (!p || p.status !== 'publish') {
        root.innerHTML = `<div class="empty glass pad" style="grid-column:1/-1"><h2>Product not found</h2><p class="muted">It may have been removed or is no longer available.</p><a class="btn btn-primary" href="shop.html">Back to shop</a></div>`;
        $('#pdp-more').hidden = true; $('#related').closest('section').hidden = true;
        return;
      }
      document.title = `${p.name} — ${settings.storeName}`;
      $('#pdp-crumbs').insertAdjacentHTML('beforeend', `${icon('chevron-right', 14)}<a href="shop.html?cat=${p.cats[0]}">${esc(catName(p.cats[0]))}</a>${icon('chevron-right', 14)}<span>${esc(p.name)}</span>`);

      const v = { color: p.color, size: '', qty: 1, view: 0, tab: 'desc' };
      const views = () => p.image
        ? [p.image, ...(p.gallery || [])].map((src) => ({ label: 'Photo', html: `<img class="pj" src="${esc(src)}" alt="${esc(p.name)}">` }))
        : [['front', 'Front'], ['back', 'Back'], ['detail', 'Collar'], ['fabric', 'Fabric']].map(([k, l]) => ({ label: l, html: A.panjabi(v.color, p.style, k) }));

      const paint = () => {
        const vs = views();
        const wished = S.wishlist().includes(p.id);
        const out = p.stock <= 0;
        const stockLine = out ? '<span class="badge b-err">Out of stock</span>' : p.stock <= settings.lowStock ? `<span class="badge b-warn">Only ${p.stock} left</span>` : '<span class="badge b-ok">In stock</span>';
        const color = p.colors.find((c) => c.hex === v.color) || p.colors[0];
        root.innerHTML = `
          <div class="pdp-gallery">
            <div class="pdp-main glass">${vs[v.view].html}${pct(p) ? `<span class="tag tag-sale">-${pct(p)}%</span>` : p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}</div>
            ${vs.length > 1 ? `<div class="pdp-thumbs">${vs.map((x, i) => `<button class="pdp-thumb glass ${i === v.view ? 'on' : ''}" data-view="${i}" aria-label="${esc(x.label)} view" aria-pressed="${i === v.view}">${x.html}<span class="xs">${esc(x.label)}</span></button>`).join('')}</div>` : ''}
          </div>
          <div class="pdp-info glass pad">
            <div class="row gap-8 wrap"><a class="badge b-accent" href="shop.html?cat=${p.cats[0]}">${esc(catName(p.cats[0]))}</a>${stockLine}</div>
            <h1>${esc(p.name)}</h1>
            <div class="row gap-8 wrap">${A.stars(p.rating)}<span class="muted small">${p.rating ? p.rating.toFixed(1) : 'New'} · ${p.reviews} reviews · ${p.sold} sold</span></div>
            <div class="pdp-price"><span>${money(S.price(p))}</span>${p.sale ? `<del>${money(p.price)}</del><span class="badge b-ok">Save ${money(p.price - p.sale)}</span>` : ''}</div>
            <p class="muted">${esc(p.short)}</p>
            <div class="opt"><div class="opt-h"><span class="label">Colour</span><span class="muted small">${esc(color.name)}</span></div><div class="swatches lg">${swatches(p, v.color)}</div></div>
            <div class="opt"><div class="opt-h"><span class="label">Size</span><button class="btn-link small" type="button" data-sizeguide>Size guide</button></div><div class="size-chips">${sizeChips(p, v.size)}</div><span class="xs" id="size-err" style="color:var(--err)" hidden>Please choose a size first.</span></div>
            <div class="row gap-16 wrap">${qtyBox(v.qty)}<span class="muted small">SKU: ${esc(p.sku)}</span></div>
            <div class="pdp-actions">
              <button class="btn btn-primary btn-lg grow" data-add ${out ? 'disabled' : ''}>${icon('bag', 18)} ${out ? 'Sold out' : 'Add to cart'}</button>
              <button class="btn btn-glass btn-lg" data-buy ${out ? 'disabled' : ''}>Buy now</button>
              <button class="btn btn-glass btn-lg btn-icon wish-inline ${wished ? 'on' : ''}" data-wish="${p.id}" aria-label="Toggle wishlist" aria-pressed="${wished}">${icon('heart', 20)}</button>
            </div>
            <ul class="pdp-perks">
              <li>${icon('truck', 20)}<span><b>Delivery:</b> 1–2 days inside Dhaka, 3–5 days nationwide</span></li>
              <li>${icon('refresh', 20)}<span><b>Exchange:</b> free size exchange within 7 days</span></li>
              <li>${icon('wallet', 20)}<span><b>Pay with:</b> Cash on Delivery, bKash, Nagad</span></li>
            </ul>
            <div class="muted small">Categories: ${p.cats.map((c) => `<a href="shop.html?cat=${c}" class="u">${esc(catName(c))}</a>`).join(', ')} &nbsp;·&nbsp; Tags: ${p.tags.map(esc).join(', ')}</div>
          </div>`;
        const more = $('#pdp-more');
        const revs = S.reviews(p);
        more.innerHTML = `<div class="glass pad"><div class="tabs" role="tablist">
            ${[['desc', 'Description'], ['info', 'Details'], ['rev', `Reviews (${p.reviews})`]].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${v.tab === k}">${l}</button>`).join('')}</div>
          <div class="tab-body prose">${v.tab === 'desc' ? p.long : v.tab === 'info'
            ? `<table class="gtable"><tbody><tr><th>Fabric</th><td>${esc(p.fabric)}</td></tr><tr><th>Style</th><td style="text-transform:capitalize">${esc(p.style)}</td></tr><tr><th>Sizes</th><td>${p.sizes.join(', ')}</td></tr><tr><th>Colours</th><td>${p.colors.map((c) => esc(c.name)).join(', ')}</td></tr><tr><th>Weight</th><td>${p.weight} kg</td></tr><tr><th>SKU</th><td>${esc(p.sku)}</td></tr></tbody></table>`
            : revs.map((r) => `<div class="review"><span class="avatar">${esc(r.name[0])}</span><div><div class="row gap-8 wrap"><b>${esc(r.name)}</b>${A.stars(r.rating)}<span class="xs muted">${A.date(r.date)} · Verified buyer</span></div><p class="muted">${esc(r.text)}</p></div></div>`).join('')}</div></div>`;
      };

      const onClick = (e) => {
        const t = e.target;
        const c = t.closest('[data-color]'); if (c) { v.color = c.dataset.color; paint(); return; }
        const s = t.closest('[data-size]'); if (s) { v.size = s.dataset.size; paint(); return; }
        const vw = t.closest('[data-view]'); if (vw) { v.view = Number(vw.dataset.view); paint(); return; }
        const tab = t.closest('[data-tab]'); if (tab) { v.tab = tab.dataset.tab; paint(); return; }
        const q = t.closest('.qty [data-q]'); if (q) { v.qty = A.clamp(v.qty + Number(q.dataset.q), 1, Math.max(1, p.stock)); paint(); return; }
        const add = t.closest('[data-add]'); const buy = t.closest('[data-buy]');
        if (add || buy) {
          if (!v.size) { $('#size-err').hidden = false; $('.size-chips').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
          Cart.add({ id: p.id, size: v.size, color: v.color, qty: v.qty });
          if (buy) location.href = 'checkout.html'; else { A.toast('Added to cart'); openDrawer(); }
        }
      };
      root.addEventListener('click', onClick);
      $('#pdp-more').addEventListener('click', onClick);
      paint();

      const rel = S.published().filter((x) => x.id !== p.id).map((x) => ({ x, score: x.cats.filter((c) => p.cats.includes(c)).length * 10 + (x.style === p.style ? 2 : 0) + x.rating })).sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.x);
      $('#related').innerHTML = grid(rel);
    },

    /* ---------------- cart ---------------- */
    cart() {
      let couponMsg = '';
      const couponBox = (t) => `<div class="coupon"><label class="label" for="coupon-in">Coupon code</label>
        ${Cart.couponCode() && !t.couponError ? `<div class="coupon-on glass-soft"><span>${icon('tag', 16)} <b>${esc(Cart.couponCode().toUpperCase())}</b> applied</span><button class="btn-link small" data-coupon-remove type="button">Remove</button></div>`
          : `<div class="row gap-8"><input id="coupon-in" type="text" placeholder="e.g. WELCOME10" autocomplete="off" value="${esc(Cart.couponCode())}"><button class="btn btn-glass" data-coupon-apply type="button">Apply</button></div>`}
        ${t.couponError || couponMsg ? `<span class="xs" style="color:var(--err)">${esc(t.couponError || couponMsg)}</span>` : ''}</div>`;

      const render = () => {
        const lines = Cart.lines();
        const t = Cart.totals(null);
        $('#cart-sub').textContent = lines.length ? `${A.plural(Cart.count(), 'item')} in your cart` : '';
        if (!lines.length) {
          $('#cart-list').innerHTML = `<div class="empty">${icon('bag', 48)}<h2>Your cart is empty</h2><p class="muted">Looks like you haven't added anything yet.</p><a class="btn btn-primary btn-lg" href="shop.html">Browse the collection</a></div>`;
          $('#cart-summary').hidden = true;
          $('#cart-more').hidden = false;
          $('#cart-suggest').innerHTML = grid(S.published().sort((a, b) => b.sold - a.sold).slice(0, 4));
          return;
        }
        $('#cart-summary').hidden = false;
        $('#cart-list').innerHTML = lines.map((l) => `<div class="cart-line">
          <a class="cl-thumb glass-soft" href="product.html?id=${l.p.id}">${S.thumb(l.p, 'front', l.color)}</a>
          <div class="cl-info"><a class="cl-name" href="product.html?id=${l.p.id}">${esc(l.p.name)}</a>
            <span class="muted small">Size ${esc(l.size)} · ${esc((l.p.colors.find((c) => c.hex === l.color) || {}).name || '')}</span>
            <span class="xs">${S.stockState(l.p) === 'low' ? `<span class="badge b-warn">Only ${l.p.stock} left</span>` : ''}</span></div>
          ${qtyBox(l.qty, `data-key="${esc(l.key)}"`)}
          <div class="cl-price num">${money(S.price(l.p) * l.qty)}<span class="xs muted">${money(S.price(l.p))} each</span></div>
          <button class="mini-x" data-remove="${esc(l.key)}" aria-label="Remove ${esc(l.p.name)}">${icon('x', 16)}</button></div>`).join('');
        $('#cart-summary').innerHTML = `<h2 class="card-title">Order summary</h2>
          <div class="sum-list">
            ${lines.map((l) => `<div class="sum-row"><span class="muted">${esc(l.p.name)} <span class="xs">× ${l.qty}</span></span><span class="num">${money(S.price(l.p) * l.qty)}</span></div>`).join('')}
          </div><hr>
          <div class="sum-row"><span>Subtotal</span><b class="num">${money(t.subtotal)}</b></div>
          ${t.discount ? `<div class="sum-row"><span>Discount</span><b class="num" style="color:var(--ok)">− ${money(t.discount)}</b></div>` : ''}
          <div class="sum-row"><span>Delivery</span><span class="muted small">${t.freeShip || t.subtotal - t.discount >= settings.shipping.freeOver ? 'Free' : `${money(settings.shipping.dhaka)} Dhaka · ${money(settings.shipping.outside)} outside`}</span></div>
          ${couponBox(t)}<hr>
          <div class="sum-row total"><span>Total</span><b class="num">${money(t.subtotal - t.discount)}</b></div>
          <p class="xs muted">Delivery charge is finalised at checkout based on your district.</p>
          <a class="btn btn-primary btn-lg btn-block" href="checkout.html">Proceed to checkout ${icon('arrow-right', 18)}</a>
          <a class="btn btn-glass btn-block" href="shop.html">Continue shopping</a>`;
        $('#cart-more').hidden = true;
      };
      document.addEventListener('amnu:cart', render);
      $('#cart-summary').addEventListener('click', (e) => {
        if (e.target.closest('[data-coupon-apply]')) {
          const code = $('#coupon-in').value.trim();
          if (!code) return;
          DB.set('cart.coupon', code);
          const t = Cart.totals(null);
          if (t.couponError) { couponMsg = t.couponError; DB.remove('cart.coupon'); render(); A.toast(couponMsg, 'err'); }
          else { couponMsg = ''; render(); A.toast('Coupon applied'); }
        }
        if (e.target.closest('[data-coupon-remove]')) { couponMsg = ''; DB.remove('cart.coupon'); render(); }
      });
      render();
    },

    /* ---------------- checkout ---------------- */
    checkout() {
      const lines0 = Cart.lines();
      const form = $('#checkout-form');
      if (!lines0.length) {
        form.outerHTML = `<div class="empty glass pad"><h2>Your cart is empty</h2><p class="muted">Add something before checking out.</p><a class="btn btn-primary" href="shop.html">Browse the collection</a></div>`;
        return;
      }
      $('#c-district').insertAdjacentHTML('beforeend', S.districts.map((d) => `<option>${esc(d)}</option>`).join(''));
      const pays = [['cod', 'Cash on Delivery', 'Pay when your parcel arrives', 'wallet'], ['bkash', 'bKash', 'Send money, then enter the Transaction ID', 'phone'], ['nagad', 'Nagad', 'Send money, then enter the Transaction ID', 'phone'], ['card', 'Card / Internet banking', 'Secure online payment (demo)', 'card']].filter(([k]) => settings.payments[k]);
      let pay = pays[0][0];
      const district = () => $('#c-district').value || null;

      const renderShip = () => {
        const d = district();
        const t = Cart.totals(d);
        const inside = d === 'Dhaka';
        const free = t.shipping === 0;
        const opt = (on, label, sub, fee) => `<label class="option ${on ? 'on' : ''} ${d ? '' : 'dim'}"><input type="radio" name="ship" ${on ? 'checked' : ''} disabled><span class="grow"><b>${label}</b><span class="xs muted" style="display:block">${sub}</span></span><b class="num">${on && free ? 'Free' : fee}</b></label>`;
        $('#ship-options').innerHTML = opt(d && inside, 'Inside Dhaka', '1–2 working days', money(settings.shipping.dhaka)) + opt(d && !inside, 'Outside Dhaka', '3–5 working days', money(settings.shipping.outside)) +
          (d ? '' : '<p class="xs muted">Choose your district to see the delivery charge.</p>') + (t.freeShip || t.subtotal - t.discount >= settings.shipping.freeOver ? `<p class="xs" style="color:var(--ok)">${icon('check', 14)} You qualify for free delivery.</p>` : `<p class="xs muted">Free delivery on orders over ${money(settings.shipping.freeOver)}.</p>`);
      };
      const renderPay = () => {
        $('#pay-options').innerHTML = pays.map(([k, l, sub, ic]) => `<label class="option ${pay === k ? 'on' : ''}"><input type="radio" name="pay" value="${k}" ${pay === k ? 'checked' : ''}><span class="option-ico">${icon(ic, 20)}</span><span class="grow"><b>${l}</b><span class="xs muted" style="display:block">${sub}</span></span></label>`).join('');
        const note = $('#pay-note');
        const t = Cart.totals(district());
        if (pay === 'bkash' || pay === 'nagad') {
          const num = pay === 'bkash' ? settings.bkashNumber : settings.nagadNumber;
          note.hidden = false;
          note.innerHTML = `<p class="small">Send <b>${money(t.total)}</b> via ${pay === 'bkash' ? 'bKash' : 'Nagad'} (Send Money) to <b>${esc(num)}</b>, then enter the Transaction ID below.</p><div class="field" style="margin-top:10px"><label for="c-trx">Transaction ID *</label><input id="c-trx" name="trx" type="text" placeholder="e.g. 9H7K2LMN4P" autocomplete="off"><span class="msg">Please enter the transaction ID.</span></div>`;
        } else if (pay === 'card') {
          note.hidden = false; note.innerHTML = '<p class="small">You will be redirected to a secure payment page after placing the order. (Demo — connect a gateway such as SSLCommerz.)</p>';
        } else { note.hidden = true; note.innerHTML = ''; }
      };
      const renderSummary = () => {
        const lines = Cart.lines();
        const t = Cart.totals(district());
        $('#co-summary').innerHTML = `<h2 class="card-title">Your order</h2>
          <div class="sum-items">${lines.map((l) => `<div class="mini-line"><span class="mini-thumb">${S.thumb(l.p, 'front', l.color)}</span><div class="grow"><b class="small">${esc(l.p.name)}</b><div class="xs muted">Size ${esc(l.size)} · Qty ${l.qty}</div></div><b class="num small">${money(S.price(l.p) * l.qty)}</b></div>`).join('')}</div><hr>
          <div class="sum-row"><span>Subtotal</span><b class="num">${money(t.subtotal)}</b></div>
          ${t.discount ? `<div class="sum-row"><span>Discount <span class="badge b-ok">${esc(Cart.couponCode().toUpperCase())}</span></span><b class="num" style="color:var(--ok)">− ${money(t.discount)}</b></div>` : ''}
          <div class="sum-row"><span>Delivery</span><b class="num">${t.shipping == null ? '<span class="muted small">Select district</span>' : t.shipping === 0 ? 'Free' : money(t.shipping)}</b></div><hr>
          <div class="sum-row total"><span>Total</span><b class="num">${money(t.total)}</b></div>
          ${Cart.couponCode() ? '' : `<div class="row gap-8"><input id="co-coupon" type="text" placeholder="Coupon code" aria-label="Coupon code"><button class="btn btn-glass" type="button" data-co-apply>Apply</button></div>`}
          <button class="btn btn-primary btn-lg btn-block" type="submit">Place order · ${money(t.total)}</button>
          <p class="xs muted center">${icon('lock', 14)} By placing your order you agree to our terms and exchange policy.</p>`;
      };
      const renderAll = () => { renderShip(); renderPay(); renderSummary(); };

      $('#c-district').addEventListener('change', renderAll);
      $('#pay-options').addEventListener('change', (e) => { pay = e.target.value; renderPay(); });
      $('#co-summary').addEventListener('click', (e) => {
        if (!e.target.closest('[data-co-apply]')) return;
        const code = $('#co-coupon').value.trim();
        if (!code) return;
        const r = S.applyCoupon(code, Cart.subtotal());
        if (!r.ok) { A.toast(r.error, 'err'); return; }
        DB.set('cart.coupon', code); renderAll(); A.toast('Coupon applied');
      });

      const rules = {
        name: (v) => v.trim().length >= 2,
        phone: (v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, '')),
        email: (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
        district: (v) => !!v,
        address: (v) => v.trim().length >= 8,
        trx: (v) => v.trim().length >= 6
      };
      const check = (name) => {
        const input = form.elements[name];
        if (!input || !rules[name]) return true;
        const ok = rules[name](input.value);
        input.closest('.field').classList.toggle('err', !ok);
        return ok;
      };
      form.addEventListener('focusout', (e) => { if (e.target.name) check(e.target.name); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const names = ['name', 'phone', 'email', 'district', 'address'].concat(pay === 'bkash' || pay === 'nagad' ? ['trx'] : []);
        const bad = names.filter((n) => !check(n));
        if (bad.length) { form.elements[bad[0]].focus(); A.toast('Please fix the highlighted fields', 'err'); return; }
        const lines = Cart.lines();
        const t = Cart.totals(district());
        const f = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
        const order = S.addOrder({
          customer: { name: f('name'), phone: f('phone').replace(/[\s]/g, ''), email: f('email'), district: f('district'), address: f('address') },
          items: lines.map((l) => ({ pid: l.p.id, name: l.p.name, price: S.price(l.p), cost: l.p.cost, qty: l.qty, size: l.size, color: (l.p.colors.find((c) => c.hex === l.color) || {}).name || '', hex: l.color, style: l.p.style })),
          subtotal: t.subtotal, shipping: t.shipping, discount: t.discount, coupon: t.discount || t.freeShip ? Cart.couponCode().toUpperCase() : '', total: t.total,
          payment: pay, payRef: f('trx'), note: f('note'),
          status: pay === 'cod' ? 'processing' : pay === 'card' ? 'pending' : 'on-hold',
          notes: [{ text: 'Order placed by customer from the storefront.', date: new Date().toISOString(), by: 'System' }]
        });
        if (t.discount || t.freeShip) { const cs = S.coupons(); const c = cs.find((x) => x.code.toLowerCase() === Cart.couponCode().toLowerCase()); if (c) { c.used += 1; S.saveCoupons(cs); } }
        Cart.clear();
        location.href = `thank-you.html?order=${order.id}`;
      });
      renderAll();
    },

    /* ---------------- thank you ---------------- */
    thanks() {
      const o = S.order(A.qs.get('order'));
      const root = $('#thanks');
      if (!o) { root.innerHTML = `<div class="empty glass pad"><h2>Order not found</h2><p class="muted">We couldn't find that order. Use the tracking page with your order number and phone.</p><a class="btn btn-primary" href="track-order.html">Track an order</a></div>`; return; }
      root.innerHTML = `<div class="thanks glass pad">
        <span class="thanks-ico">${icon('check', 34)}</span>
        <h1>Thank you, ${esc(o.customer.name.split(' ')[0])}!</h1>
        <p class="muted">Your order <b>#${o.id}</b> has been received. We'll confirm it by phone shortly.</p>
        <div class="thanks-meta">
          <div><span class="xs muted">Order number</span><b>#${o.id}</b></div>
          <div><span class="xs muted">Date</span><b>${A.date(o.date)}</b></div>
          <div><span class="xs muted">Total</span><b>${money(o.total)}</b></div>
          <div><span class="xs muted">Payment</span><b>${esc(S.payLabel[o.payment])}</b></div>
        </div>
        <div class="thanks-items">${o.items.map((i) => `<div class="sum-row"><span>${esc(i.name)} <span class="muted xs">· ${esc(i.size)} · ${esc(i.color)} × ${i.qty}</span></span><b class="num">${money(i.price * i.qty)}</b></div>`).join('')}
          <hr><div class="sum-row"><span>Delivery</span><b class="num">${o.shipping ? money(o.shipping) : 'Free'}</b></div>${o.discount ? `<div class="sum-row"><span>Discount</span><b class="num">− ${money(o.discount)}</b></div>` : ''}
          <div class="sum-row total"><span>Total</span><b class="num">${money(o.total)}</b></div></div>
        <div class="glass-soft pad" style="border-radius:var(--r-md)"><b class="small">Delivering to</b><p class="muted small">${esc(o.customer.name)} · ${esc(o.customer.phone)}<br>${esc(o.customer.address)}, ${esc(o.customer.district)}</p></div>
        <div class="row wrap gap-8" style="justify-content:center"><a class="btn btn-primary btn-lg" href="track-order.html?order=${o.id}">Track order</a><a class="btn btn-glass btn-lg" href="shop.html">Continue shopping</a></div>
      </div>`;
    },

    /* ---------------- track ---------------- */
    track() {
      const steps = [['Order placed', 'We received your order'], ['Confirmed', 'Our team verified your order'], ['Packed & shipped', 'Your parcel is on its way'], ['Delivered', 'Enjoy your panjabi!']];
      const stage = { pending: 0, 'on-hold': 1, processing: 2, completed: 3 };
      const digits = (s) => String(s).replace(/\D/g, '').slice(-10);
      const show = (id, phone) => {
        const out = $('#track-result');
        const o = S.order(String(id).replace('#', '').trim());
        if (!o || digits(o.customer.phone) !== digits(phone)) { out.innerHTML = `<div class="empty glass pad"><h3>We couldn't find that order</h3><p class="muted small">Check the order number and the mobile number you used at checkout.</p></div>`; return; }
        const dead = o.status === 'cancelled' || o.status === 'refunded';
        const at = stage[o.status] ?? 0;
        out.innerHTML = `<div class="glass pad track-card"><div class="row between wrap"><div><span class="xs muted">Order</span><h2>#${o.id}</h2></div>${S.statusBadge(o.status)}</div>
          <p class="muted small">Placed on ${A.dateTime(o.date)} · ${esc(S.payLabel[o.payment])} · ${money(o.total)}</p>
          ${dead ? `<div class="pay-note glass-soft"><b>This order was ${esc(S.statusLabel(o.status).toLowerCase())}.</b> Contact us if you have any questions.</div>` :
            `<ol class="timeline">${steps.map(([t, s], i) => `<li class="${i <= at ? 'done' : ''} ${i === at ? 'now' : ''}"><span class="tl-dot">${i <= at ? icon('check', 14) : ''}</span><div><b>${t}</b><span class="xs muted" style="display:block">${s}</span></div></li>`).join('')}</ol>`}
          <hr>${o.items.map((i) => `<div class="sum-row"><span>${esc(i.name)} <span class="muted xs">· ${esc(i.size)} × ${i.qty}</span></span><b class="num">${money(i.price * i.qty)}</b></div>`).join('')}</div>`;
      };
      $('#track-form').addEventListener('submit', (e) => { e.preventDefault(); show($('#t-id').value, $('#t-phone').value); });
      if (A.qs.get('order')) {
        $('#t-id').value = A.qs.get('order');
        const o = S.order(A.qs.get('order'));
        if (o) { $('#t-phone').value = o.customer.phone; show(o.id, o.customer.phone); }
      }
    },

    /* ---------------- about ---------------- */
    about() {
      const pub = S.published();
      $('#about-art').innerHTML = [pub.find((p) => p.id === 1), pub.find((p) => p.id === 4), pub.find((p) => p.id === 2)].filter(Boolean).map((p, i) => `<div class="promo-pj p${i}">${S.thumb(p)}</div>`).join('');
      const rated = pub.filter((p) => p.rating);
      const avg = (rated.reduce((n, p) => n + p.rating, 0) / rated.length).toFixed(1);
      $('#about-stats').innerHTML = [[pub.length, 'Panjabi designs'], [S.categories().length, 'Collections'], [avg + '★', 'Average rating (sample)'], ['64', 'Districts delivered']].map(([n, l]) => `<div><b>${n}</b><span class="muted small">${l}</span></div>`).join('');
    },

    contact() {
      $('#cc-msgr').href = settings.messenger;
      $('#cc-phone').href = 'tel:' + settings.phone.replace(/[^\d+]/g, '');
      $('#cc-mail').href = 'mailto:' + settings.email;
    }
  };

  /* ======================================================================
     boot
     ====================================================================== */
  const page = document.body.dataset.page;
  mountChrome(page);
  if (Pages[page]) Pages[page]();
  A.hydrate();
})();
