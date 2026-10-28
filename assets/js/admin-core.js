/* ==========================================================================
   Amnu Fashion — admin core
   Shell (sidebar / top bar / footer), dropdowns, command palette and the
   WordPress-style list table used by Products, Orders, Customers, etc.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const { $, $$, esc, icon, money } = A;
  const Admin = (A.admin = {});
  const settings = S.settings();

  /* ---------- small view helpers ---------- */
  Admin.avatar = (name, size) => {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
    const init = String(name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return `<span class="avatar ${size || ''}" style="background:linear-gradient(145deg,hsl(${h} 70% 62%),hsl(${(h + 40) % 360} 62% 48%))">${esc(init)}</span>`;
  };
  Admin.thumb = (p, cls = '') => `<span class="thumb ${cls}">${S.thumb(p)}</span>`;
  Admin.actions = (list) => `<div class="row-actions">${list.filter(Boolean).map((a) => (a.href
    ? `<a href="${a.href}" ${a.target ? `target="${a.target}"` : ''} class="${a.danger ? 'danger' : ''}">${esc(a.label)}</a>`
    : `<button type="button" data-act="${a.act}" data-id="${esc(a.id)}" class="${a.danger ? 'danger' : ''}">${esc(a.label)}</button>`)).join('<span class="sep">|</span>')}</div>`;
  /** <option> list of locations (optionally with an "All" entry) */
  Admin.locOptions = (sel, all) => `${all ? `<option value="">${all}</option>` : ''}${S.locations().map((l) => `<option value="${l.id}" ${sel === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}`;
  Admin.accountOptions = (sel) => S.accounts().map((a) => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  /** download rows as CSV */
  Admin.csv = (name, rows) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; a.click();
    A.toast('Exported ' + name);
  };
  /** show html in a modal and print only that (receipts, Z-reports, invoices) */
  Admin.printModal = (title, html, wide) => A.modal({
    title, wide, body: `<div class="print-area">${html}</div>`,
    footer: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-violet" data-print>${icon('printer', 16)} Print</button>`,
    onOpen(el) { el.querySelector('[data-print]').addEventListener('click', () => { document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing'); }); }
  });
  const CH_BADGE = { store: 'b-violet', online: 'b-info', social: 'b-accent' };
  Admin.channelBadge = (o) => `<span class="badge ${CH_BADGE[S.channelOf(o)] || ''}">${esc(S.channelLabel(o))}</span>`;
  Admin.pageBadge = (status) => (status === 'publish' ? '<span class="badge b-ok">Published</span>' : status === 'draft' ? '<span class="badge b-warn">Draft</span>' : `<span class="badge">${esc(status)}</span>`);
  Admin.stockHTML = (p) => {
    const st = S.stockState(p);
    return st === 'out' ? '<span class="badge b-err"><i class="dot"></i>Out of stock</span>'
      : st === 'low' ? `<span class="badge b-warn"><i class="dot"></i>Low · ${p.stock}</span>`
        : `<span class="badge b-ok"><i class="dot"></i>In stock · ${p.stock}</span>`;
  };
  Admin.priceHTML = (p) => (p.sale ? `<del class="muted">${money(p.price)}</del> <b>${money(p.sale)}</b>` : `<b>${money(p.price)}</b>`);

  /* ======================================================================
     Shell
     ====================================================================== */
  const NAV = () => {
    const open = S.orders().filter((o) => o.status === 'processing' || o.status === 'pending').length;
    const toBook = S.parcels().filter((o) => S.isLive(o) && o.ship.status === 'pending' && o.ship.courier !== 'pickup').length;
    const wip = S.inProduction().length;
    return [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', href: 'index.html' },
      { heading: 'Sales' },
      { id: 'orders', label: 'Orders', icon: 'bag', href: 'orders.html', badge: open },
      { id: 'order-new', label: 'Social media order', icon: 'message', href: 'order-new.html' },
      { id: 'pos', label: 'Showroom POS', icon: 'receipt', href: 'pos.html' },
      { id: 'customers', label: 'Customers', icon: 'users', href: 'customers.html' },
      { id: 'coupons', label: 'Coupons', icon: 'tag', href: 'coupons.html' },
      { id: 'loyalty', label: 'Loyalty points', icon: 'sparkle', href: 'loyalty.html' },
      { heading: 'Delivery' },
      { id: 'couriers', label: 'Couriers & COD', icon: 'truck', href: 'couriers.html', badge: toBook },
      { heading: 'Warehouse' },
      { id: 'fabrics', label: 'Fabric stock', icon: 'package', href: 'fabrics.html' },
      { id: 'production', label: 'Production', icon: 'scissors', href: 'production.html', badge: wip },
      { id: 'purchases', label: 'Fabric purchases', icon: 'swap', href: 'purchases.html' },
      { heading: 'Showroom & catalog' },
      { id: 'products', label: 'Designs & products', icon: 'tag', href: 'products.html', sub: [['All Products', 'products.html', 'products'], ['Add New', 'product-edit.html', 'product-edit'], ['Categories', 'categories.html', 'categories']] },
      { id: 'inventory', label: 'Showroom stock', icon: 'barcode', href: 'inventory.html' },
      { id: 'media', label: 'Media', icon: 'image', href: 'media.html' },
      { id: 'pages', label: 'Pages & Posts', icon: 'file', href: 'pages.html' },
      { heading: 'Finance' },
      { id: 'finance', label: 'Finance overview', icon: 'coins', href: 'finance.html' },
      { id: 'expenses', label: 'Expenses', icon: 'trend-down', href: 'expenses.html' },
      { id: 'accounts', label: 'Accounts & ledger', icon: 'bank', href: 'accounts.html' },
      { id: 'day-close', label: 'Day close', icon: 'lock', href: 'day-close.html' },
      { id: 'reports', label: 'Reports', icon: 'file', href: 'reports.html' },
      { id: 'analytics', label: 'Analytics', icon: 'chart', href: 'analytics.html' },
      { heading: 'Site' },
      { id: 'appearance', label: 'Appearance', icon: 'layout', href: 'appearance.html' },
      { id: 'plugins', label: 'Plugins', icon: 'plug', href: 'plugins.html' },
      { id: 'users', label: 'Users', icon: 'user', href: 'users.html' },
      { id: 'settings', label: 'Settings', icon: 'sliders', href: 'settings.html' }
    ];
  };
  const PARENT = { 'product-edit': 'products', categories: 'products', 'order-view': 'orders' };

  function sidebarHTML(page) {
    const active = PARENT[page] || page;
    const items = NAV().map((n) => {
      if (n.heading) return `<div class="nav-heading">${n.heading}</div>`;
      const on = n.id === active;
      const sub = n.sub && on ? `<ul class="subnav">${n.sub.map(([l, h, id]) => `<li><a href="${h}" class="${id === page ? 'on' : ''}">${l}</a></li>`).join('')}</ul>` : '';
      return `<a class="nav-item ${on ? 'on' : ''}" href="${n.href}" ${on ? 'aria-current="page"' : ''} title="${esc(n.label)}">${icon(n.icon, 20)}<span class="nav-label">${n.label}</span>${n.badge ? `<span class="nav-count">${n.badge}</span>` : ''}</a>${sub}`;
    }).join('');
    return `<div class="side-top"><a class="side-brand" href="index.html" title="AMNO Fashion"><span class="nav-label"><b>AMNO Fashion</b><small>Admin</small></span></a></div>
      <nav class="side-nav" aria-label="Admin">${items}
        <div class="nav-heading">Channels</div>
        <a class="nav-item" href="../index.html" target="_blank" rel="noopener" title="Online store">${icon('store', 20)}<span class="nav-label">Online Store</span><span class="nav-ext">${icon('external', 14)}</span></a>
        <a class="nav-item" href="${esc(settings.facebook)}" target="_blank" rel="noopener" title="Facebook page">${icon('facebook', 20)}<span class="nav-label">Facebook Page</span><span class="nav-ext">${icon('external', 14)}</span></a>
      </nav>
      <div class="side-bottom">
        <button class="nav-item collapse-btn" id="collapse-btn" type="button" title="Collapse menu">${icon('chevron-left', 20)}<span class="nav-label">Collapse menu</span></button>
        <div class="side-card glass-soft"><b>Amnu CMS</b><p class="xs muted">Glass theme v1.0 · demo data is saved in this browser only.</p><a class="btn btn-glass btn-sm btn-block" href="../index.html" target="_blank" rel="noopener">View storefront</a></div>
      </div>`;
  }

  function topbarHTML() {
    const lowStock = S.products().filter((p) => p.status === 'publish' && p.stock <= settings.lowStock).length;
    const openOrders = S.orders().filter((o) => o.status === 'processing' || o.status === 'pending').length;
    const drafts = S.pages().filter((p) => p.status === 'draft').length;
    const today = A.ymd(Date.now());
    const unclosed = S.showrooms().filter((l) => !S.closeFor(l.id, today)).length;
    const alerts = openOrders + lowStock + drafts;
    return `<button class="icon-btn only-mobile" id="side-open" aria-label="Open menu">${icon('menu', 22)}</button>
      <button class="search-btn" id="search-open" type="button" aria-label="Search">${icon('search', 18)}<span>Search anything…</span><kbd>⌘ K</kbd></button>
      <div class="top-actions">
        <div class="dd"><button class="btn btn-violet btn-sm" data-dd aria-haspopup="true">${icon('plus', 16)} <span class="hide-sm">New</span></button>
          <div class="dd-menu glass-strong"><a href="pos.html">${icon('receipt', 18)} POS sale</a><a href="product-edit.html">${icon('package', 18)} Product</a><a href="expenses.html?new=1">${icon('trend-down', 18)} Expense</a><a href="purchases.html?new=1">${icon('swap', 18)} Purchase order</a><a href="pages.html?new=post">${icon('file', 18)} Post</a><a href="coupons.html?new=1">${icon('tag', 18)} Coupon</a><a href="users.html?new=1">${icon('user', 18)} User</a></div></div>
        <div class="dd"><button class="icon-btn" data-dd aria-label="Notifications" aria-haspopup="true">${icon('bell', 20)}${alerts ? '<span class="pulse"></span>' : ''}</button>
          <div class="dd-menu glass-strong wide"><div class="dd-h">Notifications</div>
            <a href="orders.html?status=processing">${icon('bag', 18)}<span><b>${openOrders}</b> orders waiting to be processed</span></a>
            <a href="products.html?stock=low">${icon('alert', 18)}<span><b>${lowStock}</b> products low or out of stock</span></a>
            <a href="pages.html?view=draft">${icon('file', 18)}<span><b>${drafts}</b> drafts to review</span></a>
            <a href="day-close.html">${icon('lock', 18)}<span><b>${unclosed}</b> showroom${unclosed === 1 ? '' : 's'} not closed for today</span></a></div></div>
        <button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">${A.themeIcon()}</button>
        <a class="btn btn-glass btn-sm hide-sm" href="../index.html" target="_blank" rel="noopener">${icon('external', 16)} Visit site</a>
        <div class="dd"><button class="user-btn" data-dd aria-haspopup="true">${Admin.avatar('Amnu Admin', 'sm')}<span class="hide-sm">Howdy, <b>Admin</b></span>${icon('chevron-down', 16)}</button>
          <div class="dd-menu glass-strong right"><div class="dd-h">Amnu Admin<span class="xs muted" style="display:block;font-weight:400">admin@example.com</span></div><a href="users.html">${icon('user', 18)} Profile</a><a href="settings.html">${icon('sliders', 18)} Settings</a><a href="login.html">${icon('logout', 18)} Log out</a></div></div>
      </div>`;
  }

  /* ---------- command palette ---------- */
  function openPalette() {
    const pages = NAV().filter((n) => n.id).map((n) => ({ t: n.label, s: 'Go to page', href: n.href, ic: n.icon }));
    const m = A.modal({
      title: 'Search',
      body: `<div class="input-group">${icon('search')}<input id="pal-q" type="search" placeholder="Search products, orders, customers, pages…" autocomplete="off"></div><div class="pal-results" id="pal-r" role="listbox"></div>`,
      onOpen(el) {
        const input = $('#pal-q', el); const out = $('#pal-r', el); let idx = 0; let items = [];
        const run = () => {
          const q = input.value.trim().toLowerCase();
          const has = (...s) => s.join(' ').toLowerCase().includes(q);
          items = pages.filter((p) => !q || has(p.t)).slice(0, q ? 4 : 6);
          if (q) {
            S.products().filter((p) => has(p.name, p.sku)).slice(0, 4).forEach((p) => items.push({ t: p.name, s: 'Product · ' + p.sku, href: 'product-edit.html?id=' + p.id, ic: 'package' }));
            S.orders().filter((o) => has('#' + o.id, o.customer.name, o.customer.phone)).slice(-4).reverse().forEach((o) => items.push({ t: `Order #${o.id} · ${o.customer.name}`, s: money(o.total), href: 'order-view.html?id=' + o.id, ic: 'bag' }));
            S.customers().filter((c) => has(c.name, c.phone, c.email)).slice(0, 3).forEach((c) => items.push({ t: c.name, s: 'Customer · ' + c.phone, href: 'customers.html?q=' + encodeURIComponent(c.name), ic: 'user' }));
            S.pages().filter((p) => has(p.title)).slice(0, 3).forEach((p) => items.push({ t: p.title, s: p.type === 'post' ? 'Post' : 'Page', href: 'pages.html?q=' + encodeURIComponent(p.title), ic: 'file' }));
          }
          idx = 0;
          out.innerHTML = items.length ? items.map((it, i) => `<a class="pal-item ${i === 0 ? 'on' : ''}" role="option" href="${it.href}">${icon(it.ic, 18)}<span class="grow"><b>${esc(it.t)}</b></span><span class="xs muted">${esc(it.s)}</span></a>`).join('') : '<p class="muted center" style="padding:20px">No results</p>';
        };
        const move = (d) => { const els = $$('.pal-item', out); if (!els.length) return; els[idx].classList.remove('on'); idx = (idx + d + els.length) % els.length; els[idx].classList.add('on'); els[idx].scrollIntoView({ block: 'nearest' }); };
        input.addEventListener('input', A.debounce(run, 80));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          if (e.key === 'Enter') { const el = $$('.pal-item', out)[idx]; if (el) location.href = el.getAttribute('href'); }
        });
        run();
      }
    });
    return m;
  }

  function mountShell(page) {
    $('#sidebar').innerHTML = sidebarHTML(page);
    $('#topbar').innerHTML = topbarHTML();
    const foot = $('#admin-footer');
    if (foot) foot.innerHTML = `<span>Thank you for creating with <b>Amnu CMS</b>.</span><span>Version 1.0 · static template, data stays in your browser</span>`;
    const admin = $('#admin');
    if (DB.get('side.collapsed', false)) admin.classList.add('collapsed');

    document.addEventListener('click', (e) => {
      const t = e.target;
      const dd = t.closest('[data-dd]');
      const inside = t.closest('.dd');
      $$('.dd.open').forEach((d) => { if (d !== inside) d.classList.remove('open'); });
      if (dd) { dd.closest('.dd').classList.toggle('open'); return; }
      if (t.closest('#search-open')) { openPalette(); return; }
      if (t.closest('[data-theme-toggle]')) { A.toggleTheme(); return; }
      if (t.closest('#collapse-btn')) { const c = admin.classList.toggle('collapsed'); DB.set('side.collapsed', c); return; }
      if (t.closest('#side-open')) { admin.classList.add('side-open'); return; }
      if (t.closest('#side-scrim') || t.closest('.side-nav a')) admin.classList.remove('side-open');
      const mb = t.closest('.metabox-h');
      if (mb && !t.closest('a,button:not(.mb-toggle),input,select')) mb.closest('.metabox').classList.toggle('closed');
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      if (e.key === 'Escape') { $$('.dd.open').forEach((d) => d.classList.remove('open')); admin.classList.remove('side-open'); }
    });
    admin.insertAdjacentHTML('beforeend', '<div class="side-scrim" id="side-scrim"></div>');
  }

  /* ======================================================================
     WordPress-style list table
     ====================================================================== */
  Admin.listTable = function (cfg) {
    const root = cfg.mount;
    const prefKey = 'screen.' + cfg.id;
    const prefs = Object.assign({ perPage: cfg.perPage || 10, hidden: cfg.columns.filter((c) => c.hidden).map((c) => c.id) }, DB.get(prefKey, {}));
    const st = { view: (cfg.views && cfg.views[0].id) || 'all', q: cfg.initialQ || '', filters: Object.assign({}, cfg.initialFilters), sort: cfg.sort || null, page: 1, sel: new Set() };
    if (cfg.initialView) st.view = cfg.initialView;
    let rows = cfg.rows();
    const rid = (r) => String(cfg.rowId(r));

    root.innerHTML = `${cfg.views ? '<ul class="views" role="tablist"></ul>' : ''}
      <div class="card list-card">
        <div class="tablenav">
          ${cfg.bulk ? `<div class="bulk"><select aria-label="Bulk actions"><option value="">Bulk actions</option>${cfg.bulk.map((b) => `<option value="${b.id}">${esc(b.label)}</option>`).join('')}</select><button class="btn btn-glass btn-sm" data-apply type="button">Apply</button></div>` : ''}
          ${(cfg.filters || []).map((f) => `<select class="filter" data-filter="${f.id}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}</option>${f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`).join('')}
          <div class="grow"></div>
          <div class="input-group tn-search">${icon('search')}<input type="search" placeholder="${esc(cfg.searchPlaceholder || 'Search')}" aria-label="Search" value="${esc(st.q)}"></div>
          <div class="dd"><button class="btn btn-ghost btn-sm" data-dd type="button">${icon('sliders', 16)} Screen options</button>
            <div class="dd-menu glass-strong right so-menu"><div class="dd-h">Columns</div>${cfg.columns.filter((c) => c.label).map((c) => `<label class="check"><input type="checkbox" data-col="${c.id}" ${prefs.hidden.includes(c.id) ? '' : 'checked'}> ${esc(c.label)}</label>`).join('')}
              <div class="dd-h">Items per page</div><input type="number" min="5" max="100" step="5" data-pp value="${prefs.perPage}" style="min-height:38px"></div></div>
        </div>
        <div class="table-wrap"><table class="wp-table"><thead></thead><tbody></tbody></table></div>
        <div class="tablenav bottom"><span class="muted small" data-count></span><div class="grow"></div><div class="pager-mini"></div></div>
      </div>`;

    const thead = $('thead', root); const tbody = $('tbody', root);
    const cols = () => cfg.columns.filter((c) => !prefs.hidden.includes(c.id));

    const subset = (viewId) => {
      const v = cfg.views ? cfg.views.find((x) => x.id === viewId) : null;
      return v && v.filter ? rows.filter(v.filter) : rows;
    };
    const visible = () => {
      let list = subset(st.view);
      (cfg.filters || []).forEach((f) => { const val = st.filters[f.id]; if (val) list = list.filter((r) => f.test(r, val)); });
      if (st.q && cfg.search) list = list.filter((r) => cfg.search(r, st.q.toLowerCase()));
      if (st.sort) {
        const c = cfg.columns.find((x) => x.id === st.sort.col);
        if (c && c.sort) list = list.slice().sort((a, b) => c.sort(a, b) * (st.sort.dir === 'desc' ? -1 : 1));
      }
      return list;
    };

    const paint = () => {
      const list = visible();
      const pages = Math.max(1, Math.ceil(list.length / prefs.perPage));
      st.page = A.clamp(st.page, 1, pages);
      const slice = list.slice((st.page - 1) * prefs.perPage, st.page * prefs.perPage);
      const cs = cols();

      if (cfg.views) {
        $('.views', root).innerHTML = cfg.views.map((v) => `<li><button type="button" role="tab" data-view="${v.id}" aria-selected="${v.id === st.view}">${esc(v.label)} <span class="views-n">${subset(v.id).length}</span></button></li>`).join('');
      }
      thead.innerHTML = `<tr>${cfg.bulk ? '<th class="check-col"><input type="checkbox" data-all aria-label="Select all"></th>' : ''}${cs.map((c) => `<th class="${c.cls || ''}" ${st.sort && st.sort.col === c.id ? `aria-sort="${st.sort.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${c.sort ? `<button class="th-sort" type="button" data-sort="${c.id}">${esc(c.label)}${st.sort && st.sort.col === c.id ? icon(st.sort.dir === 'asc' ? 'chevron-up' : 'chevron-down', 14) : ''}</button>` : esc(c.label)}</th>`).join('')}</tr>`;
      tbody.innerHTML = slice.length ? slice.map((r) => `<tr data-id="${esc(rid(r))}" class="${st.sel.has(rid(r)) ? 'sel' : ''}">${cfg.bulk ? `<td class="check-col"><input type="checkbox" data-row aria-label="Select row" ${st.sel.has(rid(r)) ? 'checked' : ''}></td>` : ''}${cs.map((c) => `<td class="${c.cls || ''}" data-label="${esc(c.label)}">${c.render(r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${cs.length + (cfg.bulk ? 1 : 0)}" class="empty-row">${icon('search', 28)}<div>${esc(cfg.empty || 'No items found')}</div></td></tr>`;
      const all = $('[data-all]', root);
      if (all) all.checked = slice.length > 0 && slice.every((r) => st.sel.has(rid(r)));
      $('[data-count]', root).textContent = `${A.plural(list.length, 'item')}`;
      $('.pager-mini', root).innerHTML = pages > 1 ? `<button class="btn btn-ghost btn-icon btn-sm" data-pg="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevron-left', 16)}</button><span class="small">Page <b>${st.page}</b> of ${pages}</span><button class="btn btn-ghost btn-icon btn-sm" data-pg="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron-right', 16)}</button>` : '';
    };

    const api = { refresh() { rows = cfg.rows(); st.sel.clear(); paint(); if (cfg.onRefresh) cfg.onRefresh(rows); }, state: st };

    root.addEventListener('click', (e) => {
      const t = e.target;
      const v = t.closest('[data-view]'); if (v) { st.view = v.dataset.view; st.page = 1; st.sel.clear(); paint(); return; }
      const so = t.closest('[data-sort]'); if (so) { const c = so.dataset.sort; st.sort = st.sort && st.sort.col === c ? { col: c, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } : { col: c, dir: 'asc' }; paint(); return; }
      const pg = t.closest('[data-pg]'); if (pg) { st.page = Number(pg.dataset.pg); paint(); return; }
      if (t.closest('[data-apply]')) {
        const sel = $('.bulk select', root).value;
        if (!sel) { A.toast('Choose a bulk action first', 'err'); return; }
        if (!st.sel.size) { A.toast('Select at least one item', 'err'); return; }
        const b = cfg.bulk.find((x) => x.id === sel);
        const ids = [...st.sel];
        const go = () => { b.run(ids, api); api.refresh(); };
        if (b.confirm) A.confirm(`${b.confirm} (${ids.length} item${ids.length === 1 ? '' : 's'})`, b.label).then((ok) => ok && go()); else go();
        return;
      }
      const act = t.closest('[data-act]');
      if (act && cfg.actions && cfg.actions[act.dataset.act]) {
        const id = act.dataset.id;
        cfg.actions[act.dataset.act](id, rows.find((r) => rid(r) === id), api);
      }
    });
    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-all]')) { const list = visible().slice((st.page - 1) * prefs.perPage, st.page * prefs.perPage); list.forEach((r) => (t.checked ? st.sel.add(rid(r)) : st.sel.delete(rid(r)))); paint(); return; }
      if (t.matches('[data-row]')) { const id = t.closest('tr').dataset.id; if (t.checked) st.sel.add(id); else st.sel.delete(id); t.closest('tr').classList.toggle('sel', t.checked); const all = $('[data-all]', root); if (all) { const list = visible().slice((st.page - 1) * prefs.perPage, st.page * prefs.perPage); all.checked = list.every((r) => st.sel.has(rid(r))); } return; }
      if (t.matches('[data-filter]')) { st.filters[t.dataset.filter] = t.value; st.page = 1; paint(); return; }
      if (t.matches('[data-col]')) { prefs.hidden = t.checked ? prefs.hidden.filter((x) => x !== t.dataset.col) : [...prefs.hidden, t.dataset.col]; DB.set(prefKey, prefs); paint(); return; }
      if (t.matches('[data-pp]')) { prefs.perPage = A.clamp(Number(t.value) || 10, 5, 100); DB.set(prefKey, prefs); st.page = 1; paint(); }
    });
    $('.tn-search input', root).addEventListener('input', A.debounce((e) => { st.q = e.target.value.trim(); st.page = 1; paint(); }, 160));
    (cfg.filters || []).forEach((f) => { if (st.filters[f.id]) $(`[data-filter="${f.id}"]`, root).value = st.filters[f.id]; });
    paint();
    return api;
  };

  /* ======================================================================
     boot
     ====================================================================== */
  Admin.boot = (page, controller) => {
    if ($('#sidebar')) mountShell(page);
    if (controller) controller();
    A.hydrate();
  };
})();
