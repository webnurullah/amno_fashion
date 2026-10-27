/* ==========================================================================
   Amnu Fashion — storefront core
   Header / footer / account menu / search / quick-add drawer, the bag and its
   totals, demo sign-in, "Find in store" and shared product-card markup.
   Page renderers live in store-pages.js and store-pages2.js.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const { $, $$, esc, icon, money } = A;
  const Shop = (A.shop = {});

  const settings = S.settings();
  Shop.settings = settings;
  A.applyLook(S.look());

  /* ======================================================================
     Demo sign-in (no real authentication; the profile lives in this browser)
     ====================================================================== */
  const Auth = (Shop.Auth = {
    user: () => DB.get('user', null),
    login(u) { DB.set('user', u); document.dispatchEvent(new Event('amnu:auth')); },
    save(patch) { const u = Object.assign({}, Auth.user(), patch); DB.set('user', u); return u; },
    logout() { DB.remove('user'); document.dispatchEvent(new Event('amnu:auth')); }
  });

  /* ======================================================================
     Recently viewed
     ====================================================================== */
  const Recent = (Shop.Recent = {
    list: () => DB.get('recent', []).map((id) => S.product(id)).filter((p) => p && p.status === 'publish'),
    add(id) { const l = DB.get('recent', []).filter((x) => x !== id); l.unshift(id); DB.set('recent', l.slice(0, 8)); }
  });

  /* ======================================================================
     Bag
     ====================================================================== */
  const lineKey = (id, size, color) => [id, size, color].join('|');
  const Cart = (Shop.Cart = {
    items: () => DB.get('cart', []),
    save(list) { DB.set('cart', list); document.dispatchEvent(new Event('amnu:cart')); },
    add({ id, size, color, qty = 1 }) {
      const avail = S.onlineStock(id, size);
      if (avail <= 0) return false;
      const list = Cart.items();
      const key = lineKey(id, size, color);
      const hit = list.find((l) => l.key === key);
      if (hit) hit.qty = Math.min(avail, hit.qty + qty); else list.push({ key, id, size, color, qty: Math.min(avail, qty), sel: true });
      Cart.save(list);
      return true;
    },
    setQty(key, qty) {
      const list = Cart.items();
      const l = list.find((x) => x.key === key);
      if (!l) return;
      l.qty = A.clamp(qty, 1, Math.max(1, S.onlineStock(l.id, l.size)));
      Cart.save(list);
    },
    toggle(key, on) { const list = Cart.items(); const l = list.find((x) => x.key === key); if (l) { l.sel = on; Cart.save(list); } },
    toggleAll(on) { Cart.save(Cart.items().map((l) => Object.assign(l, { sel: on }))); },
    remove(key) { Cart.save(Cart.items().filter((l) => l.key !== key)); },
    removeSelected() { Cart.save(Cart.items().filter((l) => l.sel === false)); },
    /** after an order: drop the purchased lines, keep unselected ones */
    clearPurchased() { DB.remove('cart.coupon'); Cart.removeSelected(); },
    lines: () => Cart.items().map((l) => Object.assign({}, l, { p: S.product(l.id) })).filter((l) => l.p && l.p.status === 'publish'),
    selected: () => Cart.lines().filter((l) => l.sel !== false),
    count: () => Cart.lines().reduce((n, l) => n + l.qty, 0),
    couponCode: () => DB.get('cart.coupon', ''),
    /**
     * Every figure that appears in the summary and on the order.
     * opts: { shipping, digital, usePoints }
     */
    totals(opts = {}) {
      const cfg = S.settings();
      const lines = Cart.selected();
      const subtotal = lines.reduce((n, l) => n + S.price(l.p) * l.qty, 0);
      const list = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
      let couponDiscount = 0; let freeShip = false; let couponError = '';
      const code = Cart.couponCode();
      if (code) {
        const r = S.applyCoupon(code, subtotal);
        if (r.ok) { couponDiscount = r.discount; freeShip = !!r.freeShip; } else couponError = r.error;
      }
      let base = subtotal - couponDiscount;
      const digitalDiscount = opts.digital && cfg.digitalDiscountPct > 0 ? Math.round(base * cfg.digitalDiscountPct / 100) : 0;
      base -= digitalDiscount;
      const user = Auth.user();
      const pts = user && opts.usePoints ? S.points(user.phone) : null;
      const pointsUsed = pts && pts.balance >= cfg.loyalty.minRedeem ? Math.min(pts.balance, Math.floor(base / cfg.loyalty.pointValue)) : 0;
      const pointsDiscount = pointsUsed * cfg.loyalty.pointValue;
      base -= pointsDiscount;
      const vat = cfg.vatRate > 0 ? Math.round(base * cfg.vatRate / 100) : 0;
      const shipping = freeShip ? 0 : opts.shipping == null ? null : opts.shipping;
      const total = base + vat + (shipping || 0);
      return {
        lines, subtotal, savings: Math.max(0, list - subtotal), couponDiscount, digitalDiscount, pointsUsed, pointsDiscount,
        discount: couponDiscount + digitalDiscount + pointsDiscount, vat, shipping, freeShip, couponError, total
      };
    }
  });

  /* ======================================================================
     Shared view helpers
     ====================================================================== */
  const catName = (slug) => (S.categories().find((c) => c.slug === slug) || {}).name || slug;
  const pctOff = (p) => (p.sale ? Math.round((1 - p.sale / p.price) * 100) : 0);
  const stageOf = (p) => ['arch', 'frame', 'plain', 'stripe'][p.id % 4];
  Shop.catName = catName; Shop.pctOff = pctOff; Shop.stageOf = stageOf;
  const codeOf = (p) => String(p.sku || '').replace(/^AMN-/, '');
  Shop.codeOf = codeOf;
  const priceHTML = (p) => `<span class="price"><b>${money(S.price(p))}</b>${p.sale ? `<del>${money(p.price)}</del><span class="off">${pctOff(p)}% OFF</span>` : ''}</span>`;
  Shop.priceHTML = priceHTML;
  const onlineTotal = (p) => S.onlineStock(p.id);
  Shop.onlineTotal = onlineTotal;

  /** sizes with what the online warehouse holds: [{ size, qty }] */
  const sizesOnline = (p) => p.sizes.map((size) => ({ size, qty: S.onlineStock(p.id, size) }));
  Shop.sizesOnline = sizesOnline;
  const sizePills = (p, size, attr = 'data-size') => sizesOnline(p).map((s) => `<button type="button" class="size ${s.size === size ? 'on' : ''} ${s.qty <= 0 ? 'out' : ''}" ${attr}="${s.size}" ${s.qty <= 0 ? 'disabled' : ''} aria-pressed="${s.size === size}" title="${s.qty <= 0 ? 'Sold out online' : ''}">${esc(S.sizeLabel(s.size))}</button>`).join('');
  Shop.sizePills = sizePills;

  const colorThumbs = (p, hex, attr = 'data-color') => p.colors.map((c) => `<button type="button" class="cthumb ${c.hex === hex ? 'on' : ''}" ${attr}="${c.hex}" aria-label="${esc(c.name)}" aria-pressed="${c.hex === hex}" title="${esc(c.name)}"><span class="stage ${stageOf(p)}" style="--tint:${c.hex}">${S.thumb(p, 'front', c.hex)}</span></button>`).join('');
  Shop.colorThumbs = colorThumbs;

  const qtyBox = (qty, key = '') => `<div class="qty" ${key ? `data-key="${esc(key)}"` : ''}><button type="button" data-q="-1" aria-label="Decrease quantity">${icon('minus', 14)}</button><span class="num" aria-live="polite">${qty}</span><button type="button" data-q="1" aria-label="Increase quantity">${icon('plus', 14)}</button></div>`;
  Shop.qtyBox = qtyBox;

  /** product card: tall studio tile, bag button, code, colours, price + % OFF */
  const card = (p) => {
    const out = onlineTotal(p) <= 0;
    return `<article class="pcard" data-id="${p.id}">
      <div class="pcard-media">
        <a class="pcard-img stage ${stageOf(p)}" style="--tint:${p.color}" href="product.html?id=${p.id}" aria-label="${esc(p.name)}">${S.thumb(p)}</a>
        ${p.sale ? '<span class="promo-tag">Promo</span>' : p.badge ? `<span class="soft-tag">${esc(p.badge)}</span>` : ''}
        ${out ? '<span class="soldout-tag">Sold out online</span>' : ''}
        <button class="qa-btn" data-quick="${p.id}" aria-label="Quick add ${esc(p.name)} to bag" ${out ? 'disabled' : ''}>${icon('bag-plus', 20)}</button>
      </div>
      <div class="pcard-body">
        <div class="pcard-row"><a class="pcard-title" href="product.html?id=${p.id}">${esc(p.name)}</a><span class="pcode">${esc(codeOf(p))}</span></div>
        <details class="pcolors"><summary>${A.plural(p.colors.length, 'color')}</summary><span class="dots">${p.colors.map((c) => `<i style="background:${c.hex}" title="${esc(c.name)}"></i>`).join('')}</span></details>
        ${priceHTML(p)}
      </div>
    </article>`;
  };
  Shop.card = card;
  Shop.grid = (list, empty) => list.map(card).join('') || `<div class="empty glass pad"><h3>${esc(empty || 'No products found')}</h3><p class="muted">Try changing your filters or search.</p></div>`;

  /** horizontal rail with prev / next buttons */
  let railN = 0;
  Shop.rail = (html, cls = '') => { const id = 'rail' + ++railN; return `<div class="rail-wrap ${cls}"><div class="rail" id="${id}">${html}</div><button class="rail-btn prev" data-rail="${id}" data-dir="-1" aria-label="Scroll left" hidden>${icon('chevron-left', 18)}</button><button class="rail-btn next" data-rail="${id}" data-dir="1" aria-label="Scroll right">${icon('chevron-right', 18)}</button></div>`; };
  const syncRails = () => $$('.rail').forEach((r) => {
    const wrap = r.parentElement;
    const prev = $('.prev', wrap); const next = $('.next', wrap);
    if (!prev) return;
    prev.hidden = r.scrollLeft < 8;
    next.hidden = r.scrollLeft + r.clientWidth >= r.scrollWidth - 8;
  });
  Shop.syncRails = syncRails;

  /* ---------- size guide + find in store ---------- */
  Shop.sizeGuide = () => A.modal({
    title: 'Size guide', wide: true,
    body: `<div class="table-wrap"><table class="gtable"><thead><tr><th>Size</th><th>Chest (in)</th><th>Length (in)</th><th>Sleeve (in)</th><th>Shoulder (in)</th></tr></thead><tbody>
      <tr><td>S / 38</td><td>38</td><td>39</td><td>23.5</td><td>16.5</td></tr><tr><td>M / 40</td><td>40</td><td>40</td><td>24</td><td>17</td></tr><tr><td>L / 42</td><td>42</td><td>41</td><td>24.5</td><td>17.5</td></tr>
      <tr><td>XL / 44</td><td>44</td><td>42</td><td>25</td><td>18</td></tr><tr><td>XXL / 46</td><td>46</td><td>43</td><td>25.5</td><td>18.5</td></tr></tbody></table></div>
      <p class="muted small" style="margin-top:12px">Sample measurements — replace with your own fit chart. Lay a panjabi that fits you well flat and compare. Between sizes? Choose the larger one for a relaxed fit. Kids sizes run by age: 2Y – 10Y.</p>`
  });

  /** which showrooms hold this product (live from inventory) */
  Shop.findInStore = (p, size) => {
    const rooms = S.showrooms();
    const rows = rooms.map((l) => {
      const by = S.stockBySize(p.id, l.id);
      const total = p.sizes.reduce((n, s) => n + (by[s] || 0), 0);
      const sel = size ? (by[size] || 0) : null;
      const state = (size ? sel : total) > 0 ? ((size ? sel : total) <= 2 ? 'low' : 'in') : 'out';
      return `<div class="fis-row">
        <div class="grow"><b>${esc(l.name)}</b><div class="xs muted">${esc(l.address)}</div><div class="xs muted">${esc(l.hours)}</div>
          <div class="fis-sizes">${p.sizes.map((s) => `<span class="fis-size ${(by[s] || 0) > 0 ? '' : 'off'} ${s === size ? 'sel' : ''}" title="${by[s] || 0} in stock">${esc(S.sizeLabel(s))}</span>`).join('')}</div></div>
        <div class="fis-side"><span class="badge ${state === 'in' ? 'b-ok' : state === 'low' ? 'b-warn' : 'b-err'}">${state === 'in' ? 'In stock' : state === 'low' ? 'Low stock' : 'Out of stock'}</span>
          <a class="btn btn-glass btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.name + ' ' + l.address)}">${icon('mapnav', 14)} Directions</a></div></div>`;
    }).join('');
    A.modal({ title: 'Find in store', wide: true, body: `<p class="muted small" style="margin-bottom:12px">${esc(p.name)}${size ? ' · size ' + esc(S.sizeLabel(size)) : ''}. Live stock from our showrooms.</p><div class="fis">${rows || '<p class="muted">No showrooms yet.</p>'}</div><p class="xs muted" style="margin-top:12px">Stock changes through the day. Call the showroom to have a piece held for you.</p>` });
  };

  /* ======================================================================
     Chrome
     ====================================================================== */
  const NAV = [
    ['Eid Special', 'shop.html?cat=eid', (c, p) => c === 'eid'], ['New Arrivals', 'shop.html?sort=new', (c, p, s) => s === 'new'],
    ['Panjabi', 'category.html?c=panjabi', (c, p) => p === 'category'], ['Wedding', 'shop.html?cat=wedding', (c) => c === 'wedding'],
    ['Kids', 'shop.html?cat=kids', (c) => c === 'kids'], ['Sets', 'shop.html?cat=sets', (c) => c === 'sets'],
    ['Inside Story', 'about.html', (c, p) => p === 'about']
  ];

  function headerHTML(page) {
    const cat = A.qs.get('cat'); const sort = A.qs.get('sort');
    const s = settings;
    const user = Auth.user();
    return `${s.announcement ? `<div class="announce"><span id="announce-text">${esc(s.announcement)}</span></div>` : '<div class="announce" hidden><span id="announce-text"></span></div>'}
    <div class="util"><div class="container util-in">
      <div class="util-l"><label class="lang"><span class="sr-only">Language</span><select aria-label="Language"><option>English</option><option disabled>বাংলা (coming soon)</option></select></label>
        <a href="mailto:${esc(s.email)}">${icon('mail', 16)}<span>${esc(s.email)}</span></a><a href="contact.html">${icon('phone', 16)}<span>Contact</span></a></div>
      <div class="util-r"><span class="deliver">${icon('truck', 16)} Deliver to: <i class="flag-bd"></i> <b>Bangladesh</b></span><a href="stores.html">Store Locations</a><a href="track-order.html">Track Order</a></div>
    </div></div>
    <header class="site-header"><div class="container nav-in">
      <a class="logo" href="index.html" aria-label="${esc(s.storeName)} home"><span class="logo-mark">${icon('sparkle', 20)}</span><span class="logo-text">Amnu<small>Fashion</small></span></a>
      <nav class="menu" id="menu" aria-label="Main">${NAV.map(([l, h, on]) => `<a href="${h}" class="${on(cat, page, sort) ? 'active' : ''}">${l}</a>`).join('')}<a class="menu-extra" href="stores.html">Store Locations</a><a class="menu-extra" href="track-order.html">Track Order</a></nav>
      <div class="nav-actions">
        <button class="icon-btn" data-search aria-label="Search">${icon('search', 21)}</button>
        <div class="dd" id="acc-dd"><button class="icon-btn" data-dd aria-label="Account" aria-haspopup="true">${icon('user', 21)}</button><div class="dd-menu acc-menu glass-strong">${accountMenu(user)}</div></div>
        <button class="icon-btn" data-cart-open aria-label="Open bag">${icon('bag', 21)}<span class="count" data-cart-count hidden>0</span></button>
        <button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">${A.themeIcon()}</button>
        <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon('menu', 22)}</button>
      </div>
    </div></header>`;
  }
  function accountMenu(user) {
    return user
      ? `<div class="dd-h2">${esc(user.name)}!</div><a href="account.html#profile">${icon('user', 18)} My Account</a><a href="account.html#orders">${icon('history', 18)} Order History</a><a href="account.html#addresses">${icon('pin', 18)} Shipping Address</a><a href="account.html#loyalty">${icon('star', 18)} Loyalty</a><button type="button" data-signout>${icon('logout', 18)} Sign Out</button>`
      : `<div class="dd-h2">Welcome!</div><a href="login.html">${icon('user', 18)} Sign in</a><a href="login.html#register">${icon('plus', 18)} Create an account</a><a href="track-order.html">${icon('truck', 18)} Track an order</a><a href="stores.html">${icon('pin', 18)} Store Locations</a>`;
  }

  function footerHTML() {
    const s = settings;
    const L = (href, label) => `<li><a href="${href}">${label}</a></li>`;
    const cats = S.categories();
    return `<footer class="site-footer"><div class="container">
      <div class="footer-top glass">
        <div><h4>Legal</h4><ul>${L('policy.html?p=shipping', 'Shipping Policy')}${L('policy.html?p=terms', 'Terms and Conditions')}${L('policy.html?p=privacy', 'Privacy Policy')}${L('policy.html?p=payment', 'Payment Policy')}</ul></div>
        <div><h4>Information</h4><ul>${L('policy.html?p=exchange', 'Exchange &amp; Refund')}${L('policy.html?p=size', 'Size Guide')}${L('policy.html?p=loyalty', 'Loyalty Program')}${L('stores.html', 'Store Locations')}${L('track-order.html', 'Track Your Order')}</ul></div>
        <div><h4>Company</h4><ul>${L('about.html', 'About Us')}${L('contact.html', 'Contact Us')}${L('about.html#craft', 'Our Craft')}${L('about.html', 'Inside Story')}${L('login.html', 'Sign in')}</ul></div>
        <div><h4>Service Center</h4><ul class="contact"><li>${esc(s.phone)}</li><li>${esc(s.email)}</li><li><a href="${esc(s.facebook)}" target="_blank" rel="noopener">${icon('facebook', 16)} Facebook</a></li><li><a href="${esc(s.messenger)}" target="_blank" rel="noopener">${icon('message', 16)} Messenger</a></li></ul></div>
        <div><h4>You Can Pay By</h4><div class="paylogos"><span class="pl pl-visa">VISA</span><span class="pl pl-nagad">Nagad</span><span class="pl pl-bkash">bKash</span><span class="pl pl-mc"><i></i><i></i></span><span class="pl">COD</span></div></div>
      </div>
      <p class="copy">© ${new Date().getFullYear()} ${esc(s.storeName)}. All rights reserved. <a href="admin/login.html" class="admin-link">Admin dashboard</a></p>
      <div class="mega"><h3>Shop Amnu</h3><div class="mega-grid">
        <ul><li class="mh">Panjabi</li>${cats.filter((c) => !['kids', 'sets'].includes(c.slug)).map((c) => `<li><a href="shop.html?cat=${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul>
        <ul><li class="mh">Kids &amp; Sets</li><li><a href="shop.html?cat=kids">Kids Panjabi</a></li><li><a href="shop.html?cat=sets">Panjabi Sets</a></li></ul>
        <ul><li class="mh">Offers</li><li><a href="shop.html?sale=1">Promo items</a></li><li><a href="shop.html?sort=new">New Arrivals</a></li></ul>
        <ul><li class="mh">Visit</li>${S.showrooms().map((l) => `<li><a href="stores.html">${esc(l.name)}</a></li>`).join('')}</ul>
        <ul><li class="mh">Help</li><li><a href="policy.html?p=size">Size guide</a></li><li><a href="track-order.html">Track order</a></li><li><a href="contact.html">Contact</a></li></ul>
      </div></div>
    </div></footer>`;
  }

  /* ---------- bag drawer ---------- */
  function drawerHTML() {
    const lines = Cart.lines();
    const t = Cart.totals();
    const body = lines.length ? lines.map((l) => `<div class="mini-line" data-key="${esc(l.key)}">
        <a class="mini-thumb stage ${stageOf(l.p)}" style="--tint:${l.color}" href="product.html?id=${l.p.id}">${S.thumb(l.p, 'front', l.color)}</a>
        <div class="grow"><a class="mini-name" href="product.html?id=${l.p.id}">${esc(l.p.name)}</a>
          <div class="xs muted">Code ${esc(codeOf(l.p))} · ${esc(S.sizeLabel(l.size))} · ${esc((l.p.colors.find((c) => c.hex === l.color) || {}).name || '')}</div>
          <div class="row between" style="margin-top:6px">${qtyBox(l.qty, l.key)}<b class="num">${money(S.price(l.p) * l.qty)}</b></div></div>
        <button class="mini-x" data-remove="${esc(l.key)}" aria-label="Remove ${esc(l.p.name)}">${icon('trash', 16)}</button></div>`).join('')
      : `<div class="drawer-empty">${icon('bag', 46)}<h3>Your bag is empty</h3><p class="muted small">Add a panjabi you love and it will show up here.</p><a class="btn btn-primary" href="shop.html">Start shopping</a></div>`;
    return `<div class="drawer-h"><h3>Shopping bag <span class="muted small">(${A.plural(Cart.count(), 'item')})</span></h3><button class="icon-btn" data-cart-close aria-label="Close bag">${icon('x', 20)}</button></div>
      <div class="drawer-body">${body}</div>
      ${lines.length ? `<div class="drawer-f"><div class="row between"><span class="muted">Sub total</span><b class="num">${money(Cart.lines().reduce((n, l) => n + S.price(l.p) * l.qty, 0))}</b></div>${t.savings ? `<p class="xs ok">You save ${money(t.savings)} on this bag.</p>` : ''}<div class="row gap-8"><a class="btn btn-glass grow" href="bag.html">View bag</a><a class="btn btn-primary grow" href="bag.html">Checkout</a></div></div>` : ''}`;
  }
  function syncChrome() {
    const n = Cart.count();
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
    const d = $('#drawer'); if (d) d.innerHTML = drawerHTML();
    const dd = $('#acc-dd .acc-menu'); if (dd) dd.innerHTML = accountMenu(Auth.user());
  }
  const openDrawer = () => { $('#drawer-wrap').classList.add('open'); document.body.classList.add('lock'); };
  const closeDrawer = () => { $('#drawer-wrap').classList.remove('open'); document.body.classList.remove('lock'); };
  Shop.openDrawer = openDrawer;

  /* ---------- search ---------- */
  function openSearch() {
    return A.modal({
      title: 'Search', wide: true,
      body: `<form class="input-group" id="sq-form" action="shop.html">${icon('search')}<input id="sq" name="q" type="search" placeholder="Search panjabi, fabric, colour or code…" autocomplete="off"></form><div class="search-results" id="sq-results"></div>`,
      onOpen(el) {
        const input = $('#sq', el); const out = $('#sq-results', el);
        const show = () => {
          const q = input.value.trim().toLowerCase();
          const hits = S.published().filter((p) => !q || [p.name, p.fabric, p.colorName, p.style, p.sku, ...p.cats, ...p.tags].join(' ').toLowerCase().includes(q)).slice(0, 6);
          const cats = q ? S.categories().filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3) : [];
          out.innerHTML = cats.map((c) => `<a class="sr-item" href="shop.html?cat=${c.slug}"><span class="sr-ico">${icon('grid', 18)}</span><span class="grow"><b>${esc(c.name)}</b><span class="xs muted" style="display:block">Collection</span></span>${icon('chevron-right', 16)}</a>`).join('') +
            (hits.length ? hits.map((p) => `<a class="sr-item" href="product.html?id=${p.id}"><span class="sr-thumb stage ${stageOf(p)}" style="--tint:${p.color}">${S.thumb(p)}</span><span class="grow"><b>${esc(p.name)}</b><span class="xs muted" style="display:block">${esc(catName(p.cats[0]))} · ${esc(codeOf(p))}</span></span><b class="num">${money(S.price(p))}</b></a>`).join('') : '<p class="muted center" style="padding:18px">No matches. Try “cotton”, “navy” or “wedding”.</p>');
        };
        input.addEventListener('input', A.debounce(show, 120));
        show();
      }
    });
  }

  /* ---------- quick-add side drawer (from the bag button on a card) ---------- */
  function quickAdd(id) {
    const p = S.product(id);
    if (!p) return;
    let color = p.color; let size = ''; let view = 0;
    const wrap = A.h(`<div class="qd-wrap open" role="dialog" aria-modal="true" aria-label="Quick add"><div class="qd-scrim" data-qd-close></div><aside class="qd glass-strong"></aside></div>`);
    document.body.appendChild(wrap); document.body.classList.add('lock');
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { wrap.remove(); document.body.classList.remove('lock'); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    const views = ['front', 'back', 'detail', 'fabric'];
    const paint = () => {
      const sel = size ? S.onlineStock(p.id, size) : null;
      $('.qd', wrap).innerHTML = `
        <button class="icon-btn qd-x" data-qd-close aria-label="Close">${icon('x', 20)}</button>
        <div class="qd-body">
          <div class="qd-gallery stage ${stageOf(p)}" style="--tint:${color}">${p.image ? S.thumb(p) : A.panjabi(color, p.style, views[view])}
            <button class="gal-arrow l" data-qd-view="-1" aria-label="Previous">${icon('chevron-left', 18)}</button><button class="gal-arrow r" data-qd-view="1" aria-label="Next">${icon('chevron-right', 18)}</button></div>
          <div class="gal-progress"><span class="num xs">${view + 1} / ${views.length}</span><i><b style="width:${((view + 1) / views.length) * 100}%"></b></i></div>
          <h3 class="qd-title">${esc(p.name)}</h3><div class="muted small">Code: ${esc(codeOf(p))}</div>
          <div style="margin:8px 0">${priceHTML(p)}</div>
          <div class="muted small">Color: <b class="ink">${esc((p.colors.find((c) => c.hex === color) || {}).name || '')}</b></div>
          <div class="cthumbs">${colorThumbs(p, color)}</div>
          <div class="row between" style="margin-top:14px"><span class="small bold">Select Size</span><button class="btn-link small" type="button" data-sizeguide>Size Guide ${icon('ruler', 15)}</button></div>
          <div class="size-pills">${sizePills(p, size)}</div>
          ${sel != null && sel <= 3 ? `<p class="lowstock">Only ${sel} left</p>` : ''}<p class="xs err" id="qd-err" hidden>Please choose a size.</p>
        </div>
        <div class="qd-foot"><button class="btn btn-primary" data-qd-add>${icon('bag-plus', 18)} Add to bag</button><button class="btn btn-outline" data-qd-find>Find in store</button><a class="qd-full" href="product.html?id=${p.id}">FULL DETAILS</a></div>`;
    };
    wrap.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-qd-close]')) { close(); return; }
      const c = t.closest('[data-color]'); if (c) { color = c.dataset.color; paint(); return; }
      const sz = t.closest('[data-size]'); if (sz) { size = sz.dataset.size; paint(); return; }
      const v = t.closest('[data-qd-view]'); if (v) { view = (view + Number(v.dataset.qdView) + views.length) % views.length; paint(); return; }
      if (t.closest('[data-sizeguide]')) { Shop.sizeGuide(); return; }
      if (t.closest('[data-qd-find]')) { Shop.findInStore(p, size || null); return; }
      if (t.closest('[data-qd-add]')) {
        if (!size) { $('#qd-err', wrap).hidden = false; return; }
        if (Cart.add({ id: p.id, size, color, qty: 1 })) { close(); openDrawer(); } else A.toast('That size just sold out online', 'err');
      }
    });
    paint();
  }
  Shop.quickAdd = quickAdd;

  /* ======================================================================
     Mount
     ====================================================================== */
  Shop.mount = (page) => {
    $('#site-header').innerHTML = headerHTML(page);
    $('#site-footer').innerHTML = footerHTML();
    document.body.appendChild(A.h(`<div class="drawer-wrap" id="drawer-wrap"><div class="drawer-scrim" data-cart-close></div><aside class="drawer glass-strong" id="drawer" aria-label="Shopping bag"></aside></div>`));
    syncChrome();
    document.addEventListener('amnu:cart', syncChrome);
    document.addEventListener('amnu:auth', syncChrome);

    document.addEventListener('click', (e) => {
      const t = e.target;
      const dd = t.closest('[data-dd]'); const inside = t.closest('.dd');
      $$('.dd.open').forEach((d) => { if (d !== inside) d.classList.remove('open'); });
      if (dd) { dd.closest('.dd').classList.toggle('open'); return; }
      if (t.closest('[data-cart-open]')) { openDrawer(); return; }
      if (t.closest('[data-cart-close]')) { closeDrawer(); return; }
      if (t.closest('[data-search]')) { openSearch(); return; }
      if (t.closest('[data-theme-toggle]')) { A.toggleTheme(); return; }
      if (t.closest('[data-sizeguide]')) { e.preventDefault(); Shop.sizeGuide(); return; }
      if (t.closest('[data-signout]')) { Auth.logout(); A.toast('Signed out'); if (document.body.dataset.page === 'account') location.href = 'index.html'; return; }
      const toggle = t.closest('#menu-toggle');
      if (toggle) { const open = $('#menu').classList.toggle('open'); toggle.setAttribute('aria-expanded', open); return; }
      const quick = t.closest('[data-quick]'); if (quick) { quickAdd(Number(quick.dataset.quick)); return; }
      const rail = t.closest('[data-rail]');
      if (rail) { const r = document.getElementById(rail.dataset.rail); r.scrollBy({ left: Number(rail.dataset.dir) * r.clientWidth * 0.85, behavior: 'smooth' }); return; }
      const rm = t.closest('.drawer [data-remove]'); if (rm) { Cart.remove(rm.dataset.remove); return; }
      const q = t.closest('.drawer .qty [data-q]');
      if (q) { const l = Cart.items().find((x) => x.key === q.closest('.qty').dataset.key); if (l) Cart.setQty(l.key, l.qty + Number(q.dataset.q)); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    document.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('rail')) syncRails(); }, true);
    window.addEventListener('resize', A.debounce(syncRails, 120));

    /* live preview hook for Admin → Appearance → Customize */
    window.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'amnu-look') return;
      A.applyLook(d.look);
      if (d.announcement != null) { const a = $('#announce-text'); if (a) { a.textContent = d.announcement; a.parentElement.hidden = !d.announcement; } }
      if (d.heroTitle != null && $('#hero-title')) $('#hero-title').textContent = d.heroTitle;
      if (d.heroSub != null && $('#hero-sub')) $('#hero-sub').textContent = d.heroSub;
    });

    $$('[data-demo-form]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); if (!f.reportValidity()) return; A.toast(f.dataset.demoForm); f.reset(); }));
    $$('[data-bind]').forEach((el) => { el.textContent = settings[el.dataset.bind] || ''; });
  };
})();
