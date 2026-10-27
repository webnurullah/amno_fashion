/* ==========================================================================
   Amnu Fashion — admin page controllers (part 2)
   coupons · media · pages · appearance · analytics · users · plugins · settings
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const Admin = A.admin;
  const { $, $$, esc, icon, money } = A;
  const P = (A.adminPages = A.adminPages || {});

  /* ======================================================================
     Coupons
     ====================================================================== */
  const couponState = (c) => (c.status === 'disabled' ? 'disabled' : new Date(c.expires) < new Date() || (c.limit && c.used >= c.limit) ? 'expired' : 'active');
  const couponValue = (c) => (c.type === 'percent' ? c.value + '% off' : c.type === 'fixed' ? money(c.value) + ' off' : 'Free delivery');

  P.coupons = () => {
    const edit = (code, api) => {
      const c = code ? S.findCoupon(code) : null;
      const m = A.modal({
        title: c ? 'Edit coupon · ' + c.code : 'Add coupon',
        body: `<form id="cf" class="form-grid2" novalidate>
          <div class="field"><label for="cf-code">Coupon code</label><input id="cf-code" name="code" value="${esc(c ? c.code : '')}" ${c ? 'readonly' : ''} placeholder="e.g. EID25" style="text-transform:uppercase"><span class="msg"></span></div>
          <div class="field"><label for="cf-type">Discount type</label><select id="cf-type" name="type"><option value="percent">Percentage</option><option value="fixed">Fixed amount (৳)</option><option value="shipping">Free delivery</option></select></div>
          <div class="field"><label for="cf-value">Value</label><input id="cf-value" name="value" type="number" min="0" value="${c ? c.value : 10}"><span class="msg">Enter a value above 0.</span></div>
          <div class="field"><label for="cf-min">Minimum spend (৳)</label><input id="cf-min" name="min" type="number" min="0" value="${c ? c.min : 0}"></div>
          <div class="field"><label for="cf-limit">Usage limit</label><input id="cf-limit" name="limit" type="number" min="0" value="${c ? c.limit : 100}"><span class="hint">0 = unlimited</span></div>
          <div class="field"><label for="cf-exp">Expiry date</label><input id="cf-exp" name="expires" type="date" value="${c ? c.expires : new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)}"></div>
          <div class="field full"><label for="cf-desc">Description</label><input id="cf-desc" name="desc" value="${esc(c ? c.desc : '')}" placeholder="Shown to staff only"></div>
          <label class="row between full"><span class="bold small">Enabled</span><span class="switch"><input type="checkbox" name="enabled" ${!c || c.status !== 'disabled' ? 'checked' : ''}><span></span></span></label></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save coupon</button>'
      });
      const f = $('#cf', m.el).elements;
      f.type.value = c ? c.type : 'percent';
      const toggle = () => { f.value.disabled = f.type.value === 'shipping'; };
      f.type.addEventListener('change', toggle); toggle();
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const code = f.code.value.trim().toUpperCase().replace(/\s+/g, '');
        const value = Number(f.value.value);
        const list = S.coupons();
        const fld = (n) => f[n].closest('.field');
        $$('.field.err', m.el).forEach((x) => x.classList.remove('err'));
        if (!code) { fld('code').classList.add('err'); $('.msg', fld('code')).textContent = 'Enter a code.'; f.code.focus(); return; }
        if (!c && list.some((x) => x.code === code)) { fld('code').classList.add('err'); $('.msg', fld('code')).textContent = 'That code already exists.'; return; }
        if (f.type.value !== 'shipping' && !(value > 0)) { fld('value').classList.add('err'); return; }
        if (f.type.value === 'percent' && value > 100) { fld('value').classList.add('err'); $('.msg', fld('value')).textContent = 'Percentage cannot exceed 100.'; return; }
        const next = { code, type: f.type.value, value: f.type.value === 'shipping' ? 0 : value, min: Number(f.min.value) || 0, limit: Number(f.limit.value) || 0, used: c ? c.used : 0, expires: f.expires.value, status: f.enabled.checked ? 'active' : 'disabled', desc: f.desc.value.trim() };
        if (c) list[list.findIndex((x) => x.code === c.code)] = next; else list.unshift(next);
        S.saveCoupons(list); m.close(); api.refresh(); A.toast(c ? 'Coupon updated' : 'Coupon created');
      });
    };
    const api = Admin.listTable({
      id: 'coupons', mount: $('#list'), perPage: 10, empty: 'No coupons yet', searchPlaceholder: 'Search coupons',
      rows: () => S.coupons(), rowId: (c) => c.code,
      views: [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active', filter: (c) => couponState(c) === 'active' }, { id: 'expired', label: 'Expired / used up', filter: (c) => couponState(c) === 'expired' }, { id: 'disabled', label: 'Disabled', filter: (c) => couponState(c) === 'disabled' }],
      search: (c, q) => (c.code + ' ' + c.desc).toLowerCase().includes(q),
      columns: [
        { id: 'code', label: 'Code', sort: (a, b) => a.code.localeCompare(b.code), render: (c) => `<b class="row-title mono coupon-code">${esc(c.code)}</b><div class="xs muted">${esc(c.desc || '')}</div>${Admin.actions([{ label: 'Edit', act: 'edit', id: c.code }, { label: couponState(c) === 'disabled' ? 'Enable' : 'Disable', act: 'toggle', id: c.code }, { label: 'Delete', act: 'del', id: c.code, danger: true }])}` },
        { id: 'type', label: 'Discount', render: (c) => `<b>${couponValue(c)}</b>` },
        { id: 'min', label: 'Min spend', render: (c) => (c.min ? money(c.min) : '—') },
        { id: 'usage', label: 'Usage', render: (c) => `<div class="usage"><span class="num small">${c.used}${c.limit ? ' / ' + c.limit : ''}</span>${c.limit ? `<div class="meter"><span style="width:${Math.min(100, (c.used / c.limit) * 100)}%"></span></div>` : ''}</div>` },
        { id: 'expires', label: 'Expires', sort: (a, b) => new Date(a.expires) - new Date(b.expires), render: (c) => `<span class="small">${A.date(c.expires)}</span>` },
        { id: 'status', label: 'Status', render: (c) => { const s = couponState(c); return `<span class="badge ${s === 'active' ? 'b-ok' : s === 'expired' ? 'b-err' : ''}">${s[0].toUpperCase() + s.slice(1)}</span>`; } }
      ],
      bulk: [{ id: 'del', label: 'Delete', confirm: 'Delete the selected coupons?', run: (ids) => { S.saveCoupons(S.coupons().filter((c) => !ids.includes(c.code))); A.toast('Coupons deleted'); } }],
      actions: {
        edit: (id, c, a) => edit(id, a),
        toggle: (id, c, a) => { const l = S.coupons(); const x = l.find((k) => k.code === id); x.status = x.status === 'disabled' ? 'active' : 'disabled'; S.saveCoupons(l); a.refresh(); A.toast(`Coupon ${x.status === 'active' ? 'enabled' : 'disabled'}`); },
        del: (id, c, a) => A.confirm(`Delete coupon ${id}?`, 'Delete').then((ok) => { if (ok) { S.saveCoupons(S.coupons().filter((k) => k.code !== id)); a.refresh(); A.toast('Coupon deleted'); } })
      }
    });
    $('#add-coupon').addEventListener('click', () => edit(null, api));
    if (A.qs.get('new')) edit(null, api);
  };

  /* ======================================================================
     Media library
     ====================================================================== */
  P.media = () => {
    const st = { filter: 'all', q: '', sel: null };
    const items = () => {
      const up = S.media().map((m) => ({ id: m.id, name: m.name, kind: 'upload', date: m.date, size: m.size, html: `<img src="${esc(m.src)}" alt="${esc(m.name)}">`, src: m.src }));
      const art = S.products().map((p) => ({ id: 'p' + p.id, name: p.slug + (p.image ? '.jpg' : '.svg'), kind: 'product', date: p.created, size: p.image ? Math.round(p.image.length * 0.75) : 3200, html: S.thumb(p), product: p }));
      return up.concat(art);
    };
    const bytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    const paint = () => {
      const list = items().filter((m) => (st.filter === 'all' || m.kind === st.filter) && (!st.q || m.name.toLowerCase().includes(st.q)));
      $('#media-count').textContent = A.plural(list.length, 'file');
      $('#media-grid').innerHTML = list.map((m) => `<button type="button" class="media-item ${st.sel === m.id ? 'on' : ''}" data-id="${esc(m.id)}" aria-label="${esc(m.name)}"><span class="media-thumb">${m.html}</span><span class="media-name">${esc(m.name)}</span>${m.kind === 'upload' ? '<span class="media-tag">Uploaded</span>' : ''}</button>`).join('') || `<div class="empty-card">${icon('image', 32)}<p class="muted">No files match.</p></div>`;
      const it = items().find((m) => m.id === st.sel);
      const pane = $('#media-detail');
      if (!it) { pane.innerHTML = `<div class="detail-empty">${icon('image', 32)}<p class="muted small">Select a file to see its details.</p></div>`; return; }
      pane.innerHTML = `<div class="detail-preview">${it.html}</div><dl class="detail-dl"><dt>File name</dt><dd class="mono">${esc(it.name)}</dd><dt>Uploaded on</dt><dd>${A.date(it.date)}</dd><dt>File size</dt><dd>${bytes(it.size)}</dd><dt>Source</dt><dd>${it.kind === 'upload' ? 'Media upload' : 'Product artwork'}</dd></dl>
        ${it.kind === 'upload' ? '<button class="btn btn-danger btn-sm btn-block" data-del>Delete permanently</button>' : `<a class="btn btn-glass btn-sm btn-block" href="product-edit.html?id=${it.product.id}">Edit product</a>`}`;
    };
    const upload = async (files) => {
      const list = S.media(); let n = 0;
      for (const file of files) {
        if (!/^image\//.test(file.type)) { A.toast(`${file.name} is not an image`, 'err'); continue; }
        try { const src = await Admin.compressImage(file, 1200); list.unshift({ id: 'm' + A.uid(), name: file.name.replace(/\.[^.]+$/, '') + '.jpg', src, date: new Date().toISOString(), size: Math.round(src.length * 0.75) }); n++; } catch (e) { A.toast('Could not read ' + file.name, 'err'); }
      }
      if (n && !S.saveMedia(list)) { A.toast('Browser storage is full. Delete some uploads first.', 'err'); return; }
      if (n) { A.toast(`${n} file${n === 1 ? '' : 's'} uploaded`); paint(); }
    };
    $('#media-input').addEventListener('change', (e) => upload([...e.target.files]));
    const zone = $('#drop-zone');
    ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove('over')));
    zone.addEventListener('drop', (e) => { e.preventDefault(); upload([...e.dataTransfer.files]); });
    $('#media-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { st.sel = b.dataset.id; paint(); } });
    $('#media-detail').addEventListener('click', (e) => { if (e.target.closest('[data-del]')) A.confirm('Delete this file permanently?', 'Delete').then((ok) => { if (ok) { S.saveMedia(S.media().filter((m) => m.id !== st.sel)); st.sel = null; paint(); A.toast('File deleted'); } }); });
    $('#media-q').addEventListener('input', A.debounce((e) => { st.q = e.target.value.trim().toLowerCase(); paint(); }, 120));
    $('#media-filter').addEventListener('change', (e) => { st.filter = e.target.value; paint(); });
    paint();
  };

  /* ======================================================================
     Pages & posts
     ====================================================================== */
  P.pages = () => {
    const edit = (id, api, presetType) => {
      const list = S.pages(); const p = id ? list.find((x) => String(x.id) === String(id)) : null;
      const m = A.modal({
        title: p ? 'Edit ' + p.type : 'Add new ' + (presetType || 'post'), wide: true,
        body: `<form id="pf" novalidate class="col"><div class="field"><label for="pf-title">Title</label><input id="pf-title" name="title" class="big-input" value="${esc(p ? p.title : '')}" placeholder="Enter title here"><span class="msg">Please add a title.</span></div>
          <div class="form-grid2"><div class="field"><label>Type</label><select name="type"><option value="page">Page</option><option value="post">Post</option></select></div><div class="field"><label>Status</label><select name="status"><option value="draft">Draft</option><option value="publish">Published</option></select></div>
          <div class="field"><label>Category (posts)</label><input name="cat" value="${esc(p && p.cat ? p.cat : 'Uncategorised')}"></div><div class="field"><label>Slug</label><input name="slug" value="${esc(p ? p.slug : '')}" placeholder="auto"></div></div>
          <div class="field"><label>Content</label><textarea name="body" rows="8" placeholder="Start writing…">${esc(p && p.body ? p.body : '')}</textarea></div></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-glass" data-save="draft">Save draft</button><button class="btn btn-violet" data-save="publish">Publish</button>'
      });
      const f = $('#pf', m.el).elements;
      f.type.value = p ? p.type : (presetType || 'post'); f.status.value = p ? p.status : 'draft';
      m.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-save]'); if (!b) return;
        const title = f.title.value.trim();
        if (!title) { f.title.closest('.field').classList.add('err'); f.title.focus(); return; }
        const status = b.dataset.save === 'publish' ? 'publish' : (f.status.value === 'publish' && p ? 'publish' : 'draft');
        const slug = f.slug.value.trim() || (f.type.value === 'post' ? '/blog/' : '/') + A.slug(title);
        const rec = { id: p ? p.id : list.reduce((n, x) => Math.max(n, x.id), 0) + 1, type: f.type.value, title, slug, author: p ? p.author : 'Amnu Admin', status, date: p ? p.date : new Date().toISOString(), cat: f.cat.value.trim(), body: f.body.value, file: p && p.file };
        if (p) list[list.indexOf(p)] = rec; else list.unshift(rec);
        S.savePages(list); m.close(); api.refresh(); A.toast(status === 'publish' ? 'Published' : 'Draft saved');
      });
    };
    const api = Admin.listTable({
      id: 'pages', mount: $('#list'), perPage: 10, empty: 'Nothing here yet', searchPlaceholder: 'Search pages and posts',
      rows: () => S.pages(), rowId: (p) => p.id, initialQ: A.qs.get('q') || '', initialView: A.qs.get('view') || undefined,
      views: [{ id: 'all', label: 'All' }, { id: 'page', label: 'Pages', filter: (p) => p.type === 'page' }, { id: 'post', label: 'Posts', filter: (p) => p.type === 'post' }, { id: 'publish', label: 'Published', filter: (p) => p.status === 'publish' }, { id: 'draft', label: 'Drafts', filter: (p) => p.status === 'draft' }],
      search: (p, q) => (p.title + ' ' + p.slug + ' ' + (p.cat || '')).toLowerCase().includes(q),
      columns: [
        { id: 'title', label: 'Title', sort: (a, b) => a.title.localeCompare(b.title), render: (p) => `<a class="row-title" href="#" data-act="edit" data-id="${p.id}">${esc(p.title)}</a>${p.status === 'draft' ? ' <span class="draft-tag">— Draft</span>' : ''}${Admin.actions([{ label: 'Edit', act: 'edit', id: p.id }, { label: p.status === 'publish' ? 'Unpublish' : 'Publish', act: 'toggle', id: p.id }, p.file ? { label: 'View', href: '../' + p.file, target: '_blank' } : null, { label: 'Trash', act: 'del', id: p.id, danger: true }])}` },
        { id: 'type', label: 'Type', render: (p) => `<span class="badge ${p.type === 'post' ? 'b-info' : 'b-violet'}">${p.type === 'post' ? 'Post' : 'Page'}</span>` },
        { id: 'author', label: 'Author', render: (p) => `<div class="row gap-8">${Admin.avatar(p.author, 'xs')}<span class="small">${esc(p.author)}</span></div>` },
        { id: 'cat', label: 'Category', render: (p) => (p.type === 'post' ? esc(p.cat || '—') : '—') },
        { id: 'slug', label: 'URL', hidden: true, render: (p) => `<span class="mono xs">${esc(p.slug)}</span>` },
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (p) => `<span class="muted small">${p.status === 'publish' ? 'Published' : 'Last modified'}<br>${A.date(p.date)}</span>` },
        { id: 'status', label: 'Status', render: (p) => Admin.pageBadge(p.status) }
      ],
      bulk: [
        { id: 'publish', label: 'Publish', run: (ids) => { const l = S.pages(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'publish'; }); S.savePages(l); A.toast('Published'); } },
        { id: 'draft', label: 'Move to draft', run: (ids) => { const l = S.pages(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'draft'; }); S.savePages(l); A.toast('Moved to draft'); } },
        { id: 'del', label: 'Move to trash', confirm: 'Delete the selected items?', run: (ids) => { S.savePages(S.pages().filter((p) => !ids.includes(String(p.id)))); A.toast('Deleted'); } }
      ],
      actions: {
        edit: (id, p, a) => edit(id, a),
        toggle: (id, p, a) => { const l = S.pages(); const x = l.find((k) => String(k.id) === String(id)); x.status = x.status === 'publish' ? 'draft' : 'publish'; S.savePages(l); a.refresh(); A.toast(x.status === 'publish' ? 'Published' : 'Moved to draft'); },
        del: (id, p, a) => A.confirm(`Delete “${p.title}”?`, 'Delete').then((ok) => { if (ok) { S.savePages(S.pages().filter((k) => String(k.id) !== String(id))); a.refresh(); A.toast('Deleted'); } })
      }
    });
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-act]'); if (a) e.preventDefault(); });
    $$('[data-new]').forEach((b) => b.addEventListener('click', () => edit(null, api, b.dataset.new)));
    if (A.qs.get('new')) edit(null, api, A.qs.get('new'));
  };

  /* ======================================================================
     Appearance → Customize (live preview in an iframe)
     ====================================================================== */
  P.appearance = () => {
    const DEF = { accent: '#e24b25', blur: 22, opacity: 0.4, radius: 24 };
    const set = S.settings();
    const saved = Object.assign({}, DEF, S.look());
    const st = { look: Object.assign({}, saved), heroTitle: set.heroTitle, heroSub: set.heroSub, announcement: set.announcement };
    const frame = $('#preview-frame');
    const presets = [['#e24b25', 'Coral'], ['#d6336c', 'Rose'], ['#6250d6', 'Violet'], ['#0f8a5f', 'Emerald'], ['#d98b00', 'Amber'], ['#2563c9', 'Ocean']];

    $('#presets').innerHTML = presets.map(([hex, n]) => `<button type="button" class="swatch lg ${hex === st.look.accent ? 'on' : ''}" data-hex="${hex}" style="--c:${hex}" title="${n}" aria-label="${n}"></button>`).join('');
    const fill = () => {
      $('#c-accent').value = st.look.accent; $('#c-blur').value = st.look.blur; $('#c-opacity').value = st.look.opacity; $('#c-radius').value = st.look.radius;
      $('#c-title').value = st.heroTitle; $('#c-sub').value = st.heroSub; $('#c-announce').value = st.announcement;
      $('#v-blur').textContent = st.look.blur + 'px'; $('#v-opacity').textContent = Math.round(st.look.opacity * 100) + '%'; $('#v-radius').textContent = st.look.radius + 'px';
      $$('#presets .swatch').forEach((s) => s.classList.toggle('on', s.dataset.hex.toLowerCase() === st.look.accent.toLowerCase()));
      $('#c-mode').value = DB.get('theme', 'light');
    };
    const send = () => { try { frame.contentWindow.postMessage({ type: 'amnu-look', look: st.look, heroTitle: st.heroTitle, heroSub: st.heroSub, announcement: st.announcement }, '*'); } catch (e) { /* cross-origin */ } };
    fill();
    frame.addEventListener('load', send);
    $('#customizer').addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'c-accent') st.look.accent = e.target.value;
      if (id === 'c-blur') st.look.blur = Number(e.target.value);
      if (id === 'c-opacity') st.look.opacity = Number(e.target.value);
      if (id === 'c-radius') st.look.radius = Number(e.target.value);
      if (id === 'c-title') st.heroTitle = e.target.value;
      if (id === 'c-sub') st.heroSub = e.target.value;
      if (id === 'c-announce') st.announcement = e.target.value;
      if (id === 'c-mode') { DB.set('theme', e.target.value); A.applyTheme(); try { frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme; } catch (er) { /* ignore */ } }
      fill(); send();
    });
    $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-hex]'); if (!b) return; st.look.accent = b.dataset.hex; fill(); send(); });
    $('#devices').addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      $$('#devices button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('#frame-wrap').style.setProperty('--fw', b.dataset.w);
    });
    $('#c-publish').addEventListener('click', () => {
      DB.set('look', st.look);
      S.saveSettings({ heroTitle: st.heroTitle.trim() || DEF_TITLE, heroSub: st.heroSub, announcement: st.announcement });
      A.toast('Changes published to your storefront');
    });
    const DEF_TITLE = 'Choose Your Best Panjabi';
    $('#c-reset').addEventListener('click', () => {
      st.look = Object.assign({}, DEF); st.heroTitle = DEF_TITLE; st.heroSub = "They're all so nice"; st.announcement = 'Free delivery on orders over ৳5,000  ·  Cash on Delivery available all over Bangladesh';
      fill(); send(); A.toast('Reset to defaults. Click Publish to save.');
    });
  };

  /* ======================================================================
     Analytics
     ====================================================================== */
  P.analytics = () => {
    const M = Admin.metrics;
    const sel = $('#a-range'); sel.value = DB.get('an.range', '30');
    const render = () => {
      const N = Number(sel.value); DB.set('an.range', String(N));
      const orders = S.orders();
      const cur = M.buckets(orders, N, 0);
      const inWin = orders.filter((o) => M.startOf(o.date) >= M.dayStart(N - 1));
      const valid = inWin.filter(M.isValid);
      const rev = M.sum(valid, (o) => o.total);

      const prevRev = M.sum(M.buckets(orders, N, N), (b) => b.revenue);
      $('#a-total').textContent = money(rev);
      $('#a-delta').innerHTML = M.deltaHTML(M.pctDelta(rev, prevRev), `vs previous ${N} days`);
      A.charts.area($('#a-revenue'), cur.map((b) => ({ x: new Date(b.t), y: b.revenue })), { name: 'Revenue', height: 280 });
      A.charts.columns($('#a-orders'), cur.map((b) => ({ label: A.dateShort(b.t), tip: A.dateShort(b.t), value: b.orders })), { name: 'Orders', height: 230 });

      const tally = (rows, keyf, valf) => { const m = new Map(); rows.forEach((r) => { const k = keyf(r); m.set(k, (m.get(k) || 0) + valf(r)); }); return [...m].sort((a, b) => b[1] - a[1]); };
      const byCat = new Map();
      valid.forEach((o) => o.items.forEach((i) => { const p = S.product(i.pid); const c = p ? S.categories().find((x) => x.slug === p.cats[0]) : null; const k = c ? c.name : 'Other'; byCat.set(k, (byCat.get(k) || 0) + i.price * i.qty); }));
      A.charts.hbars($('#a-cats'), [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([l, v]) => ({ label: l, value: v, display: money(v) })));
      A.charts.hbars($('#a-status'), tally(inWin, (o) => S.statusLabel(o.status), () => 1).map(([l, v]) => ({ label: l, value: v, display: String(v) })));
      A.charts.hbars($('#a-pay'), tally(valid, (o) => S.payLabel[o.payment], () => 1).map(([l, v]) => ({ label: l, value: v, display: `${v} · ${Math.round((v / valid.length) * 100)}%` })));
      A.charts.hbars($('#a-dist'), tally(valid, (o) => o.customer.district, (o) => o.total).slice(0, 6).map(([l, v]) => ({ label: l, value: v, display: money(v) })));

      /* funnel – sessions are simulated, purchases are real */
      const sessions = M.sum(cur, (b) => b.sessions); const purchases = valid.length;
      const steps = [['Sessions', sessions], ['Viewed a product', Math.round(sessions * 0.62)], ['Added to cart', Math.round(sessions * 0.14)], ['Reached checkout', Math.round(sessions * 0.062)], ['Purchased', purchases]];
      A.charts.hbars($('#a-funnel'), steps.map(([l, v], i) => ({ label: l, value: v, display: `${v.toLocaleString('en-IN')}${i ? ` · ${((v / sessions) * 100).toFixed(1)}%` : ''}` })));

      const aov = valid.length ? rev / valid.length : 0;
      const custs = new Set(valid.map((o) => o.customer.phone));
      $('#a-kpis').innerHTML = [['Revenue', money(rev)], ['Orders', valid.length], ['Avg. order value', money(aov)], ['Active customers', custs.size], ['Cancel / refund rate', inWin.length ? ((inWin.length - valid.length) / inWin.length * 100).toFixed(1) + '%' : '0%']]
        .map(([l, v]) => `<div class="card kpi-lite"><span class="kpi-label">${l}</span><b class="num">${v}</b></div>`).join('');
    };
    sel.addEventListener('change', render);
    render();
    $('#a-export').addEventListener('click', () => {
      const rows = [['Order', 'Date', 'Status', 'Customer', 'District', 'Payment', 'Total']].concat(S.orders().map((o) => [o.id, o.date.slice(0, 10), o.status, o.customer.name, o.customer.district, o.payment, o.total]));
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'amnu-orders.csv'; a.click();
      A.toast('Orders exported as CSV');
    });
  };

  /* ======================================================================
     Users
     ====================================================================== */
  const ROLES = { Administrator: 'Full access to every setting', 'Shop Manager': 'Products, orders, coupons and customers', Editor: 'Pages, posts and media', 'Customer Support': 'View orders and customers' };
  P.users = () => {
    const edit = (id, api) => {
      const list = S.users(); const u = id ? list.find((x) => String(x.id) === String(id)) : null;
      const m = A.modal({
        title: u ? 'Edit user' : 'Add user',
        body: `<form id="uf" class="form-grid2" novalidate><div class="field full"><label>Full name</label><input name="name" value="${esc(u ? u.name : '')}"><span class="msg">Enter a name.</span></div>
          <div class="field"><label>Username</label><input name="username" value="${esc(u ? u.username : '')}"><span class="msg">Enter a username.</span></div><div class="field"><label>Email</label><input name="email" type="email" value="${esc(u ? u.email : '')}"><span class="msg">Enter a valid email.</span></div>
          <div class="field full"><label>Role</label><select name="role">${Object.keys(ROLES).map((r) => `<option>${r}</option>`).join('')}</select><span class="hint" id="role-hint"></span></div></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save user</button>'
      });
      const f = $('#uf', m.el).elements;
      f.role.value = u ? u.role : 'Editor';
      const hint = () => { $('#role-hint', m.el).textContent = ROLES[f.role.value]; }; f.role.addEventListener('change', hint); hint();
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const checks = { name: (v) => v.trim().length > 1, username: (v) => /^[a-z0-9_.-]{3,}$/i.test(v.trim()), email: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) };
        const bad = Object.keys(checks).filter((k) => { const ok = checks[k](f[k].value); f[k].closest('.field').classList.toggle('err', !ok); return !ok; });
        if (bad.length) { f[bad[0]].focus(); return; }
        const rec = { id: u ? u.id : list.reduce((n, x) => Math.max(n, x.id), 0) + 1, name: f.name.value.trim(), username: f.username.value.trim(), email: f.email.value.trim(), role: f.role.value, date: u ? u.date : new Date().toISOString(), posts: u ? u.posts : 0 };
        if (u) list[list.indexOf(u)] = rec; else list.push(rec);
        S.saveUsers(list); m.close(); api.refresh(); A.toast(u ? 'User updated' : 'User added');
      });
    };
    const api = Admin.listTable({
      id: 'users', mount: $('#list'), perPage: 10, empty: 'No users', searchPlaceholder: 'Search users',
      rows: () => S.users(), rowId: (u) => u.id,
      views: [{ id: 'all', label: 'All' }].concat(Object.keys(ROLES).map((r) => ({ id: r, label: r + 's', filter: (u) => u.role === r }))),
      search: (u, q) => (u.name + u.username + u.email + u.role).toLowerCase().includes(q),
      columns: [
        { id: 'name', label: 'Name', sort: (a, b) => a.name.localeCompare(b.name), render: (u) => `<div class="row gap-8">${Admin.avatar(u.name)}<div><b class="row-title">${esc(u.name)}</b><div class="xs muted">@${esc(u.username)}</div></div></div>${Admin.actions([{ label: 'Edit', act: 'edit', id: u.id }, u.id === 1 ? null : { label: 'Delete', act: 'del', id: u.id, danger: true }])}` },
        { id: 'email', label: 'Email', render: (u) => `<a class="u" href="mailto:${esc(u.email)}">${esc(u.email)}</a>` },
        { id: 'role', label: 'Role', render: (u) => `<span class="badge b-violet">${esc(u.role)}</span>` },
        { id: 'posts', label: 'Posts', cls: 'right', render: (u) => `<span class="num">${u.posts}</span>` },
        { id: 'date', label: 'Registered', render: (u) => `<span class="muted small">${A.date(u.date)}</span>` }
      ],
      actions: { edit: (id, u, a) => edit(id, a), del: (id, u, a) => A.confirm(`Delete user ${u.name}?`, 'Delete').then((ok) => { if (ok) { S.saveUsers(S.users().filter((k) => String(k.id) !== String(id))); a.refresh(); A.toast('User deleted'); } }) }
    });
    $('#add-user').addEventListener('click', () => edit(null, api));
    $('#roles').innerHTML = Object.entries(ROLES).map(([r, d]) => `<div class="role-row"><b>${r}</b><span class="muted small">${d}</span></div>`).join('');
    if (A.qs.get('new')) edit(null, api);
  };

  /* ======================================================================
     Plugins
     ====================================================================== */
  P.plugins = () => {
    const st = { cat: 'All', q: '' };
    const paint = () => {
      const list = S.plugins();
      const cats = ['All', ...new Set(list.map((p) => p.cat))];
      $('#plugin-cats').innerHTML = cats.map((c) => `<button class="chip ${c === st.cat ? 'active' : ''}" data-cat="${c}" type="button">${c}</button>`).join('');
      const shown = list.filter((p) => (st.cat === 'All' || p.cat === st.cat) && (!st.q || (p.name + p.desc).toLowerCase().includes(st.q)));
      $('#plugin-count').textContent = `${list.filter((p) => p.active).length} of ${list.length} active`;
      $('#plugin-grid').innerHTML = shown.map((p) => `<article class="card plugin ${p.active ? 'on' : ''}"><div class="row between"><span class="plugin-ico">${icon(p.icon, 22)}</span><label class="switch" title="${p.active ? 'Deactivate' : 'Activate'}"><input type="checkbox" data-id="${p.id}" ${p.active ? 'checked' : ''} aria-label="${esc(p.name)}"><span></span></label></div><h3>${esc(p.name)}</h3><p class="muted small">${esc(p.desc)}</p><div class="row between"><span class="badge">${esc(p.cat)}</span><span class="xs ${p.active ? 'ok' : 'muted'}">${p.active ? 'Active' : 'Inactive'}</span></div></article>`).join('') || '<div class="empty-card"><p class="muted">No plugins match.</p></div>';
    };
    $('#plugin-grid').addEventListener('change', (e) => { const id = e.target.dataset.id; const l = S.plugins(); const p = l.find((x) => x.id === id); p.active = e.target.checked; S.savePlugins(l); A.toast(`${p.name} ${p.active ? 'activated' : 'deactivated'}`); paint(); });
    $('#plugin-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { st.cat = b.dataset.cat; paint(); } });
    $('#plugin-q').addEventListener('input', A.debounce((e) => { st.q = e.target.value.trim().toLowerCase(); paint(); }, 120));
    $('#plugin-add').addEventListener('click', () => A.toast('Demo template: wire this to your plugin marketplace'));
    paint();
  };

  /* ======================================================================
     Settings
     ====================================================================== */
  P.settings = () => {
    const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
    const setPath = (o, path, v) => { const ks = path.split('.'); ks.slice(0, -1).reduce((a, k) => (a[k] = a[k] || {}), o)[ks[ks.length - 1]] = v; };
    const s = S.settings();
    $$('[data-key]').forEach((el) => { const v = get(s, el.dataset.key); if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v; });

    $('#settings-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      $$('#settings-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      $$('.tab-panel').forEach((p) => { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
      $('#save-bar').hidden = b.dataset.tab === 'advanced';
      history.replaceState && (() => { try { history.replaceState(null, '', '#' + b.dataset.tab); } catch (er) { /* file:// */ } })();
    });
    const hash = location.hash.slice(1);
    if (hash && $(`[data-tab="${hash}"]`)) $(`[data-tab="${hash}"]`).click();

    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const patch = {}; let bad = null;
      $$('[data-key]').forEach((el) => {
        let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
        if (el.type === 'number' && (el.value === '' || v < 0)) { bad = bad || el; el.closest('.field').classList.add('err'); } else if (el.closest('.field')) el.closest('.field').classList.remove('err');
        setPath(patch, el.dataset.key, v);
      });
      if (bad) { A.toast('Please fix the highlighted fields', 'err'); bad.focus(); return; }
      const cur = DB.get('settings', {});
      S.saveSettings({ ...patch, shipping: { ...(cur.shipping || {}), ...patch.shipping }, payments: { ...(cur.payments || {}), ...patch.payments } });
      A.toast('Settings saved');
    });

    $('#export-data').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(DB.dump(), null, 2)], { type: 'application/json' })); a.download = 'amnu-demo-data.json'; a.click();
    });
    $('#reset-data').addEventListener('click', () => A.confirm('Reset all demo data (products, orders, settings, uploads) to the original sample content?', 'Reset').then((ok) => { if (ok) { DB.reset(); A.toast('Demo data reset'); setTimeout(() => location.reload(), 600); } }));
  };

  /* ======================================================================
     Login (demo)
     ====================================================================== */
  P.login = () => {
    const f = $('#login-form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = f.elements.user.value.trim(); const p = f.elements.pass.value;
      f.elements.user.closest('.field').classList.toggle('err', !u); f.elements.pass.closest('.field').classList.toggle('err', !p);
      if (!u || !p) return;
      sessionStorage.setItem('amnu.admin', '1');
      location.href = 'index.html';
    });
    $('#fill-demo').addEventListener('click', () => { f.elements.user.value = 'admin'; f.elements.pass.value = 'demo-password'; });
    $('#toggle-pass').addEventListener('click', (e) => { const i = f.elements.pass; i.type = i.type === 'password' ? 'text' : 'password'; e.currentTarget.setAttribute('aria-pressed', i.type === 'text'); });
  };
})();
