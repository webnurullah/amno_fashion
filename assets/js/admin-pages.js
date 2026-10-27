/* ==========================================================================
   Amnu Fashion — admin page controllers (part 1)
   dashboard · products · product-edit · categories · orders · order-view · customers
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const Admin = A.admin;
  const { $, $$, esc, icon, money } = A;
  const P = (A.adminPages = A.adminPages || {});
  const settings = S.settings();
  const DAY = 864e5;

  /* ---------- shared date / order maths ---------- */
  const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d.getTime(); };
  const startOf = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const isValid = (o) => o.status !== 'cancelled' && o.status !== 'refunded';
  const profitOf = (o) => o.items.reduce((s, i) => s + (i.price - (i.cost != null ? i.cost : i.price * 0.56)) * i.qty, 0) - (o.discount || 0);
  const noise = (t) => { const x = Math.sin((t / DAY) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  /** per-day buckets for a window of `days` ending `offset` days before today */
  function buckets(orders, days, offset = 0) {
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) { const t = dayStart(i + offset); map.set(t, { t, revenue: 0, orders: 0, placed: 0, customers: new Set(), profit: 0 }); }
    orders.forEach((o) => {
      const b = map.get(startOf(o.date));
      if (!b) return;
      b.placed += 1; b.customers.add(o.customer.phone);
      if (isValid(o)) { b.orders += 1; b.revenue += o.total; b.profit += profitOf(o); }
    });
    const out = [...map.values()];
    out.forEach((b) => { b.sessions = Math.round((b.orders * 34 + 70) * (0.9 + noise(b.t) * 0.28)); }); /* simulated traffic */
    return out;
  }
  const sum = (arr, f) => arr.reduce((n, x) => n + f(x), 0);
  const pctDelta = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0);
  const deltaHTML = (d, label) => `<span class="delta ${d >= 0 ? 'up' : 'down'}">${icon(d >= 0 ? 'arrow-up' : 'arrow-down', 14)}${Math.abs(d).toFixed(1)}%${label ? `<span class="muted"> ${esc(label)}</span>` : ''}</span>`;
  Admin.metrics = { buckets, isValid, profitOf, sum, pctDelta, deltaHTML, dayStart, startOf };

  /* ======================================================================
     Dashboard
     ====================================================================== */
  P.dashboard = () => {
    const orders = S.orders();
    const sel = $('#range');
    sel.value = DB.get('dash.range', '7');
    let chart;

    const render = () => {
      const N = Number(sel.value);
      DB.set('dash.range', String(N));
      const cur = buckets(orders, N, 0);
      const prev = buckets(orders, N, N);
      const label = `vs last ${N} days`;
      const m = (f) => [sum(cur, f), sum(prev, f)];

      const [rev, revP] = m((b) => b.revenue);
      const [ord, ordP] = m((b) => b.orders);
      const [cus, cusP] = [new Set(cur.flatMap((b) => [...b.customers])).size, new Set(prev.flatMap((b) => [...b.customers])).size];
      const [pro, proP] = m((b) => b.profit);
      const kpis = [
        ['Total sales', money(rev), pctDelta(rev, revP), '৳', 'violet'], ['Orders', ord.toLocaleString('en-IN'), pctDelta(ord, ordP), icon('bag', 22), 'green'],
        ['Customers', cus.toLocaleString('en-IN'), pctDelta(cus, cusP), icon('users', 22), 'blue'], ['Total profit (est.)', money(pro), pctDelta(pro, proP), icon('trend', 22), 'pink']
      ];
      $('#kpis').innerHTML = kpis.map(([l, v, d, ic, c]) => `<article class="kpi glass"><div class="kpi-top"><div><span class="kpi-label">${l}</span><b class="kpi-val num">${v}</b></div><span class="kpi-ico ${c}">${ic}</span></div>${deltaHTML(d, label)}</article>`).join('');

      $('#sales-total').textContent = money(rev);
      $('#sales-delta').outerHTML = `<span class="delta ${rev >= revP ? 'up' : 'down'}" id="sales-delta">${icon(rev >= revP ? 'arrow-up' : 'arrow-down', 14)}${Math.abs(pctDelta(rev, revP)).toFixed(1)}%<span class="muted"> ${label}</span></span>`;
      chart = A.charts.area($('#sales-chart'), cur.map((b) => ({ x: new Date(b.t), y: b.revenue })), { name: 'Sales', height: 290 });

      const sessions = cur.map((b) => b.sessions); const sessionsP = sum(prev, (b) => b.sessions);
      const conv = (arr) => { const s = sum(arr, (b) => b.sessions); return s ? (sum(arr, (b) => b.orders) / s) * 100 : 0; };
      const aov = (arr) => { const o = sum(arr, (b) => b.orders); return o ? sum(arr, (b) => b.revenue) / o : 0; };
      const spark = (arr, f) => arr.slice(-Math.max(7, Math.min(14, arr.length))).map(f);
      const sideStats = [
        ['Total sessions', sum(cur, (b) => b.sessions).toLocaleString('en-IN'), pctDelta(sum(cur, (b) => b.sessions), sessionsP), spark(cur, (b) => b.sessions)],
        ['Conversion rate', conv(cur).toFixed(2) + '%', pctDelta(conv(cur), conv(prev)), spark(cur, (b) => (b.sessions ? (b.orders / b.sessions) * 100 : 0))],
        ['Average order value', money(aov(cur)), pctDelta(aov(cur), aov(prev)), spark(cur, (b) => (b.orders ? b.revenue / b.orders : 0))]
      ];
      $('#side-stats').innerHTML = sideStats.map(([l, v, d, s], i) => `<article class="card mini-stat"><div><span class="kpi-label">${l}</span><div class="mini-val"><b class="num">${v}</b>${deltaHTML(d)}</div></div><div class="spark-host" data-spark="${i}"></div></article>`).join('') + `<p class="xs muted sim-note">${icon('info', 14)} Traffic metrics are simulated. Connect Google Analytics or Facebook Pixel in Plugins for live data.</p>`;
      sideStats.forEach(([, , , s], i) => A.charts.spark($(`[data-spark="${i}"]`), s));

      /* online vs store split + live store status */
      const days = cur.map((b) => b.t);
      const onl = days.map(() => 0); const sto = days.map(() => 0);
      orders.forEach((o) => { if (!isValid(o)) return; const i = days.indexOf(startOf(o.date)); if (i < 0) return; (S.channelOf(o) === 'store' ? sto : onl)[i] += o.total; });
      const so = sum(onl, (x) => x); const ss = sum(sto, (x) => x);
      const pct = (v) => (so + ss ? Math.round((v / (so + ss)) * 100) : 0);
      $('#ch-split').textContent = `Online ${money(so)} (${pct(so)}%) · Store ${money(ss)} (${pct(ss)}%)`;
      A.charts.stacked($('#channel-chart'), days.map((t, i) => ({ label: A.dateShort(t), tip: A.date(t), values: [onl[i], sto[i]] })), [{ name: 'Online', cls: 's-a' }, { name: 'Store', cls: 's-b' }], { height: 240 });
      const todayKey = A.ymd(Date.now());
      const rows = S.showrooms().map((l) => {
        const sale = S.salesFor(l.id, todayKey); const closed = S.closeFor(l.id, todayKey);
        return `<a class="store-row" href="${closed ? 'day-close.html' : 'pos.html'}"><span class="loc-ico">${icon('store', 18)}</span><div class="grow"><b class="small">${esc(l.name)}</b><div class="xs muted">${A.plural(sale.count, 'order')} · ${A.plural(sale.pieces, 'piece')}</div></div><div class="right"><b class="num small">${money(sale.total)}</b><div>${closed ? '<span class="badge b-err">Closed</span>' : '<span class="badge b-ok">Open</span>'}</div></div></a>`;
      });
      const onlineToday = sum(orders.filter((o) => isValid(o) && S.channelOf(o) === 'online' && startOf(o.date) === dayStart(0)), (o) => o.total);
      $('#stores-today').innerHTML = rows.join('') + `<div class="store-row online"><span class="loc-ico">${icon('globe', 18)}</span><div class="grow"><b class="small">Online store</b><div class="xs muted">Orders placed today</div></div><div class="right"><b class="num small">${money(onlineToday)}</b></div></div>`;

      /* recent orders */
      const recent = orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
      $('#recent-orders').innerHTML = `<thead><tr><th>Order</th><th>Customer</th><th>Date</th><th class="right">Total</th><th>Status</th></tr></thead><tbody>${recent.map((o) => {
        const p = S.product(o.items[0].pid);
        const thumb = p ? Admin.thumb(p, 'sm') : `<span class="thumb sm">${A.panjabi(o.items[0].hex || '#888', o.items[0].style || 'plain')}</span>`;
        return `<tr><td><a class="row-title with-thumb" href="order-view.html?id=${o.id}">${thumb}<span>#${o.id}</span></a></td><td>${esc(o.customer.name)}</td><td class="muted">${A.dateShort(o.date)}</td><td class="right num">${money(o.total)}</td><td>${S.statusBadge(o.status)}</td></tr>`;
      }).join('')}</tbody>`;

      /* top products */
      const tally = new Map();
      orders.filter((o) => isValid(o) && startOf(o.date) >= dayStart(N - 1)).forEach((o) => o.items.forEach((i) => {
        const t = tally.get(i.pid) || { pid: i.pid, name: i.name, units: 0, revenue: 0, hex: i.hex, style: i.style };
        t.units += i.qty; t.revenue += i.price * i.qty; tally.set(i.pid, t);
      }));
      const top = [...tally.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
      const maxRev = Math.max(1, ...top.map((t) => t.revenue));
      $('#top-products').innerHTML = top.map((t) => {
        const p = S.product(t.pid);
        return `<a class="top-row" href="product-edit.html?id=${t.pid}">${p ? Admin.thumb(p, 'sm') : ''}<div class="grow"><b class="small">${esc(t.name)}</b><div class="meter"><span style="width:${(t.revenue / maxRev) * 100}%"></span></div></div><div class="right"><b class="num small">${money(t.revenue)}</b><div class="xs muted">${t.units} sold</div></div></a>`;
      }).join('') || '<p class="muted small">No sales in this period.</p>';

      /* insight */
      const up = rev >= revP;
      $('#insight').innerHTML = `<span class="insight-ico">${icon('sparkle', 24)}</span><div class="grow"><b>${up ? "You're doing great!" : 'Sales are a little slower'}</b><p class="muted small">Your store sales are ${up ? 'up' : 'down'} <b class="${up ? 'ok' : 'err'}">${Math.abs(pctDelta(rev, revP)).toFixed(1)}%</b> compared to the previous ${N} days.${up ? '' : ' Try a coupon or an Eid campaign to bring buyers back.'}</p></div><a class="btn btn-glass" href="analytics.html">View full report</a>`;
    };

    /* glance, stock alerts, quick draft (don't depend on the range) */
    const products = S.products();
    const pub = products.filter((p) => p.status === 'publish');
    const bal = S.balances();
    const dues = S.dueList().reduce((n, d) => n + d.due, 0);
    const snap = (l, v, cls = '') => `<div class="snap-row"><span>${l}</span><b class="num ${cls}">${v}</b></div>`;
    $('#money-snap').innerHTML = S.accounts().map((a) => snap(esc(a.name), money(bal[a.id] || 0))).join('')
      + snap('Customers owe you', money(dues)) + snap('You owe suppliers', money(S.payables()), S.payables() ? 'err' : '') + snap('Stock at cost', money(S.valuation().cost));
    const low = pub.filter((p) => p.stock <= settings.lowStock).sort((a, b) => a.stock - b.stock).slice(0, 5);
    $('#stock-alerts').innerHTML = low.map((p) => `<a class="top-row" href="product-edit.html?id=${p.id}">${Admin.thumb(p, 'sm')}<div class="grow"><b class="small">${esc(p.name)}</b><div class="xs muted">${esc(p.sku)}</div></div>${Admin.stockHTML(p)}</a>`).join('') || '<p class="muted small">All products are well stocked.</p>';

    const drafts = () => {
      const list = S.pages().filter((x) => x.status === 'draft').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
      $('#drafts').innerHTML = list.length ? `<div class="label" style="margin-top:14px">Your recent drafts</div>` + list.map((d) => `<div class="draft-row"><a href="pages.html?q=${encodeURIComponent(d.title)}"><b class="small">${esc(d.title)}</b></a><span class="xs muted">${A.date(d.date)}</span></div>`).join('') : '';
    };
    $('#quick-draft').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#qd-title').value.trim();
      if (!title) { A.toast('Add a title first', 'err'); $('#qd-title').focus(); return; }
      const list = S.pages();
      list.unshift({ id: list.reduce((m, x) => Math.max(m, x.id), 0) + 1, type: 'post', title, slug: '/blog/' + A.slug(title), author: 'Amnu Admin', status: 'draft', date: new Date().toISOString(), cat: 'Uncategorised', body: $('#qd-body').value });
      S.savePages(list);
      e.target.reset(); drafts(); A.toast('Draft saved');
    });
    drafts();
    sel.addEventListener('change', render);
    render();
  };

  /* ======================================================================
     Products
     ====================================================================== */
  const catName = (slug) => (S.categories().find((c) => c.slug === slug) || {}).name || slug;

  function quickEdit(p, api) {
    const m = A.modal({
      title: 'Quick edit · ' + p.name,
      body: `<form id="qe" class="form-grid2" novalidate>
        <div class="field full"><label>Name</label><input name="name" value="${esc(p.name)}"></div>
        <div class="field"><label>Regular price (৳)</label><input name="price" type="number" min="0" value="${p.price}"></div>
        <div class="field"><label>Sale price (৳)</label><input name="sale" type="number" min="0" value="${p.sale || ''}" placeholder="—"></div>
        <div class="field"><label>Stock</label><div class="small" style="padding-top:10px"><b>${S.stock(p.id)}</b> units · <a class="btn-link" href="inventory.html?q=${encodeURIComponent(p.sku)}">Manage in Inventory</a></div></div>
        <div class="field"><label>Status</label><select name="status"><option value="publish" ${p.status === 'publish' ? 'selected' : ''}>Published</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option></select></div></form>`,
      footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Update</button>'
    });
    m.el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-save]')) return;
      const f = $('#qe', m.el).elements;
      const price = Number(f.price.value); const sale = Number(f.sale.value) || null;
      if (!f.name.value.trim() || !(price > 0)) { A.toast('Name and a price above 0 are required', 'err'); return; }
      if (sale && sale >= price) { A.toast('Sale price must be lower than the regular price', 'err'); return; }
      S.upsertProduct(Object.assign({}, p, { name: f.name.value.trim(), price, sale, status: f.status.value }));
      m.close(); api.refresh(); A.toast('Product updated');
    });
  }

  P.products = () => {
    const cats = S.categories();
    Admin.listTable({
      id: 'products', mount: $('#list'), perPage: 10, emptyIcon: 'package', empty: 'No products found',
      rows: () => S.products(), rowId: (p) => p.id,
      initialView: A.qs.get('stock') === 'low' ? 'low' : undefined, initialQ: A.qs.get('q') || '',
      views: [
        { id: 'all', label: 'All' }, { id: 'publish', label: 'Published', filter: (p) => p.status === 'publish' },
        { id: 'draft', label: 'Draft', filter: (p) => p.status === 'draft' }, { id: 'low', label: 'Low / out of stock', filter: (p) => S.stockState(p) !== 'in' }
      ],
      filters: [{ id: 'cat', label: 'All categories', options: cats.map((c) => [c.slug, c.name]), test: (p, v) => p.cats.includes(v) }],
      search: (p, q) => [p.name, p.sku, ...p.cats, p.colorName].join(' ').toLowerCase().includes(q),
      searchPlaceholder: 'Search products',
      columns: [
        { id: 'img', label: '', cls: 'thumb-col', render: (p) => Admin.thumb(p) },
        { id: 'name', label: 'Name', sort: (a, b) => a.name.localeCompare(b.name), render: (p) => `<a class="row-title" href="product-edit.html?id=${p.id}">${esc(p.name)}</a>${p.status === 'draft' ? ' <span class="draft-tag">— Draft</span>' : ''}${Admin.actions([{ label: 'ID: ' + p.id, href: 'product-edit.html?id=' + p.id }, { label: 'Edit', href: 'product-edit.html?id=' + p.id }, { label: 'Quick edit', act: 'quick', id: p.id }, { label: 'Duplicate', act: 'dup', id: p.id }, { label: 'Trash', act: 'trash', id: p.id, danger: true }, { label: 'View', href: '../product.html?id=' + p.id, target: '_blank' }])}` },
        { id: 'sku', label: 'SKU', sort: (a, b) => a.sku.localeCompare(b.sku), render: (p) => `<span class="mono">${esc(p.sku)}</span>` },
        { id: 'stock', label: 'Stock', sort: (a, b) => a.stock - b.stock, render: Admin.stockHTML },
        { id: 'price', label: 'Price', sort: (a, b) => S.price(a) - S.price(b), render: Admin.priceHTML },
        { id: 'cats', label: 'Categories', render: (p) => p.cats.map((c) => `<a class="u" href="products.html?cat=${c}">${esc(catName(c))}</a>`).join(', ') },
        { id: 'sold', label: 'Sold', hidden: true, sort: (a, b) => a.sold - b.sold, render: (p) => `<span class="num">${p.sold}</span>` },
        { id: 'rating', label: 'Rating', hidden: true, render: (p) => (p.rating ? `${A.stars(p.rating)} <span class="xs muted">${p.reviews}</span>` : '—') },
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.created) - new Date(b.created), render: (p) => `<span class="muted small">${p.status === 'publish' ? 'Published' : 'Last modified'}<br>${A.date(p.created)}</span>` }
      ],
      bulk: [
        { id: 'publish', label: 'Publish', run: (ids) => { const l = S.products(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'publish'; }); S.saveProducts(l); A.toast('Products published'); } },
        { id: 'draft', label: 'Move to draft', run: (ids) => { const l = S.products(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'draft'; }); S.saveProducts(l); A.toast('Moved to draft'); } },
        { id: 'trash', label: 'Delete permanently', confirm: 'Delete the selected products? This cannot be undone.', run: (ids) => { S.deleteProducts(ids.map(Number)); A.toast('Products deleted'); } }
      ],
      actions: {
        quick: (id, p, api) => quickEdit(p, api),
        dup: (id, p, api) => { const c = Object.assign({}, p, { id: S.nextProductId(), name: 'Copy of ' + p.name, status: 'draft', created: new Date().toISOString() }); c.slug = A.slug(c.name); c.sku = 'AMN-' + (1000 + c.id); S.upsertProduct(c); S.initInventory(c.id, c.sizes, 0); api.refresh(); A.toast('Product duplicated as draft'); },
        trash: (id, p, api) => A.confirm(`Delete “${p.name}” permanently?`, 'Delete').then((ok) => { if (ok) { S.deleteProducts([p.id]); api.refresh(); A.toast('Product deleted'); } })
      }
    });
  };

  /* ======================================================================
     Product editor
     ====================================================================== */
  function compressImage(file, max = 900) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  Admin.compressImage = compressImage;

  P['product-edit'] = () => {
    const id = Number(A.qs.get('id')) || 0;
    const existing = id ? S.product(id) : null;
    const ALL_SIZES = ['M', 'L', 'XL', 'XXL', '2Y', '4Y', '6Y', '8Y', '10Y'];
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: S.nextProductId(), name: '', slug: '', cats: [], price: 0, sale: null, cost: 0, sku: '', stock: 10, status: 'draft', badge: '', featured: false, rating: 0, reviews: 0, sold: 0,
      created: new Date().toISOString(), color: '#1f2a5c', colorName: 'Navy', colors: [{ name: 'Navy', hex: '#1f2a5c' }], style: 'plain', fabric: '', sizes: ['M', 'L', 'XL', 'XXL'], short: '', long: '', tags: [], weight: 0.5, image: '', gallery: []
    };
    const isNew = !existing;
    const f = $('#pe-form');
    const val = (sel) => $(sel).value;

    $('#pe-heading').textContent = isNew ? 'Add new product' : 'Edit product';
    document.title = (isNew ? 'Add New Product' : 'Edit Product') + ' ‹ Amnu Fashion Admin';
    if (!isNew) { $('#view-link').href = '../product.html?id=' + draft.id; $('#view-link').hidden = false; }

    /* fill */
    $('#p-title').value = draft.name; $('#p-long').innerHTML = draft.long; $('#p-short').value = draft.short;
    $('#p-price').value = draft.price || ''; $('#p-sale').value = draft.sale || ''; $('#p-sku').value = draft.sku || ''; $('#p-cost').value = draft.cost || ''; $('#p-weight').value = draft.weight;
    $('#p-fabric').value = draft.fabric; $('#p-style').value = draft.style; $('#p-badge').value = draft.badge; $('#p-featured').checked = !!draft.featured;
    $('#p-status').value = draft.status; $('#p-tags').value = (draft.tags || []).join(', ');
    $('#pub-date').textContent = isNew ? 'immediately' : A.dateTime(draft.created);

    const permalink = () => { $('#p-permalink').innerHTML = draft.name ? `Permalink: <span class="mono">/product/${esc(A.slug(draft.name))}</span>` : ''; };
    const opening = {};
    const stateBadge = (n) => (n <= 0 ? '<span class="badge b-err">Out of stock</span>' : n <= settings.lowStock ? '<span class="badge b-warn">Low stock</span>' : '<span class="badge b-ok">In stock</span>');
    const renderInv = () => {
      if (isNew) {
        draft.sizes.forEach((z) => { if (opening[z] == null) opening[z] = 5; });
        $('#p-inv').innerHTML = `<div class="small muted" style="margin-bottom:8px">Opening stock by size</div><div class="row wrap gap-8">${draft.sizes.map((z) => `<label class="os-cell"><span class="xs muted">${esc(S.sizeLabel(z))}</span><input type="number" min="0" data-os="${z}" value="${opening[z]}" aria-label="Opening stock for ${esc(z)}"></label>`).join('') || '<span class="muted small">Choose sizes under Attributes first.</span>'}</div>`;
      } else {
        const total = S.stock(draft.id);
        $('#p-inv').innerHTML = `<table class="mini-table inv-mini"><tbody>${S.locations().map((l) => `<tr><td>${esc(l.name)}</td><td class="right num">${S.stock(draft.id, l.id)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="right"><b class="num">${total}</b> ${stateBadge(total)}</td></tr></tbody></table>`;
      }
    };

    /* categories */
    const renderCats = () => { $('#p-cats').innerHTML = S.categories().map((c) => `<label class="check"><input type="checkbox" value="${c.slug}" ${draft.cats.includes(c.slug) ? 'checked' : ''}> ${esc(c.name)}</label>`).join(''); };
    renderCats();
    $('#add-cat').addEventListener('click', () => {
      const name = val('#new-cat').trim(); if (!name) return;
      const list = S.categories(); const slug = A.slug(name);
      if (!list.some((c) => c.slug === slug)) { list.push({ id: list.reduce((m, c) => Math.max(m, c.id), 0) + 1, slug, name, desc: '' }); S.saveCategories(list); }
      if (!draft.cats.includes(slug)) draft.cats.push(slug);
      $('#new-cat').value = ''; renderCats(); preview();
    });
    $('#p-cats').addEventListener('change', () => { draft.cats = $$('#p-cats input:checked').map((i) => i.value); preview(); });

    /* sizes */
    const renderSizes = () => { $('#p-sizes').innerHTML = ALL_SIZES.map((s) => `<button type="button" class="size ${draft.sizes.includes(s) ? 'on' : ''}" data-size="${s}" aria-pressed="${draft.sizes.includes(s)}">${s}</button>`).join(''); };
    renderSizes();
    $('#p-sizes').addEventListener('click', (e) => { const b = e.target.closest('[data-size]'); if (!b) return; const s = b.dataset.size; draft.sizes = draft.sizes.includes(s) ? draft.sizes.filter((x) => x !== s) : [...draft.sizes, s]; renderSizes(); renderInv(); });

    /* colours */
    const renderColors = () => {
      $('#p-colors').innerHTML = draft.colors.map((c, i) => `<div class="color-row"><input type="color" value="${c.hex}" data-ci="${i}" data-k="hex" aria-label="Colour ${i + 1}"><input type="text" value="${esc(c.name)}" data-ci="${i}" data-k="name" placeholder="Colour name" aria-label="Colour name"><span class="xs muted">${i === 0 ? 'Default' : ''}</span><button type="button" class="btn btn-ghost btn-icon btn-sm" data-rc="${i}" aria-label="Remove colour" ${draft.colors.length === 1 ? 'disabled' : ''}>${icon('x', 16)}</button></div>`).join('');
    };
    renderColors();
    $('#p-colors').addEventListener('input', (e) => { const i = e.target.dataset.ci; if (i == null) return; draft.colors[i][e.target.dataset.k] = e.target.value; draft.color = draft.colors[0].hex; draft.colorName = draft.colors[0].name; preview(); });
    $('#p-colors').addEventListener('click', (e) => { const b = e.target.closest('[data-rc]'); if (!b) return; draft.colors.splice(Number(b.dataset.rc), 1); draft.color = draft.colors[0].hex; draft.colorName = draft.colors[0].name; renderColors(); preview(); });
    $('#add-color').addEventListener('click', () => { draft.colors.push({ name: 'New colour', hex: '#8a6d3b' }); renderColors(); });

    /* image + gallery */
    const renderImages = () => {
      $('#img-preview').innerHTML = draft.image ? `<img src="${esc(draft.image)}" alt="Product image"><button type="button" class="btn btn-danger btn-sm" id="img-remove">Remove image</button>` : `<div class="img-empty">${icon('image', 30)}<span>No photo uploaded.<br>The storefront shows an illustration drawn from the colour and style.</span></div>`;
      $('#gal-list').innerHTML = (draft.gallery || []).map((g, i) => `<div class="gal-item"><img src="${esc(g)}" alt=""><button type="button" data-rg="${i}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('');
    };
    renderImages();
    const upload = async (files, target) => {
      for (const file of files) {
        if (!/^image\//.test(file.type)) { A.toast('Only image files are supported', 'err'); continue; }
        try { const url = await compressImage(file); if (target === 'main') draft.image = url; else draft.gallery.push(url); } catch (e) { A.toast('Could not read that image', 'err'); }
      }
      renderImages(); preview();
    };
    $('#img-input').addEventListener('change', (e) => upload([...e.target.files].slice(0, 1), 'main'));
    $('#gal-input').addEventListener('change', (e) => upload([...e.target.files].slice(0, 6), 'gal'));
    const drop = $('#img-drop');
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); upload([...e.dataTransfer.files].slice(0, 1), 'main'); });
    $('#img-preview').addEventListener('click', (e) => { if (e.target.closest('#img-remove')) { draft.image = ''; renderImages(); preview(); } });
    $('#gal-list').addEventListener('click', (e) => { const b = e.target.closest('[data-rg]'); if (b) { draft.gallery.splice(Number(b.dataset.rg), 1); renderImages(); } });

    /* editor toolbar */
    $('#ed-toolbar').addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-cmd]'); if (!b) return;
      e.preventDefault();
      if (b.dataset.cmd === 'link') { const u = prompt('Link URL'); if (u) document.execCommand('createLink', false, u); } else document.execCommand(b.dataset.cmd, false, b.dataset.val || null);
    });

    /* product-data tabs */
    $('#pd-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pd]'); if (!b) return;
      $$('#pd-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      $$('.pd-panel').forEach((p) => { p.hidden = p.id !== 'pd-' + b.dataset.pd; });
    });

    /* storefront preview */
    function preview() {
      const priceN = Number(val('#p-price')) || 0; const saleN = Number(val('#p-sale')) || null;
      const p = Object.assign({}, draft, { name: val('#p-title') || 'Product name', price: priceN, sale: saleN, style: val('#p-style'), badge: val('#p-badge'), rating: draft.rating || 0 });
      $('#pe-preview').innerHTML = `<div class="pcard-mini"><div class="pcard-mini-img">${S.thumb(p)}${p.sale ? `<span class="tag tag-sale">-${Math.round((1 - p.sale / p.price) * 100)}%</span>` : p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}</div><b>${esc(p.name)}</b><span class="xs muted">${esc(draft.cats[0] ? catName(draft.cats[0]) : 'Uncategorised')}</span><span class="price-line">${p.sale ? `<b>${money(p.sale)}</b> <del class="muted">${money(p.price)}</del>` : `<b>${money(p.price)}</b>`}</span><span class="swatches">${draft.colors.map((c) => `<i style="background:${c.hex}"></i>`).join('')}</span></div>`;
    }
    f.addEventListener('input', (e) => {
      if (e.target.id === 'p-title') { draft.name = e.target.value; permalink(); }
      if (e.target.dataset.os) opening[e.target.dataset.os] = Math.max(0, Math.round(Number(e.target.value) || 0));
      preview();
    });
    permalink(); renderInv(); preview();

    /* save */
    const save = (status) => {
      const name = val('#p-title').trim(); const price = Number(val('#p-price')); const sale = Number(val('#p-sale')) || null;
      const errs = [];
      if (!name) errs.push(['#p-title', 'Add a product name']);
      if (!(price > 0)) errs.push(['#p-price', 'Enter a regular price above 0']);
      if (sale && sale >= price) errs.push(['#p-sale', 'Sale price must be lower than the regular price']);
      if (status === 'publish' && !draft.sizes.length) errs.push(['#p-sizes', 'Choose at least one size']);
      $$('.field.err', f).forEach((x) => x.classList.remove('err'));
      if (errs.length) {
        errs.forEach(([sel]) => { const fld = $(sel).closest('.field'); if (fld) fld.classList.add('err'); });
        if (errs[0][0] === '#p-price' || errs[0][0] === '#p-sale') $('#pd-tabs [data-pd=general]').click();
        A.toast(errs[0][1], 'err'); $(errs[0][0]).focus && $(errs[0][0]).focus(); return;
      }
      const all = S.products();
      let slug = A.slug(name); if (all.some((p) => p.slug === slug && p.id !== draft.id)) slug += '-' + draft.id;
      const sku = val('#p-sku').trim() || 'AMN-' + (1000 + draft.id);
      const product = Object.assign({}, draft, {
        name, slug, price, sale, sku, status, cost: Number(val('#p-cost')) || Math.round(price * 0.56),
        stock: isNew ? draft.sizes.reduce((n, z) => n + (opening[z] || 0), 0) : draft.stock, weight: Number(val('#p-weight')) || 0, fabric: val('#p-fabric').trim() || 'cotton', style: val('#p-style'), badge: val('#p-badge'), featured: $('#p-featured').checked,
        short: val('#p-short').trim(), long: $('#p-long').innerHTML, tags: val('#p-tags').split(',').map((t) => t.trim()).filter(Boolean), color: draft.colors[0].hex, colorName: draft.colors[0].name
      });
      if (!product.cats.length) product.cats = ['cotton'];
      if (!S.upsertProduct(product)) { A.toast('Browser storage is full. Try removing large images.', 'err'); return; }
      if (isNew) S.initInventory(product.id, product.sizes, opening, S.onlineLoc());
      A.toast(status === 'publish' ? (isNew ? 'Product published' : 'Product updated') : 'Draft saved');
      if (isNew) setTimeout(() => { location.href = 'product-edit.html?id=' + product.id; }, 500);
    };
    $('#btn-publish').addEventListener('click', () => save('publish'));
    $('#btn-draft').addEventListener('click', () => save('draft'));
    $('#btn-publish').textContent = isNew ? 'Publish' : 'Update';
    $('#p-status').addEventListener('change', (e) => { draft.status = e.target.value; });
    $('#btn-trash').hidden = isNew;
    $('#btn-trash').addEventListener('click', () => A.confirm(`Delete “${draft.name}” permanently?`, 'Delete').then((ok) => { if (ok) { S.deleteProducts([draft.id]); location.href = 'products.html'; } }));
    f.addEventListener('submit', (e) => e.preventDefault());
  };

  /* ======================================================================
     Categories
     ====================================================================== */
  P.categories = () => {
    let editing = null;
    const form = $('#cat-form');
    const reset = () => { editing = null; form.reset(); $('#cat-form-title').textContent = 'Add new category'; $('#cat-save').textContent = 'Add category'; $('#cat-cancel').hidden = true; };
    const api = Admin.listTable({
      id: 'categories', mount: $('#list'), perPage: 20, empty: 'No categories yet',
      rows: () => S.categories().map((c) => Object.assign({ count: S.products().filter((p) => p.cats.includes(c.slug)).length }, c)), rowId: (c) => c.id,
      search: (c, q) => (c.name + c.slug + c.desc).toLowerCase().includes(q), searchPlaceholder: 'Search categories',
      columns: [
        { id: 'name', label: 'Name', sort: (a, b) => a.name.localeCompare(b.name), render: (c) => `<b class="row-title">${esc(c.name)}</b>${Admin.actions([{ label: 'Edit', act: 'edit', id: c.id }, { label: 'Delete', act: 'del', id: c.id, danger: true }, { label: 'View', href: '../shop.html?cat=' + c.slug, target: '_blank' }])}` },
        { id: 'desc', label: 'Description', render: (c) => `<span class="muted">${esc(c.desc || '—')}</span>` },
        { id: 'slug', label: 'Slug', render: (c) => `<span class="mono">${esc(c.slug)}</span>` },
        { id: 'count', label: 'Count', cls: 'right', sort: (a, b) => a.count - b.count, render: (c) => `<span class="num">${c.count}</span>` }
      ],
      bulk: [{ id: 'del', label: 'Delete', confirm: 'Delete selected categories? Products keep working but lose this label.', run: (ids) => { S.saveCategories(S.categories().filter((c) => !ids.includes(String(c.id)))); A.toast('Categories deleted'); } }],
      actions: {
        edit: (id, c) => { editing = c.id; form.elements.name.value = c.name; form.elements.slug.value = c.slug; form.elements.desc.value = c.desc || ''; $('#cat-form-title').textContent = 'Edit category'; $('#cat-save').textContent = 'Update category'; $('#cat-cancel').hidden = false; form.elements.name.focus(); },
        del: (id, c, a) => A.confirm(`Delete “${c.name}”?`, 'Delete').then((ok) => { if (ok) { S.saveCategories(S.categories().filter((x) => x.id !== c.id)); a.refresh(); A.toast('Category deleted'); } })
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      if (!name) { form.elements.name.closest('.field').classList.add('err'); form.elements.name.focus(); return; }
      form.elements.name.closest('.field').classList.remove('err');
      const list = S.categories();
      const slug = A.slug(form.elements.slug.value || name);
      if (list.some((c) => c.slug === slug && c.id !== editing)) { A.toast('A category with that slug already exists', 'err'); return; }
      if (editing) {
        const c = list.find((x) => x.id === editing);
        if (c.slug !== slug) { const ps = S.products(); ps.forEach((p) => { p.cats = p.cats.map((s) => (s === c.slug ? slug : s)); }); S.saveProducts(ps); }
        Object.assign(c, { name, slug, desc: form.elements.desc.value.trim() });
      } else list.push({ id: list.reduce((m, c) => Math.max(m, c.id), 0) + 1, name, slug, desc: form.elements.desc.value.trim() });
      S.saveCategories(list); reset(); api.refresh(); A.toast(editing ? 'Category updated' : 'Category added');
    });
    $('#cat-cancel').addEventListener('click', reset);
  };

  /* ======================================================================
     Orders
     ====================================================================== */
  P.orders = () => {
    const statuses = S.statuses;
    const idx = Admin.listTable({
      id: 'orders', mount: $('#list'), perPage: 12, empty: 'No orders found', searchPlaceholder: 'Search orders, customers, phone',
      rows: () => S.orders().sort((a, b) => new Date(b.date) - new Date(a.date)), rowId: (o) => o.id,
      initialView: A.qs.get('status') || undefined, initialQ: A.qs.get('q') || '', initialFilters: { channel: A.qs.get('channel') || '' },
      views: [{ id: 'all', label: 'All' }].concat(statuses.map(([k, l]) => ({ id: k, label: l, filter: (o) => o.status === k }))),
      filters: [
        { id: 'channel', label: 'All channels', options: [['online', 'Online'], ['store', 'In store (POS)']], test: (o, v) => S.channelOf(o) === v },
        { id: 'pay', label: 'All payment methods', options: Object.entries(S.payLabel), test: (o, v) => S.tenders(o).some((t) => t.method === v) },
        { id: 'district', label: 'All districts', options: [...new Set(S.orders().map((o) => o.customer.district))].sort().map((d) => [d, d]), test: (o, v) => o.customer.district === v }
      ],
      search: (o, q) => ('#' + o.id + ' ' + o.customer.name + ' ' + o.customer.phone + ' ' + o.customer.district + ' ' + o.items.map((i) => i.name).join(' ')).toLowerCase().includes(q),
      columns: [
        { id: 'order', label: 'Order', sort: (a, b) => a.id - b.id, render: (o) => `<a class="row-title" href="order-view.html?id=${o.id}">#${o.id} ${esc(o.customer.name)}</a><div class="xs muted">${esc(o.customer.phone)}</div>${Admin.actions([{ label: 'View', href: 'order-view.html?id=' + o.id }, { label: 'Mark completed', act: 'done', id: o.id }, { label: 'Delete', act: 'del', id: o.id, danger: true }])}` },
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (o) => `<span title="${A.dateTime(o.date)}">${A.date(o.date)}</span><div class="xs muted">${A.ago(o.date)}</div>` },
        { id: 'channel', label: 'Channel', render: (o) => Admin.channelBadge(o) },
        { id: 'status', label: 'Status', sort: (a, b) => a.status.localeCompare(b.status), render: (o) => S.statusBadge(o.status) },
        { id: 'items', label: 'Items', render: (o) => `<div class="item-stack">${o.items.slice(0, 3).map((i) => { const p = S.product(i.pid); return p ? Admin.thumb(p, 'xs') : `<span class="thumb xs">${A.panjabi(i.hex || '#888', i.style || 'plain')}</span>`; }).join('')}<span class="xs muted">${A.plural(o.items.reduce((n, i) => n + i.qty, 0), 'pc')}</span></div>` },
        { id: 'district', label: 'District', hidden: true, render: (o) => esc(o.customer.district || '—') },
        { id: 'payment', label: 'Payment', render: (o) => `<span class="small">${S.tenders(o).map((t) => esc(S.payLabel[t.method] || t.method)).join(' + ')}</span>${o.due ? `<div class="xs err">Due ${money(o.due)}</div>` : ''}${o.payRef ? `<div class="xs muted mono">${esc(o.payRef)}</div>` : ''}` },
        { id: 'total', label: 'Total', cls: 'right', sort: (a, b) => a.total - b.total, render: (o) => `<b class="num">${money(o.total)}</b>` }
      ],
      bulk: statuses.filter(([k]) => k !== 'refunded').map(([k, l]) => ({ id: k, label: 'Change status to ' + l.toLowerCase(), run: (ids) => { ids.forEach((id) => S.patchOrder(id, { status: k })); A.toast(`${ids.length} order${ids.length === 1 ? '' : 's'} updated`); } }))
        .concat([{ id: 'delete', label: 'Delete', confirm: 'Delete the selected orders?', run: (ids) => { S.deleteOrders(ids.map(Number)); A.toast('Orders deleted'); } }]),
      actions: {
        done: (id, o, api) => { S.patchOrder(id, { status: 'completed' }); api.refresh(); A.toast(`Order #${id} marked completed`); },
        del: (id, o, api) => A.confirm(`Delete order #${id}?`, 'Delete').then((ok) => { if (ok) { S.deleteOrders([Number(id)]); api.refresh(); A.toast('Order deleted'); } })
      }
    });
    return idx;
  };

  /* ======================================================================
     Order detail
     ====================================================================== */
  P['order-view'] = () => {
    const root = $('#ov');
    const render = () => {
      const o = S.order(A.qs.get('id'));
      if (!o) { root.innerHTML = `<div class="card empty-card">${icon('search', 34)}<h3>Order not found</h3><a class="btn btn-violet" href="orders.html">Back to orders</a></div>`; return; }
      document.title = `Order #${o.id} ‹ Amnu Fashion Admin`;
      const sub = o.items.reduce((s, i) => s + i.price * i.qty, 0);
      const cust = o.customer.phone ? S.customers().find((c) => c.phone === o.customer.phone) : null;
      const isStore = S.channelOf(o) === 'store';
      const tenders = S.tenders(o);
      root.innerHTML = `
      <div class="page-head"><div><div class="row gap-8 wrap"><h1>Order #${o.id}</h1>${S.statusBadge(o.status)}${Admin.channelBadge(o)}</div><p class="muted">${isStore ? `Sold at the store${o.cashier ? ' by ' + esc(o.cashier) : ''}` : 'Placed online'} on ${A.dateTime(o.date)} · ${tenders.map((t) => esc(S.payLabel[t.method] || t.method)).join(' + ')}${o.payRef ? ` · TrxID <span class="mono">${esc(o.payRef)}</span>` : ''}</p></div>
        <div class="row gap-8 wrap no-print"><a class="btn btn-glass" href="orders.html">${icon('chevron-left', 16)} All orders</a>${isStore ? `<button class="btn btn-glass" id="print-rc">${icon('receipt', 16)} Receipt</button>` : ''}<button class="btn btn-glass" id="print">${icon('printer', 16)} Print invoice</button></div></div>
      <div class="editor-layout">
        <div class="col gap-16">
          <section class="card"><div class="detail-cols">
            <div><h3 class="sub-h">Billing</h3><p>${esc(o.customer.name)}${o.customer.address ? `<br>${esc(o.customer.address)}` : ''}${o.customer.district ? `<br>${esc(o.customer.district)}, Bangladesh` : ''}</p><p class="muted small">${o.customer.phone ? `${icon('phone', 14)} <a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a>` : 'No phone recorded'}${o.customer.email ? `<br>${icon('mail', 14)} <a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a>` : ''}</p></div>
            <div><h3 class="sub-h">${isStore ? 'Sold at' : 'Delivery'}</h3>${isStore ? `<p>${esc(settings.storeName)}<br><span class="muted small">Counter sale, taken away by the customer</span></p>` : `<p>${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.district)}, Bangladesh</p><p class="muted small">${o.pickup ? `Click &amp; collect at ${esc(o.pickup)}` : o.shippingMethod ? esc(o.shippingMethod) : o.customer.district === 'Dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</p>`}</div>
            <div><h3 class="sub-h">Payment</h3>${tenders.map((t) => `<div class="draft-row"><span>${esc(S.payLabel[t.method] || t.method)}</span><b class="num">${money(t.amount)}</b></div>`).join('')}${o.change ? `<p class="xs muted">Change given: ${money(o.change)}</p>` : ''}${o.due ? `<p class="small err"><b>Due: ${money(o.due)}</b></p>` : ''}${o.note ? `<h3 class="sub-h" style="margin-top:12px">Customer note</h3><p class="muted small">${esc(o.note)}</p>` : ''}</div></div></section>
          <section class="card"><div class="table-wrap"><table class="wp-table items-table"><thead><tr><th>Item</th><th class="right">Price</th><th class="right">Qty</th><th class="right">Total</th></tr></thead><tbody>
            ${o.items.map((i) => { const p = S.product(i.pid); return `<tr><td><div class="row gap-8">${p ? Admin.thumb(p, 'sm') : `<span class="thumb sm">${A.panjabi(i.hex || '#888', i.style || 'plain')}</span>`}<div><b>${p ? `<a class="row-title" href="product-edit.html?id=${p.id}">${esc(i.name)}</a>` : esc(i.name)}</b><div class="xs muted">Size ${esc(i.size)} · ${esc(i.color)}${p ? ` · SKU ${esc(p.sku)}` : ''}</div></div></div></td><td class="right num">${money(i.price)}</td><td class="right num">× ${i.qty}</td><td class="right num"><b>${money(i.price * i.qty)}</b></td></tr>`; }).join('')}</tbody></table></div>
            <div class="totals"><div><span>Items subtotal</span><b class="num">${money(sub)}</b></div>${o.discount ? `<div><span>Discounts${o.coupon ? ` (${esc(o.coupon)})` : ''}${o.pointsUsed ? ` · ${o.pointsUsed} points` : ''}</span><b class="num ok">− ${money(o.discount)}</b></div>` : ''}${o.vat ? `<div><span>VAT</span><b class="num">${money(o.vat)}</b></div>` : ''}${isStore ? '' : `<div><span>Shipping</span><b class="num">${o.shipping ? money(o.shipping) : 'Free'}</b></div>`}<div class="grand"><span>Order total</span><b class="num">${money(o.total)}</b></div></div></section>
        </div>
        <aside class="col gap-16 no-print">
          <section class="metabox card"><div class="metabox-h"><h3>Order actions</h3></div><div class="metabox-b col">
            <div class="field"><label for="ov-status">Status</label><select id="ov-status">${S.statuses.map(([k, l]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="row between"><button class="btn-link danger small" id="ov-del" type="button">Move to trash</button><button class="btn btn-violet" id="ov-update" type="button">Update</button></div></div></section>
          <section class="metabox card"><div class="metabox-h"><h3>Customer</h3></div><div class="metabox-b"><div class="row gap-8">${Admin.avatar(o.customer.name)}<div><b>${esc(o.customer.name)}</b><div class="xs muted">${cust ? `${cust.orders} orders · ${money(cust.spent)} spent` : 'New customer'}</div></div></div>${o.customer.phone ? `<a class="btn btn-glass btn-sm btn-block" style="margin-top:12px" href="customers.html?q=${encodeURIComponent(o.customer.name)}">View customer</a>` : ''}</div></section>
          <section class="metabox card"><div class="metabox-h"><h3>Order notes</h3></div><div class="metabox-b col">
            <div class="notes" id="ov-notes">${(o.notes || []).slice().reverse().map((n) => `<div class="note ${n.customer ? 'cust' : ''}"><p>${esc(n.text)}</p><span class="xs muted">${A.dateTime(n.date)} · ${esc(n.by || 'Admin')}${n.customer ? ' · note to customer' : ''}</span></div>`).join('') || '<p class="muted small">No notes yet.</p>'}</div>
            <div class="field"><textarea id="ov-note" rows="3" placeholder="Add a note…" aria-label="Add a note"></textarea></div>
            <div class="row between"><label class="check small"><input type="checkbox" id="ov-note-c"> Note to customer</label><button class="btn btn-glass btn-sm" id="ov-add-note" type="button">Add</button></div></div></section>
        </aside>
      </div>`;
      $('#print').addEventListener('click', () => window.print());
      if ($('#print-rc')) $('#print-rc').addEventListener('click', () => Admin.printModal(`Receipt #${o.id}`, Admin.receiptHTML(o)));
      $('#ov-update').addEventListener('click', () => {
        const status = $('#ov-status').value;
        if (status === o.status) { A.toast('Status unchanged'); return; }
        const notes = (o.notes || []).concat([{ text: `Status changed from ${S.statusLabel(o.status)} to ${S.statusLabel(status)}.`, date: new Date().toISOString(), by: 'Amnu Admin' }]);
        S.patchOrder(o.id, { status, notes });
        A.toast('Order updated'); render();
      });
      $('#ov-add-note').addEventListener('click', () => {
        const text = $('#ov-note').value.trim(); if (!text) return;
        S.patchOrder(o.id, { notes: (o.notes || []).concat([{ text, date: new Date().toISOString(), by: 'Amnu Admin', customer: $('#ov-note-c').checked }]) });
        A.toast('Note added'); render();
      });
      $('#ov-del').addEventListener('click', () => A.confirm(`Delete order #${o.id}?`, 'Delete').then((ok) => { if (ok) { S.deleteOrders([o.id]); location.href = 'orders.html'; } }));
    };
    render();
  };

  /* ======================================================================
     Customers
     ====================================================================== */
  P.customers = () => {
    const segment = (c) => (c.spent >= 20000 ? ['VIP', 'b-violet'] : c.orders >= 3 ? ['Loyal', 'b-ok'] : c.orders === 1 ? ['New', 'b-info'] : ['Regular', '']);
    const profile = (c, api) => {
      const orders = S.orders().filter((o) => o.customer.phone === c.phone).sort((a, b) => new Date(b.date) - new Date(a.date));
      const pts = S.points(c.phone); const due = S.dueOf(c.phone);
      const m = A.modal({
        title: 'Customer', wide: true,
        body: `<div class="row gap-16 wrap" style="margin-bottom:16px">${Admin.avatar(c.name, 'lg')}<div class="grow"><h3>${esc(c.name)}</h3><p class="muted small">${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''}<br>${esc(c.address || '')}${c.address && c.district ? ', ' : ''}${esc(c.district || '')}</p></div>
          <div class="stat-pills"><div><span class="xs muted">Orders</span><b>${c.orders}</b></div><div><span class="xs muted">Total spent</span><b>${money(c.spent)}</b></div><div><span class="xs muted">Online</span><b>${money(c.online)}</b></div><div><span class="xs muted">In store</span><b>${money(c.instore)}</b></div><div><span class="xs muted">Points</span><b>${pts.balance}</b></div><div><span class="xs muted">Customer since</span><b>${A.date(c.first)}</b></div></div></div>
          ${due ? `<div class="due-box"><div class="grow"><b class="err">Owes ${money(due)}</b><div class="xs muted">Credit sales not yet collected</div></div><input id="dc-amt" type="number" min="1" max="${due}" value="${due}" aria-label="Amount collected"><select id="dc-acc" aria-label="Received in">${Admin.accountOptions('cash')}</select><button class="btn btn-violet btn-sm" data-collect>Collect</button></div>` : ''}
          <div class="table-wrap"><table class="wp-table"><thead><tr><th>Order</th><th>Date</th><th>Channel</th><th>Status</th><th class="right">Total</th></tr></thead><tbody>${orders.slice(0, 8).map((o) => `<tr><td><a class="row-title" href="order-view.html?id=${o.id}">#${o.id}</a></td><td>${A.date(o.date)}</td><td>${Admin.channelBadge(o)}</td><td>${S.statusBadge(o.status)}</td><td class="right num">${money(o.total)}</td></tr>`).join('')}</tbody></table></div>`
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-collect]')) return;
        const amt = Math.round(Number($('#dc-amt', m.el).value));
        if (!(amt > 0) || amt > due) { A.toast('Enter an amount up to the balance due', 'err'); return; }
        S.collectDue(c.phone, c.name, amt, $('#dc-acc', m.el).value, 'Collected in admin');
        m.close(); api.refresh(); A.toast(`${money(amt)} collected from ${c.name}`);
      });
    };
    const api = Admin.listTable({
      id: 'customers', mount: $('#list'), perPage: 12, empty: 'No customers found', searchPlaceholder: 'Search customers',
      rows: () => S.customers().map((c) => Object.assign(c, { pts: S.points(c.phone).balance, due: S.dueOf(c.phone) })), rowId: (c) => c.phone, initialQ: A.qs.get('q') || '',
      views: [{ id: 'all', label: 'All' }, { id: 'due', label: 'With dues', filter: (c) => c.due > 0 }, { id: 'vip', label: 'VIP', filter: (c) => segment(c)[0] === 'VIP' }, { id: 'loyal', label: 'Loyal', filter: (c) => segment(c)[0] === 'Loyal' }, { id: 'new', label: 'New', filter: (c) => segment(c)[0] === 'New' }],
      filters: [{ id: 'district', label: 'All districts', options: [...new Set(S.customers().map((c) => c.district))].sort().map((d) => [d, d]), test: (c, v) => c.district === v }],
      search: (c, q) => (c.name + c.phone + c.email + c.district).toLowerCase().includes(q),
      columns: [
        { id: 'name', label: 'Customer', sort: (a, b) => a.name.localeCompare(b.name), render: (c) => `<div class="row gap-8">${Admin.avatar(c.name)}<div><a class="row-title" href="#" data-act="view" data-id="${esc(c.phone)}">${esc(c.name)}</a><div class="xs muted">${esc(c.email || '—')}</div></div></div>` },
        { id: 'phone', label: 'Phone', render: (c) => `<span class="mono">${esc(c.phone)}</span>` },
        { id: 'district', label: 'District', sort: (a, b) => a.district.localeCompare(b.district), render: (c) => esc(c.district) },
        { id: 'orders', label: 'Orders', cls: 'right', sort: (a, b) => a.orders - b.orders, render: (c) => `<span class="num">${c.orders}</span>` },
        { id: 'spent', label: 'Total spent', cls: 'right', sort: (a, b) => a.spent - b.spent, render: (c) => `<b class="num">${money(c.spent)}</b>` },
        { id: 'mix', label: 'Online / Store', hidden: true, render: (c) => `<span class="small">${money(c.online)} / ${money(c.instore)}</span>` },
        { id: 'pts', label: 'Points', cls: 'right', sort: (a, b) => a.pts - b.pts, render: (c) => `<span class="num">${c.pts}</span>` },
        { id: 'due', label: 'Due', cls: 'right', sort: (a, b) => a.due - b.due, render: (c) => (c.due ? `<b class="num err">${money(c.due)}</b>` : '<span class="muted">—</span>') },
        { id: 'last', label: 'Last order', sort: (a, b) => new Date(a.last) - new Date(b.last), render: (c) => `<span class="muted small">${A.date(c.last)}</span>` },
        { id: 'seg', label: 'Segment', render: (c) => { const [l, cls] = segment(c); return `<span class="badge ${cls}">${l}</span>`; } }
      ],
      actions: { view: (id, c, a) => profile(c, a) }
    });
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-act="view"]'); if (a) e.preventDefault(); });
  };
})();
