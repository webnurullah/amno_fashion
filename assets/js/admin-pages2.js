/* ==========================================================================
   AMNU Fashion — admin page controllers (part 2)
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
     Pages
     ====================================================================== */
  P.pages = () => {
    const edit = (id, api) => {
      const list = S.pages(); const p = id ? list.find((x) => String(x.id) === String(id)) : null;
      const m = A.modal({
        title: p ? 'Edit page' : 'Add new page', wide: true,
        body: `<form id="pf" novalidate class="col"><div class="field"><label for="pf-title">Title</label><input id="pf-title" name="title" class="big-input" value="${esc(p ? p.title : '')}" placeholder="Enter title here"><span class="msg">Please add a title.</span></div>
          <div class="form-grid2"><div class="field"><label>Status</label><select name="status"><option value="draft">Draft</option><option value="publish">Published</option></select></div>
          <div class="field"><label>Slug</label><input name="slug" value="${esc(p ? p.slug : '')}" placeholder="auto"></div></div>
          <div class="field"><label>Content</label><textarea name="body" rows="8" placeholder="Start writing…">${esc(p && p.body ? p.body : '')}</textarea></div></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-glass" data-save="draft">Save draft</button><button class="btn btn-violet" data-save="publish">Publish</button>'
      });
      const f = $('#pf', m.el).elements;
      f.status.value = p ? p.status : 'draft';
      m.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-save]'); if (!b) return;
        const title = f.title.value.trim();
        if (!title) { f.title.closest('.field').classList.add('err'); f.title.focus(); return; }
        const status = b.dataset.save === 'publish' ? 'publish' : (f.status.value === 'publish' && p ? 'publish' : 'draft');
        const slug = f.slug.value.trim() || '/' + A.slug(title);
        const rec = { id: p ? p.id : list.reduce((n, x) => Math.max(n, x.id), 0) + 1, type: 'page', title, slug, author: p ? p.author : 'Amnu Admin', status, date: p ? p.date : new Date().toISOString(), body: f.body.value, file: p && p.file };
        if (p) list[list.indexOf(p)] = rec; else list.unshift(rec);
        S.savePages(list); m.close(); api.refresh(); A.toast(status === 'publish' ? 'Published' : 'Draft saved');
      });
    };
    const api = Admin.listTable({
      id: 'pages', mount: $('#list'), perPage: 10, empty: 'Nothing here yet', searchPlaceholder: 'Search pages',
      rows: () => S.pages().concat(S.collections().map((c) => ({ id: 'c' + c.id, cid: c.id, type: 'shop', title: c.title, slug: 'category.html?c=' + c.slug, status: c.status, author: 'Amnu Admin', cats: c.cats, order: c.order, date: null, file: 'category.html?c=' + c.slug }))), rowId: (p) => p.id, initialQ: A.qs.get('q') || '', initialView: A.qs.get('view') || undefined,
      views: [{ id: 'all', label: 'All' }, { id: 'shop', label: 'Shop pages', filter: (p) => p.type === 'shop' }, { id: 'page', label: 'Content pages', filter: (p) => p.type === 'page' }, { id: 'publish', label: 'Published', filter: (p) => p.status === 'publish' }, { id: 'draft', label: 'Drafts', filter: (p) => p.status === 'draft' }],
      search: (p, q) => (p.title + ' ' + p.slug + ' ' + (p.cat || '')).toLowerCase().includes(q),
      columns: [
        { id: 'title', label: 'Title', sort: (a, b) => a.title.localeCompare(b.title), render: (p) => (p.type === 'shop' ? `<a class="row-title" href="collection-edit.html?id=${p.cid}">${esc(p.title)}</a>${p.status !== 'publish' ? ' <span class="draft-tag">— Draft</span>' : ''}${Admin.actions([{ label: 'Edit', href: `collection-edit.html?id=${p.cid}` }, { label: p.status === 'publish' ? 'Unpublish' : 'Publish', act: 'toggle', id: p.id }, { label: 'View', href: '../' + p.file, target: '_blank' }, { label: 'Trash', act: 'del', id: p.id, danger: true }])}` : `<a class="row-title" href="#" data-act="edit" data-id="${p.id}">${esc(p.title)}</a>${p.status === 'draft' ? ' <span class="draft-tag">— Draft</span>' : ''}${p.system ? ' <span class="muted xs">· Built-in</span>' : ''}${Admin.actions([{ label: 'Edit', act: 'edit', id: p.id }, { label: p.status === 'publish' ? 'Unpublish' : 'Publish', act: 'toggle', id: p.id }, p.file ? { label: 'View', href: '../' + p.file, target: '_blank' } : null, p.system ? null : { label: 'Trash', act: 'del', id: p.id, danger: true }])}`) },
        { id: 'type', label: 'Type', render: (p) => `<span class="badge ${p.type === 'shop' ? 'b-ok' : 'b-violet'}">${p.type === 'shop' ? 'Shop page' : 'Page'}</span>` },
        { id: 'author', label: 'Author', render: (p) => `<div class="row gap-8">${Admin.avatar(p.author, 'xs')}<span class="small">${esc(p.author)}</span></div>` },
        { id: 'cat', label: 'Categories', render: (p) => (p.type === 'shop' ? `<div class="chip-list">${p.cats.map((slug) => { const k = S.categories().find((x) => x.slug === slug); return k ? `<span class="badge">${esc(k.name)}</span>` : ''; }).join('') || '—'}</div>` : '—') },
        { id: 'slug', label: 'URL', hidden: true, render: (p) => `<span class="mono xs">${esc(p.slug)}</span>` },
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (p) => (p.type === 'shop' ? `<span class="muted small">Menu order<br>${p.order || 0}</span>` : `<span class="muted small">${p.status === 'publish' ? 'Published' : 'Last modified'}<br>${A.date(p.date)}</span>`) },
        { id: 'status', label: 'Status', render: (p) => Admin.pageBadge(p.status) }
      ],
      bulk: [
        { id: 'publish', label: 'Publish', run: (ids) => { const l = S.pages(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'publish'; }); S.savePages(l); const cl = S.collections(); cl.forEach((c) => { if (ids.includes('c' + c.id)) c.status = 'publish'; }); S.saveCollections(cl); A.toast('Published'); } },
        { id: 'draft', label: 'Move to draft', run: (ids) => { const l = S.pages(); l.forEach((p) => { if (ids.includes(String(p.id))) p.status = 'draft'; }); S.savePages(l); const cl = S.collections(); cl.forEach((c) => { if (ids.includes('c' + c.id)) c.status = 'draft'; }); S.saveCollections(cl); A.toast('Moved to draft'); } },
        { id: 'del', label: 'Move to trash', confirm: 'Delete the selected items? Built-in pages are kept (you can only set them to draft).', run: (ids) => { S.savePages(S.pages().filter((p) => p.system || !ids.includes(String(p.id)))); S.saveCollections(S.collections().filter((c) => !ids.includes('c' + c.id))); A.toast('Deleted'); } }
      ],
      actions: {
        edit: (id, p, a) => { if (p.key === 'home') { location.href = 'home-edit.html'; return; } if (p.system) { location.href = 'page-edit.html?key=' + p.key; return; } edit(id, a); },
        toggle: (id, p, a) => { if (p.type === 'shop') { const cl = S.collections(); const c = cl.find((k) => k.id === p.cid); c.status = c.status === 'publish' ? 'draft' : 'publish'; S.saveCollections(cl); a.refresh(); A.toast(c.status === 'publish' ? 'Published' : 'Moved to draft'); return; } const l = S.pages(); const x = l.find((k) => String(k.id) === String(id)); x.status = x.status === 'publish' ? 'draft' : 'publish'; S.savePages(l); a.refresh(); A.toast(x.status === 'publish' ? 'Published' : 'Moved to draft'); },
        del: (id, p, a) => A.confirm(`Delete “${p.title}”?`, 'Delete').then((ok) => { if (ok) { if (p.type === 'shop') S.saveCollections(S.collections().filter((k) => k.id !== p.cid)); else S.savePages(S.pages().filter((k) => String(k.id) !== String(id))); a.refresh(); A.toast('Deleted'); } })
      }
    });
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-act]'); if (a) e.preventDefault(); });
    $$('[data-new]').forEach((b) => b.addEventListener('click', () => edit(null, api)));
    if (A.qs.get('new')) edit(null, api, A.qs.get('new'));
  };

  /* ======================================================================
     Appearance → Customize (live preview in an iframe)
     ====================================================================== */
  P.appearance = () => {
    const DEF = { accent: '#2563eb', blur: 22, opacity: 0.4, radius: 24 };
    const set = S.settings();
    const saved = Object.assign({}, DEF, S.look());
    const st = { look: Object.assign({}, saved), heroTitle: set.heroTitle, heroSub: set.heroSub, announcement: set.announcement };
    const frame = $('#preview-frame');
    const presets = [['#2563eb', 'Blue'], ['#121216', 'Black'], ['#c8102e', 'Red'], ['#1f3a5f', 'Navy'], ['#0f6b4e', 'Forest'], ['#8a5a35', 'Camel'], ['#6250d6', 'Violet']];

    $('#presets').innerHTML = presets.map(([hex, n]) => `<button type="button" class="swatch lg ${hex === st.look.accent ? 'on' : ''}" data-hex="${hex}" style="--c:${hex}" title="${n}" aria-label="${n}"></button>`).join('');
    const fill = () => {
      $('#c-accent').value = st.look.accent; $('#c-blur').value = st.look.blur; $('#c-opacity').value = st.look.opacity; $('#c-radius').value = st.look.radius;
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
      if (id === 'c-mode') { DB.set('theme', e.target.value); A.applyTheme(); try { frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme; } catch (er) { /* ignore */ } }
      fill(); send();
    });
    $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-hex]'); if (!b) return; st.look.accent = b.dataset.hex; fill(); send(); });
    $('#devices').addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      $$('#devices button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      $('#frame-wrap').style.setProperty('--fw', b.dataset.w);
    });
    /* ---- site-wide settings: identity, contact, header, footer ---- */
    const base = S.settings();
    const sv = JSON.parse(JSON.stringify({ announcement: base.announcement || '', storeName: base.storeName, tagline: base.tagline, email: base.email, phone: base.phone, address: base.address, facebook: base.facebook, messenger: base.messenger, site: base.site }));
    const getp = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), sv);
    const setp = (path, v) => { const ks = path.split('.'); const last = ks.pop(); const o = ks.reduce((a, k) => a[k], sv); o[last] = v; };
    const tx = (label, path, ph = '') => `<div class="field"><label>${label}</label><input data-p="${path}" value="${esc(getp(path) || '')}" placeholder="${esc(ph)}"></div>`;
    const ck = (label, path) => `<label class="check small"><input type="checkbox" data-p="${path}" ${getp(path) !== false ? 'checked' : ''}> ${label}</label>`;
    const links = (title, path) => `<div class="field"><label>${title}</label>${(getp(path) || []).map((l, i) => `<div class="lk-row" data-list="${path}" data-i="${i}"><input data-lf="label" value="${esc(l.label)}" placeholder="Text"><input data-lf="href" value="${esc(l.href)}" placeholder="Link"><span class="lk-btns"><button type="button" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Up">${icon('chevron-up', 13)}</button><button type="button" data-mv="1" ${i === getp(path).length - 1 ? 'disabled' : ''} aria-label="Down">${icon('chevron-down', 13)}</button><button type="button" data-rm aria-label="Remove">${icon('x', 13)}</button></span></div>`).join('')}<button class="btn btn-glass btn-sm" type="button" data-add="${path}" style="align-self:flex-start">${icon('plus', 13)} Add link</button></div>`;
    const logoBox = () => `<div class="field"><label>Logo picture</label><div class="cp-img-pick"><div class="cp-new-img">${sv.site.logoImage ? `<img src="${sv.site.logoImage}" alt="" style="border-radius:8px;width:auto;max-width:150px;height:46px;object-fit:contain">` : '<span class="muted xs">Text logo (no picture)</span>'}</div><button class="btn btn-glass btn-sm" data-logo-up type="button">${icon('upload', 14)} Upload</button>${sv.site.logoImage ? '<button class="btn btn-ghost btn-sm danger" data-logo-rm type="button">Remove</button>' : ''}</div><span class="hint">Used in the header and the footer. Without a picture the site title is shown as the logo.</span></div>`;
    const siteHTML = () => `
      <details class="c-det" open><summary>Site identity</summary>${tx('Site title', 'storeName')}${tx('Tagline', 'tagline')}${logoBox()}${tx('Logo text (optional)', 'site.logoText', 'Defaults to the site title')}</details>
      <details class="c-det"><summary>Contact &amp; social</summary>${tx('Phone', 'phone')}${tx('Email', 'email')}${tx('Address', 'address')}${tx('Facebook page link', 'facebook')}${tx('Messenger link', 'messenger')}</details>
      <details class="c-det"><summary>Header</summary>${tx('Announcement bar (text above the header, empty = hidden)', 'announcement')}${ck('Show the top bar', 'site.topbar.show')}${ck('Show the email in the top bar', 'site.topbar.showEmail')}${tx('Deliver to (text)', 'site.topbar.deliverTo')}${links('Top bar links', 'site.topbar.links')}${links('Main menu', 'site.menu')}<p class="xs muted">New shop pages you publish are added to the menu automatically.</p></details>
      <details class="c-det"><summary>Footer</summary>${tx('Text under the logo', 'site.footerNote')}
        ${[0, 1, 2].map((i) => `<div class="field"><label>Column ${i + 1} title</label><input data-p="site.footer.cols.${i}.title" value="${esc(sv.site.footer.cols[i].title)}"></div>${links('Column ' + (i + 1) + ' links', 'site.footer.cols.' + i + '.links')}`).join('')}
        ${ck('Show the service center column', 'site.footer.showService')}${tx('Service center title', 'site.footer.serviceTitle')}
        ${ck('Show the payment logos', 'site.footer.showPay')}${tx('Payment title', 'site.footer.payTitle')}
        <div class="row gap-8 wrap">${[['visa', 'VISA'], ['nagad', 'Nagad'], ['bkash', 'bKash'], ['mc', 'Mastercard'], ['cod', 'COD']].map(([k, l]) => ck(l, 'site.footer.pay.' + k)).join('')}</div>
        ${tx('Copyright line', 'site.footer.copyright', '© {year} {name}. All rights reserved.')}<span class="hint">{year} and {name} are filled in for you.</span>
        ${ck('Show the "Admin dashboard" link', 'site.footer.showAdminLink')}</details>`;
    const paintSite = () => { const open = [...$$('#site-groups details')].map((d) => d.open); $('#site-groups').innerHTML = siteHTML(); $$('#site-groups details').forEach((d, i) => { if (open[i] != null) d.open = open[i]; }); };
    paintSite();
    const sg = $('#site-groups');
    sg.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.p) { setp(t.dataset.p, t.type === 'checkbox' ? t.checked : t.value); return; }
      const row = t.closest('[data-list]'); if (row && t.dataset.lf) getp(row.dataset.list)[Number(row.dataset.i)][t.dataset.lf] = t.value;
    });
    sg.addEventListener('click', (e) => {
      const t = e.target; const row = t.closest('[data-list]');
      const add = t.closest('[data-add]'); if (add) { getp(add.dataset.add).push({ label: 'New link', href: 'index.html' }); paintSite(); return; }
      if (row) { const arr = getp(row.dataset.list); const i = Number(row.dataset.i);
        if (t.closest('[data-rm]')) { arr.splice(i, 1); paintSite(); return; }
        const mv = t.closest('[data-mv]'); if (mv) { const j = i + Number(mv.dataset.mv); [arr[i], arr[j]] = [arr[j], arr[i]]; paintSite(); return; } }
      if (t.closest('[data-logo-up]')) { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = async () => { if (!f.files[0]) return; try { sv.site.logoImage = await Admin.compressImage(f.files[0], 600); paintSite(); } catch (er) { A.toast('Could not read that image', 'err'); } }; f.click(); return; }
      if (t.closest('[data-logo-rm]')) { sv.site.logoImage = ''; paintSite(); }
    });
    $('#c-publish').addEventListener('click', () => {
      DB.set('look', st.look);
      S.saveSettings({ announcement: sv.announcement, storeName: sv.storeName.trim() || base.storeName, tagline: sv.tagline, email: sv.email, phone: sv.phone, address: sv.address, facebook: sv.facebook, messenger: sv.messenger, site: sv.site });
      try { frame.contentWindow.location.reload(); } catch (er) { /* cross-origin */ }
      A.toast('Changes published to your storefront');
    });
    const DEF_TITLE = 'Choose Your Best Panjabi';
    $('#c-reset').addEventListener('click', () => {
      st.look = Object.assign({}, DEF);
      fill(); send(); A.toast('Reset to defaults. Click Publish to save.');
    });
  };

  /* ======================================================================
     Analytics
     ====================================================================== */
  P.analytics = () => {
    const M = Admin.metrics;
    const sel = $('#a-range'); sel.value = DB.get('an.range', '30');
    const chSel = $('#a-channel'); chSel.value = DB.get('an.channel', '');
    const render = () => {
      const N = Number(sel.value); DB.set('an.range', String(N)); DB.set('an.channel', chSel.value);
      const orders = S.orders().filter((o) => !chSel.value || S.channelOf(o) === chSel.value);
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
      A.charts.hbars($('#a-pay'), tally(valid, (o) => S.tenders(o).map((t) => S.payLabel[t.method] || t.method).join(' + '), () => 1).map(([l, v]) => ({ label: l, value: v, display: `${v} · ${Math.round((v / valid.length) * 100)}%` })));
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
    sel.addEventListener('change', render); chSel.addEventListener('change', render);
    render();
    $('#a-export').addEventListener('click', () => {
      const rows = [['Order', 'Date', 'Channel', 'Status', 'Customer', 'District', 'Payment', 'Total']].concat(S.orders().map((o) => [o.id, o.date.slice(0, 10), S.channelOf(o), o.status, o.customer.name, o.customer.district, S.tenders(o).map((t) => S.payLabel[t.method] || t.method).join(' + '), o.total]));
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'amnu-orders.csv'; a.click();
      A.toast('Orders exported as CSV');
    });
  };

  /* ======================================================================
     Users
     ====================================================================== */
  const ROLES = { Administrator: 'Full access to every setting', 'Shop Manager': 'Products, orders, coupons, customers and stock', Cashier: 'POS register and day close for one showroom', Accountant: 'Finance, expenses, accounts and reports', Editor: 'Pages and media', 'Customer Support': 'View orders and customers' };
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
        const rec = { id: u ? u.id : list.reduce((n, x) => Math.max(n, x.id), 0) + 1, name: f.name.value.trim(), username: f.username.value.trim(), email: f.email.value.trim(), role: f.role.value, date: u ? u.date : new Date().toISOString()};
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
  P.banners = () => { location.replace('pages.html'); };

  /** one banner picture: preview + upload/remove, saved by the caller */
  const bannerPicker = (host, label, get, set, hint) => {
    const b0 = S.bn(get()); const bn = { image: '', title: '', sub: '', cta: '', link: '', align: 'left' }; Object.assign(bn, b0);
    const read = () => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { if (!i.files[0]) return res(''); try { res(await Admin.compressImage(i.files[0], 1800)); } catch (e) { A.toast('Could not read that image', 'err'); res(''); } }; i.click(); });
    const push = () => set(bn);
    const paint = () => { host.innerHTML = `<div class="field"><label>${esc(label)}</label><div class="cp-img-pick"><div class="bn-thumb wide" style="width:240px">${bn.image ? `<img src="${bn.image}" alt="">` : '<span class="muted xs">No picture</span>'}</div><button class="btn btn-glass btn-sm" data-bn-up type="button">${icon('upload', 14)} ${bn.image ? 'Replace' : 'Upload'}</button>${bn.image ? '<button class="btn btn-ghost btn-sm danger" data-bn-rm type="button">Remove picture</button>' : ''}</div>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>
      <div class="form-grid2"><div class="field"><label>Banner headline (optional)</label><input data-bn="title" value="${esc(bn.title)}" maxlength="60"></div><div class="field"><label>Banner subtitle (optional)</label><input data-bn="sub" value="${esc(bn.sub)}" maxlength="120"></div><div class="field"><label>Button text (optional)</label><input data-bn="cta" value="${esc(bn.cta)}" maxlength="24" placeholder="Shop now"></div><div class="field"><label>Button link</label><input data-bn="link" value="${esc(bn.link)}" placeholder="shop.html?cat=eid"></div>
      <div class="field"><label>Text position</label><select data-bn="align"><option value="left" ${bn.align === 'left' ? 'selected' : ''}>Left</option><option value="center" ${bn.align === 'center' ? 'selected' : ''}>Center</option><option value="right" ${bn.align === 'right' ? 'selected' : ''}>Right</option></select></div></div>`; };
    host.addEventListener('input', (e) => { const k = e.target.dataset.bn; if (k) { bn[k] = e.target.value; push(); } });
    host.addEventListener('click', async (e) => { if (e.target.closest('[data-bn-up]')) { const v = await read(); if (v) { bn.image = v; push(); paint(); } } if (e.target.closest('[data-bn-rm]')) { bn.image = ''; push(); paint(); } });
    paint();
  };

  /* ======================================================================
     Collection pages (WordPress-style list + editor)
     ====================================================================== */
  const catThumbHTML = (c) => `<span class="cat-thumb">${c.image ? `<img src="${c.image}" alt="">` : `<i>${esc((c.name || '?').slice(0, 1).toUpperCase())}</i>`}</span>`;
  P.collections = () => { location.replace('pages.html?view=shop'); return;
    const rows = () => S.collections().map((c) => Object.assign({}, c, { n: S.collectionProducts(c).length }));
    const api = Admin.listTable({
      id: 'collections', mount: $('#list'), perPage: 20, empty: 'No collection pages yet', searchPlaceholder: 'Search pages',
      rows, rowId: (c) => c.id,
      views: [{ id: 'all', label: 'All' }, { id: 'publish', label: 'Published', filter: (c) => c.status === 'publish' }, { id: 'draft', label: 'Drafts', filter: (c) => c.status !== 'publish' }],
      search: (c, q) => (c.title + ' ' + c.slug + ' ' + c.cats.join(' ')).toLowerCase().includes(q),
      columns: [
        { id: 'title', label: 'Title', sort: (a, b) => a.title.localeCompare(b.title), render: (c) => `<a class="row-title" href="collection-edit.html?id=${c.id}">${esc(c.title)}</a>${c.status !== 'publish' ? ' <span class="muted">— Draft</span>' : ''}${Admin.actions([{ label: 'Edit', href: `collection-edit.html?id=${c.id}` }, { label: 'View', href: `../category.html?c=${esc(c.slug)}`, target: '_blank' }, { label: 'Delete', act: 'del', id: c.id, danger: true }])}` },
        { id: 'cats', label: 'Categories', render: (c) => `<div class="chip-list">${c.cats.map((slug) => { const k = S.categories().find((x) => x.slug === slug); return k ? `<span class="badge">${esc(k.name)}</span>` : ''; }).join('') || '<span class="muted">—</span>'}</div>` },
        { id: 'n', label: 'Products', cls: 'right', sort: (a, b) => a.n - b.n, render: (c) => `<span class="num">${c.n}</span>` },
        { id: 'slug', label: 'URL', render: (c) => `<span class="mono xs">category.html?c=${esc(c.slug)}</span>` },
        { id: 'order', label: 'Order', cls: 'right', sort: (a, b) => (a.order || 0) - (b.order || 0), render: (c) => `<span class="num">${c.order || 0}</span>` },
        { id: 'status', label: 'Status', render: (c) => Admin.pageBadge(c.status) }
      ],
      bulk: [{ id: 'del', label: 'Delete', confirm: 'Delete the selected pages? Categories and products are not deleted.', run: (ids) => { S.saveCollections(S.collections().filter((c) => !ids.includes(String(c.id)))); A.toast('Pages deleted'); } }],
      actions: { del: (id, c, a) => A.confirm(`Delete the page “${c.title}”? Its categories and products are kept.`, 'Delete').then((ok) => { if (ok) { S.saveCollections(S.collections().filter((x) => x.id !== c.id)); a.refresh(); A.toast('Page deleted'); } }) }
    });
  };

  P['collection-edit'] = () => {
    const id = Number(A.qs.get('id')) || 0;
    const found = id ? S.collections().find((c) => c.id === id) : null;
    const st = found ? JSON.parse(JSON.stringify(found)) : { id: 0, slug: '', title: '', sub: '', cats: [], status: 'draft', order: S.collections().length + 1 };
    let slugTouched = !!found; let newImg = '';
    const catOf = (slug) => S.categories().find((c) => c.slug === slug);
    const readImg = () => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { if (!i.files[0]) return res(''); try { res(await Admin.compressImage(i.files[0], 700)); } catch (e) { A.toast('Could not read that image', 'err'); res(''); } }; i.click(); });
    const paintHead = () => {
      $('#cp-heading').textContent = st.id ? 'Edit collection page' : 'Add new collection page';
      $('#cp-permalink').innerHTML = `<b>Permalink:</b> category.html?c=<span id="cp-slug-view">${esc(st.slug || '…')}</span> <button type="button" class="btn-link" id="cp-slug-edit">Edit</button>${st.id && st.status === 'publish' ? ` · <a class="btn-link" target="_blank" rel="noopener" href="../category.html?c=${esc(st.slug)}">View page ↗</a>` : ''}`;
      $('#cp-save').textContent = st.status === 'publish' ? (st.id ? 'Update' : 'Publish') : 'Publish';
      $('#cp-draft').hidden = st.status === 'publish' && !!st.id;
      $('#cp-del').hidden = !st.id;
    };
    const paintCats = () => {
      $('#cp-cats').innerHTML = st.cats.length ? st.cats.map((slug, i) => { const c = catOf(slug); if (!c) return ''; return `<div class="cp-row" data-slug="${esc(slug)}">${catThumbHTML(c)}<div class="grow"><b>${esc(c.name)}</b><div class="xs muted">${A.plural(S.categoryCount(slug), 'product')} · ${esc(slug)}</div></div><button class="btn btn-ghost btn-icon btn-sm" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('chevron-up', 14)}</button><button class="btn btn-ghost btn-icon btn-sm" data-mv="1" ${i === st.cats.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('chevron-down', 14)}</button><button class="btn btn-glass btn-sm" data-edit type="button">Edit</button><button class="btn btn-ghost btn-sm danger" data-rm type="button">Remove</button></div>`; }).join('') : '<p class="muted small">No categories on this page yet. Add one below.</p>';
      const free = S.categories().filter((c) => !st.cats.includes(c.slug));
      $('#cp-existing').innerHTML = free.length ? `<option value="">Choose a category…</option>${free.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('')}` : '<option value="">All categories are already on this page</option>';
      $('#cp-existing').disabled = !free.length; $('#cp-add-existing').disabled = !free.length;
      const prods = S.collectionProducts(st);
      $('#cp-count').textContent = A.plural(prods.length, 'product');
      $('#cp-products').innerHTML = prods.slice(0, 18).map((p) => `<a class="cp-prod" href="product-edit.html?id=${p.id}" title="${esc(p.name)}">${Admin.thumb(p, 'sm')}</a>`).join('') + (prods.length > 18 ? `<span class="muted small">+${prods.length - 18} more</span>` : '') || '<p class="muted small">Products appear here automatically when they belong to one of the categories above.</p>';
    };
    const paintNewImg = () => { $('#cp-new-img').innerHTML = newImg ? `<img src="${newImg}" alt=""><button class="btn btn-ghost btn-sm" id="cp-new-rm" type="button">Remove</button>` : '<span class="muted xs">No image yet</span>'; };
    const cbn = S.banners(); let pageBanner = S.bn((cbn.cats || {})[st.slug]); const oldSlug = st.slug;
    bannerPicker($('#cp-banner'), 'Banner picture', () => pageBanner, (v) => { pageBanner = Object.assign({}, v); }, 'Shown at the top of this page when visitors open its shop view. Wide pictures (about 1800 x 700) work best.');
    const fill = () => { $('#cp-title').value = st.title; $('#cp-sub').value = st.sub; $('#cp-status').value = st.status; $('#cp-order').value = st.order; paintHead(); paintCats(); paintNewImg(); };
    fill();
    $('#cp-title').addEventListener('input', (e) => { st.title = e.target.value; if (!slugTouched) { st.slug = A.slug(st.title); const v = $('#cp-slug-view'); if (v) v.textContent = st.slug || '…'; } });
    $('#cp-sub').addEventListener('input', (e) => { st.sub = e.target.value; });
    $('#cp-status').addEventListener('change', (e) => { st.status = e.target.value; paintHead(); });
    $('#cp-order').addEventListener('input', (e) => { st.order = Number(e.target.value) || 0; });
    $('#cp-permalink').addEventListener('click', (e) => { if (!e.target.closest('#cp-slug-edit')) return; const v = prompt('Page slug (used in the address)', st.slug); if (v != null && A.slug(v)) { st.slug = A.slug(v); slugTouched = true; paintHead(); } });
    $('#cp-cats').addEventListener('click', async (e) => {
      const row = e.target.closest('.cp-row'); if (!row) return; const slug = row.dataset.slug; const i = st.cats.indexOf(slug);
      if (e.target.closest('[data-rm]')) { st.cats.splice(i, 1); paintCats(); return; }
      const mv = e.target.closest('[data-mv]'); if (mv) { const j = i + Number(mv.dataset.mv); [st.cats[i], st.cats[j]] = [st.cats[j], st.cats[i]]; paintCats(); return; }
      if (e.target.closest('[data-edit]')) {
        const list = S.categories(); const c = list.find((x) => x.slug === slug); let img = c.image || '';
        const m = A.modal({ title: 'Edit category', body: `<div class="field"><label for="ec-name">Category name</label><input id="ec-name" value="${esc(c.name)}"></div><div class="field"><label>Category image (round picture)</label><div class="cp-img-pick"><div id="ec-img" class="cp-new-img"></div><button class="btn btn-glass btn-sm" id="ec-up" type="button">${icon('upload', 14)} Upload image</button></div></div><div id="ec-banner"></div>`, footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save category</button>' });
        const ebn = S.banners(); let catBanner = S.bn((ebn.cats || {})[slug]); bannerPicker($('#ec-banner', m.el), 'Category page banner', () => catBanner, (v) => { catBanner = Object.assign({}, v); }, 'Shown at the top of this category\'s shop page.');
        const pi = () => { $('#ec-img', m.el).innerHTML = img ? `<img src="${img}" alt=""><button class="btn btn-ghost btn-sm" id="ec-rm" type="button">Remove</button>` : '<span class="muted xs">No image</span>'; }; pi();
        m.el.addEventListener('click', async (ev) => {
          if (ev.target.closest('#ec-up')) { const src = await readImg(); if (src) { img = src; pi(); } return; }
          if (ev.target.closest('#ec-rm')) { img = ''; pi(); return; }
          if (!ev.target.closest('[data-save]')) return;
          const nm = $('#ec-name', m.el).value.trim(); if (!nm) { A.toast('Enter a name', 'err'); return; }
          c.name = nm; c.image = img; S.saveCategories(list); { const bn = S.banners(); bn.cats = bn.cats || {}; if (S.bnHas(catBanner)) bn.cats[slug] = catBanner; else delete bn.cats[slug]; S.saveBanners(bn); } m.close(); paintCats(); A.toast('Category updated');
        });
      }
    });
    $('#cp-add-existing').addEventListener('click', () => { const v = $('#cp-existing').value; if (!v) return; st.cats.push(v); paintCats(); });
    $('#cp-new-up').addEventListener('click', async () => { const src = await readImg(); if (src) { newImg = src; paintNewImg(); } });
    $('#cp-new-img').addEventListener('click', (e) => { if (e.target.closest('#cp-new-rm')) { newImg = ''; paintNewImg(); } });
    $('#cp-add-new').addEventListener('click', () => {
      const name = $('#cp-new-name').value.trim(); if (!name) { A.toast('Enter the category name', 'err'); $('#cp-new-name').focus(); return; }
      const list = S.categories(); let slug = A.slug(name); const dup = list.find((c) => c.slug === slug);
      if (dup) { if (!st.cats.includes(slug)) { st.cats.push(slug); if (newImg && !dup.image) { dup.image = newImg; S.saveCategories(list); } paintCats(); A.toast(`“${dup.name}” already existed, so it was added to this page`); } else A.toast('That category is already on this page', 'err'); return; }
      list.push({ id: list.reduce((m, c) => Math.max(m, c.id), 0) + 1, slug, name, desc: '', image: newImg });
      S.saveCategories(list); st.cats.push(slug); $('#cp-new-name').value = ''; newImg = ''; paintNewImg(); paintCats(); A.toast(`Category “${name}” created and added`);
    });
    const save = (status) => {
      if (!st.title.trim()) { $('#cp-title').closest('.field').classList.add('err'); $('#cp-title').focus(); return; }
      $('#cp-title').closest('.field').classList.remove('err');
      const list = S.collections(); const slug = A.slug(st.slug || st.title);
      if (list.some((c) => c.slug === slug && c.id !== st.id)) { A.toast('Another page already uses that slug', 'err'); return; }
      st.slug = slug; st.title = st.title.trim(); st.status = status;
      { const bn = S.banners(); bn.cats = bn.cats || {}; if (oldSlug && oldSlug !== slug) delete bn.cats[oldSlug]; if (S.bnHas(pageBanner)) bn.cats[slug] = pageBanner; else delete bn.cats[slug]; S.saveBanners(bn); }
      if (st.id) list[list.findIndex((c) => c.id === st.id)] = JSON.parse(JSON.stringify(st));
      else { st.id = list.reduce((m, c) => Math.max(m, c.id), 0) + 1; list.push(JSON.parse(JSON.stringify(st))); }
      S.saveCollections(list); fill(); $('#cp-status').value = st.status;
      try { history.replaceState(null, '', 'collection-edit.html?id=' + st.id); } catch (e) { /* file:// */ }
      A.toast(status === 'publish' ? 'Page published' : 'Draft saved');
    };
    $('#cp-save').addEventListener('click', () => save('publish'));
    $('#cp-draft').addEventListener('click', () => save('draft'));
    $('#cp-del').addEventListener('click', () => A.confirm(`Move “${st.title}” to trash? Its categories and products are kept.`, 'Delete').then((ok) => { if (ok) { S.saveCollections(S.collections().filter((c) => c.id !== st.id)); location.href = 'pages.html?view=shop'; } }));
    $$('.metabox-h').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('closed')));
  };

  /* ======================================================================
     Home page builder (Pages -> Home): sections list | live preview | inspector
     ====================================================================== */
  P['home-edit'] = () => {
    const ICONS = ['gem', 'ruler', 'sparkle', 'zap', 'scissors', 'shield', 'refresh', 'check', 'heart', 'star', 'truck', 'package', 'tag', 'lock', 'globe', 'clock', 'scale', 'coins'];
    const LABEL = { hero: 'Hero slider', collection: 'Collection cards', rail: 'Product row', showrooms: 'Showrooms', recent: 'Recently viewed', quality: 'Product quality' };
    const SIC = { hero: 'image', collection: 'grid', rail: 'tag', showrooms: 'store', recent: 'clock', quality: 'shield' };
    const rec = S.pageDoc('home');
    const st = { layout: JSON.parse(JSON.stringify(S.homeLayout())), slides: JSON.parse(JSON.stringify(S.heroSlides())), craftBg: S.banners().craftBg || '' };
    if (!st.layout.some((x) => x.type === 'hero')) st.layout.unshift({ id: 'hero', type: 'hero', enabled: true });
    let sel = 'hero'; let si = 0; let dirty = false; const undo = []; const redo = [];
    const snapshot = () => JSON.stringify({ l: st.layout, s: st.slides, b: st.craftBg });
    const restore = (j) => { const o = JSON.parse(j); st.layout = o.l; st.slides = o.s; st.craftBg = o.b; if (!sec(sel)) sel = 'hero'; si = Math.min(si, Math.max(0, st.slides.length - 1)); };
    const sec = (id) => st.layout.find((x) => x.id === id);
    let last = snapshot(); let tUndo; let tPrev;
    const pushUndo = () => { const now = snapshot(); if (now === last) return; undo.push(last); if (undo.length > 60) undo.shift(); redo.length = 0; last = now; };
    const changed = (structural) => {
      dirty = true; $('#hb-dirty').hidden = false;
      if (structural) { clearTimeout(tUndo); pushUndo(); } else { clearTimeout(tUndo); tUndo = setTimeout(pushUndo, 700); }
      clearTimeout(tPrev); tPrev = setTimeout(refreshPreview, 650);
      $('#hb-undo').disabled = !undo.length && snapshot() === last; $('#hb-redo').disabled = !redo.length;
    };
    const frame = $('#hb-iframe');
    const saveDraft = () => DB.set('home.draft', { layout: st.layout, slides: st.slides, craftBg: st.craftBg });
    const refreshPreview = () => { saveDraft(); try { frame.contentWindow.location.reload(); } catch (e) { frame.src = frame.src; } };
    const goto = () => { try { frame.contentWindow.postMessage({ type: 'amnu-scroll', id: sel }, '*'); } catch (e) { /* ignore */ } };

    /* ---- left: sections ---- */
    const sub = (x) => ({ hero: `${A.plural(st.slides.filter((s) => s.active !== false).length, 'slide')}`, collection: 'Collection cards', rail: `Product row · ${x.count || 8}`, showrooms: 'From store details', recent: 'Shows automatically', quality: `${(x.cards || []).length} cards · slider` })[x.type];
    const paintList = () => {
      $('#hb-list').innerHTML = st.layout.map((x) => `<div class="hb-sec ${x.id === sel ? 'sel' : ''} ${x.enabled === false ? 'off' : ''}" data-id="${x.id}" ${x.type === 'hero' ? '' : 'draggable="true"'}>
        <span class="hb-grip" title="Drag to reorder">${x.type === 'hero' ? '' : '⋮⋮'}</span><span class="hb-ic">${icon(SIC[x.type] || 'grid', 16)}</span>
        <div class="grow"><b>${esc(x.title || LABEL[x.type])}</b><small>${esc(sub(x) || '')}</small></div>
        <button class="hb-switch ${x.enabled === false ? '' : 'on'}" data-toggle type="button" role="switch" aria-checked="${x.enabled !== false}" aria-label="Visible"></button></div>`).join('');
    };
    const select = (id, scroll = true) => { sel = id; paintList(); paintInsp(); if (scroll) goto(); };
    let dragId = null;
    $('#hb-list').addEventListener('dragstart', (e) => { const r = e.target.closest('.hb-sec'); if (!r) return; dragId = r.dataset.id; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (er) { /* ignore */ } });
    $('#hb-list').addEventListener('dragend', () => { dragId = null; $$('#hb-list .hb-sec').forEach((x) => x.classList.remove('drag', 'over')); });
    $('#hb-list').addEventListener('dragover', (e) => { const r = e.target.closest('.hb-sec'); if (!r || !dragId || r.dataset.id === 'hero') return; e.preventDefault(); $$('#hb-list .hb-sec').forEach((x) => x.classList.toggle('over', x === r)); });
    $('#hb-list').addEventListener('drop', (e) => { const r = e.target.closest('.hb-sec'); if (!r || !dragId || r.dataset.id === 'hero') return; e.preventDefault(); const from = st.layout.findIndex((x) => x.id === dragId); const to = st.layout.findIndex((x) => x.id === r.dataset.id); const [m] = st.layout.splice(from, 1); st.layout.splice(to, 0, m); dragId = null; changed(true); paintList(); });
    $('#hb-list').addEventListener('click', (e) => {
      const r = e.target.closest('.hb-sec'); if (!r) return; const x = sec(r.dataset.id);
      if (e.target.closest('[data-toggle]')) { x.enabled = x.enabled === false; changed(true); paintList(); if (x.id === sel) paintInsp(); return; }
      select(x.id);
    });
    $('#hb-add').addEventListener('click', (e) => { $('#hb-addmenu').hidden = !$('#hb-addmenu').hidden; e.stopPropagation(); });
    document.addEventListener('click', () => { $('#hb-addmenu').hidden = true; });
    $$('#hb-addmenu [data-new]').forEach((b) => b.addEventListener('click', () => {
      const id = 's-' + A.uid().slice(0, 5); const type = b.dataset.new;
      st.layout.push(type === 'rail' ? { id, type, enabled: true, title: 'New products', link: 'shop.html', linkLabel: 'Explore All', source: 'new', cat: '', count: 8 } : { id, type, enabled: true, title: 'New collection', link: 'shop.html', linkLabel: 'Explore All', pages: [], extra: [] });
      changed(true); select(id, false); setTimeout(goto, 900); A.toast('Section added at the bottom');
    }));

    /* ---- right: inspector ---- */
    const field = (label, inner, hint) => `<div class="hb-f"><label>${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const t = (id, k, v, ph = '', extra = '') => `<input data-k="${k}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}" ${extra}>`;
    const opt = (key, cur, list) => `<div class="hb-opt">${list.map(([v, l]) => `<button type="button" data-opt="${key}" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const heroHTML = () => {
      const sl = st.slides[si];
      const strip = `<div class="hb-strip">${st.slides.map((b, i) => `<button type="button" class="hb-th ${i === si ? 'sel' : ''} ${b.active === false ? 'off' : ''}" data-slide-pick="${i}"><i style="${b.image ? `background-image:url('${b.image}');background-size:cover` : ({ a: 'background:linear-gradient(135deg,#d8d6cf,#a8a49b)', c: 'background:linear-gradient(135deg,#9bc2ea,#5f8fcb)', d: 'background:linear-gradient(135deg,#bfe5d3,#6fb293)' })[b.art] || ''}"></i>${esc(b.kicker || b.title || 'Slide ' + (i + 1))}</button>`).join('')}<button type="button" class="hb-th new" data-slide-add aria-label="Add slide">＋</button></div><p class="hb-hint">Click a slide to edit it.</p>`;
      if (!sl) return strip + '<p class="muted small">No slides. Add one with the plus button.</p>';
      const look = sl.image ? 'pic' : (sl.art || 'a');
      return `${strip}
        <div class="hb-g2">${field('Small heading', t('', 'kicker', sl.kicker, '', 'data-s="kicker"'))}${field('Badge', t('', 'stamp', sl.stamp, 'e.g. In stores and online', 'data-s="stamp"'))}</div>
        ${field('Headline', t('', 'title', sl.title, '', 'data-s="title" maxlength="60"'))}${field('Subtitle', t('', 'sub', sl.sub, '', 'data-s="sub" maxlength="90"'))}
        <div class="hb-g2">${field('Button text', t('', 'cta', sl.cta, 'Shop now', 'data-s="cta" maxlength="24"'))}${field('Button link', t('', 'link', sl.link, 'shop.html?cat=eid', 'data-s="link"'))}</div>
        ${field('Background', opt('look', look, [['a', 'Ivory'], ['c', 'Sky'], ['d', 'Mint'], ['pic', 'Picture']]) + (sl.image ? `<div class="hb-pic"><img src="${sl.image}" alt=""><button class="btn btn-glass btn-sm" data-slide-up type="button">${icon('upload', 14)} Replace</button></div>` : look === 'pic' ? `<button class="btn btn-glass btn-sm" data-slide-up type="button" style="margin-top:8px">${icon('upload', 14)} Choose a picture</button>` : ''), 'A picture works best at 1800 x 700.')}
        ${field('Button style', opt('btn', sl.btn === 'glass' ? 'glass' : 'primary', [['primary', 'Blue'], ['glass', 'White']]))}
        <div class="hb-g2" style="margin-top:6px"><button class="btn" data-slide-hide type="button">${sl.active === false ? 'Show slide' : 'Hide slide'}</button><button class="btn danger" data-slide-rm type="button">Delete slide</button></div>
        <button class="btn-link small" data-slide-reset type="button" style="margin-top:12px">Reset all slides to the originals</button>`;
    };
    const body = (x) => {
      if (x.type === 'hero') return heroHTML();
      if (x.type === 'collection') return `<div class="hb-g2">${field('Section title', t('', 'title', x.title))}${field('Link text', t('', 'linkLabel', x.linkLabel, 'Explore All'))}</div>${field('Link address', t('', 'link', x.link, 'category.html?c=panjabi'))}
        <div class="hb-f"><label>Shop pages shown here</label><div class="hb-checks">${S.collections().map((c) => `<label class="check small"><input type="checkbox" data-page="${esc(c.slug)}" ${(x.pages || []).includes(c.slug) ? 'checked' : ''}> ${esc(c.title)} <span class="muted xs">(${A.plural(c.cats.length, 'category', 'categories')})</span></label>`).join('')}</div><span class="hint">Every category of the chosen pages becomes a card.</span></div>
        <div class="hb-f"><label>Extra cards</label>${(x.extra || []).map((c, i) => `<div class="hb-card" data-i="${i}"><input data-extra="title" value="${esc(c.title)}" placeholder="Title"><input data-extra="sub" value="${esc(c.sub || '')}" placeholder="Small text"><input data-extra="link" value="${esc(c.link || '')}" placeholder="shop.html?cat=sets"><button class="btn btn-ghost btn-sm danger" data-extra-rm type="button">Remove</button></div>`).join('')}<button class="btn btn-glass btn-sm" data-extra-add type="button" style="align-self:flex-start">${icon('plus', 14)} Add card</button></div>`;
      if (x.type === 'rail') return `<div class="hb-g2">${field('Section title', t('', 'title', x.title))}${field('Link text', t('', 'linkLabel', x.linkLabel, 'Explore All'))}</div>${field('Link address', t('', 'link', x.link, 'shop.html'))}
        ${field('Show', opt('source', x.source, [['new', 'Newest'], ['popular', 'Best selling'], ['featured', 'Featured'], ['cat', 'A category']]))}
        ${x.source === 'cat' ? field('Category', `<select data-k="cat">${S.categories().map((c) => `<option value="${esc(c.slug)}" ${x.cat === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`) : ''}
        ${field('Number of products', `<input type="number" min="2" max="12" data-k="count" value="${x.count || 8}">`)}`;
      if (x.type === 'showrooms') return `<div class="hb-g2">${field('Section title', t('', 'title', x.title))}${field('Link text', t('', 'linkLabel', x.linkLabel, 'All locations'))}</div><p class="hb-hint">Your showrooms come from the store details.</p>`;
      if (x.type === 'recent') return field('Section title', t('', 'title', x.title)) + '<p class="hb-hint">Shows the products the visitor looked at recently. It stays empty until they have viewed some.</p>';
      if (x.type === 'quality') return `<div class="hb-g2">${field('Small heading', t('', 'kicker', x.kicker))}${field('Section title', t('', 'title', x.title))}</div>
        ${field('Background picture', `<div class="hb-pic">${st.craftBg ? `<img src="${st.craftBg}" alt="">` : '<span class="muted xs">Dark marble (default)</span>'}<button class="btn btn-glass btn-sm" data-bg-up type="button">${icon('upload', 14)} Upload</button>${st.craftBg ? '<button class="btn btn-ghost btn-sm danger" data-bg-rm type="button">Remove</button>' : ''}</div>`)}
        <div class="hb-f"><label>Cards</label>${(x.cards || []).map((c, i) => `<div class="hb-qc" data-i="${i}"><div class="row gap-8"><select data-card="ic" aria-label="Icon">${ICONS.map((n) => `<option ${c.ic === n ? 'selected' : ''}>${n}</option>`).join('')}</select><input class="grow" data-card="t" value="${esc(c.t)}" placeholder="Card title"><button class="hb-mini" data-card-mv="-1" ${i === 0 ? 'disabled' : ''} type="button" aria-label="Move up">${icon('chevron-up', 13)}</button><button class="hb-mini" data-card-mv="1" ${i === x.cards.length - 1 ? 'disabled' : ''} type="button" aria-label="Move down">${icon('chevron-down', 13)}</button><button class="hb-mini danger" data-card-rm type="button" aria-label="Remove">${icon('x', 13)}</button></div><textarea data-card="d" rows="2" placeholder="Short description">${esc(c.d)}</textarea></div>`).join('')}<button class="btn btn-glass btn-sm" data-card-add type="button" style="align-self:flex-start">${icon('plus', 14)} Add card</button></div>`;
      return '';
    };
    const paintInsp = () => {
      const x = sec(sel); if (!x) return;
      $('#hb-insp').innerHTML = `<div class="hb-ih"><span class="hb-ic lg">${icon(SIC[x.type] || 'grid', 20)}</span><div class="grow"><b>${esc(x.title || LABEL[x.type])}</b><small>${LABEL[x.type]}</small></div></div><div class="hb-ib">${body(x)}</div>
        ${x.type === 'collection' || x.type === 'rail' ? `<div class="hb-if"><button class="btn danger" data-del type="button">Delete this section</button></div>` : ''}`;
    };
    const insp = $('#hb-insp');
    const pickImg = () => new Promise((res) => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = async () => { if (!f.files[0]) return res(''); try { res(await Admin.compressImage(f.files[0], 1800)); } catch (er) { A.toast('Could not read that image', 'err'); res(''); } }; f.click(); });
    insp.addEventListener('input', (e) => {
      const el = e.target; const x = sec(sel); if (!x) return;
      if (el.dataset.s) { st.slides[si][el.dataset.s] = el.value; changed(false); if (el.dataset.s === 'kicker' || el.dataset.s === 'title') { const th = $$('.hb-th', insp)[si]; if (th) th.lastChild.textContent = el.value || 'Slide ' + (si + 1); } return; }
      if (el.dataset.page) { x.pages = x.pages || []; const i = x.pages.indexOf(el.dataset.page); if (el.checked && i < 0) x.pages.push(el.dataset.page); if (!el.checked && i >= 0) x.pages.splice(i, 1); changed(false); return; }
      const row = el.closest('[data-i]'); const i = row ? Number(row.dataset.i) : -1;
      if (el.dataset.extra && i >= 0) { x.extra[i][el.dataset.extra] = el.value; changed(false); return; }
      if (el.dataset.card && i >= 0) { x.cards[i][el.dataset.card] = el.value; changed(false); return; }
      if (el.dataset.k) {
        x[el.dataset.k] = el.type === 'number' ? Math.min(12, Math.max(2, Number(el.value) || 8)) : el.value; changed(false);
        if (el.dataset.k === 'title') { const b = $('.hb-ih b', insp); if (b) b.textContent = el.value || LABEL[x.type]; const lb = $(`.hb-sec[data-id="${x.id}"] .grow b`); if (lb) lb.textContent = el.value || LABEL[x.type]; }
      }
    });
    insp.addEventListener('click', async (e) => {
      const el = e.target; const x = sec(sel); if (!x) return;
      const pick = el.closest('[data-slide-pick]'); if (pick) { si = Number(pick.dataset.slidePick); paintInsp(); return; }
      if (el.closest('[data-slide-add]')) { st.slides.push({ id: 'b' + A.uid(), art: 'a', kicker: '', title: 'New slide', sub: '', stamp: '', cta: 'Shop now', btn: 'primary', link: 'shop.html', active: true }); si = st.slides.length - 1; changed(true); paintList(); paintInsp(); return; }
      if (el.closest('[data-slide-rm]')) { st.slides.splice(si, 1); si = Math.max(0, si - 1); changed(true); paintList(); paintInsp(); return; }
      if (el.closest('[data-slide-hide]')) { const s = st.slides[si]; s.active = s.active === false; changed(true); paintList(); paintInsp(); return; }
      if (el.closest('[data-slide-reset]')) { if (await A.confirm('Put the slider back to its three original slides? Your own pictures are removed from it.', 'Reset')) { st.slides = S.heroDefault(); si = 0; changed(true); paintList(); paintInsp(); } return; }
      if (el.closest('[data-slide-up]')) { const v = await pickImg(); if (v) { st.slides[si].image = v; changed(true); paintInsp(); } return; }
      const op = el.closest('[data-opt]');
      if (op) {
        const k = op.dataset.opt; const v = op.dataset.v;
        if (k === 'look') { const s = st.slides[si]; if (v === 'pic') { if (!s.image) { const img = await pickImg(); if (!img) return; s.image = img; } } else { delete s.image; s.art = v; } }
        else if (k === 'btn') st.slides[si].btn = v;
        else if (k === 'source') x.source = v;
        changed(true); paintInsp(); return;
      }
      if (el.closest('[data-extra-add]')) { x.extra = x.extra || []; x.extra.push({ title: '', sub: '', link: 'shop.html', pid: 1 }); changed(true); paintInsp(); return; }
      if (el.closest('[data-extra-rm]')) { x.extra.splice(Number(el.closest('[data-i]').dataset.i), 1); changed(true); paintInsp(); return; }
      if (el.closest('[data-card-add]')) { x.cards = x.cards || []; x.cards.push({ t: '', d: '', ic: 'check' }); changed(true); paintInsp(); paintList(); return; }
      if (el.closest('[data-card-rm]')) { x.cards.splice(Number(el.closest('[data-i]').dataset.i), 1); changed(true); paintInsp(); paintList(); return; }
      const cm = el.closest('[data-card-mv]'); if (cm) { const k = Number(el.closest('[data-i]').dataset.i); const j = k + Number(cm.dataset.cardMv); [x.cards[k], x.cards[j]] = [x.cards[j], x.cards[k]]; changed(true); paintInsp(); return; }
      if (el.closest('[data-bg-up]')) { const v = await pickImg(); if (v) { st.craftBg = v; changed(true); paintInsp(); } return; }
      if (el.closest('[data-bg-rm]')) { st.craftBg = ''; changed(true); paintInsp(); return; }
      if (el.closest('[data-del]')) { if (await A.confirm(`Delete the section “${x.title || LABEL[x.type]}”?`, 'Delete')) { st.layout.splice(st.layout.indexOf(x), 1); changed(true); select('hero'); } }
    });
    insp.addEventListener('change', (e) => { if (e.target.dataset.k === 'cat') { sec(sel).cat = e.target.value; changed(false); } });

    /* ---- top bar ---- */
    $('#hb-status').textContent = rec && rec.status === 'publish' ? 'Published' : 'Draft'; $('#hb-status').className = 'badge ' + (rec && rec.status === 'publish' ? 'b-ok' : 'b-warn');
    $('#hb-dev').addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; $$('#hb-dev button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#hb-frame').style.setProperty('--fw', b.dataset.w); });
    const apply = (j) => { restore(j); last = snapshot(); paintList(); paintInsp(); clearTimeout(tPrev); tPrev = setTimeout(refreshPreview, 300); dirty = true; $('#hb-dirty').hidden = false; $('#hb-undo').disabled = !undo.length; $('#hb-redo').disabled = !redo.length; };
    $('#hb-undo').addEventListener('click', () => { clearTimeout(tUndo); pushUndo(); if (!undo.length) return; redo.push(snapshot()); apply(undo.pop()); });
    $('#hb-redo').addEventListener('click', () => { if (!redo.length) return; undo.push(snapshot()); apply(redo.pop()); });
    $('#hb-undo').disabled = true; $('#hb-redo').disabled = true;
    $('#hb-save').addEventListener('click', () => {
      S.saveHomeLayout(st.layout); const bn = S.banners(); bn.slides = st.slides; if (st.craftBg) bn.craftBg = st.craftBg; else delete bn.craftBg; S.saveBanners(bn);
      DB.remove ? DB.remove('home.draft') : DB.set('home.draft', null); dirty = false; $('#hb-dirty').hidden = true; A.toast('Home page updated'); refreshPreviewLive();
    });
    const refreshPreviewLive = () => { try { frame.contentWindow.location.reload(); } catch (e) { /* ignore */ } };
    $('#hb-reset').addEventListener('click', () => A.confirm('Put the whole home page back to its original layout and text?', 'Reset').then((ok) => { if (ok) { S.saveHomeLayout(S.homeDefault()); const bn = S.banners(); delete bn.slides; S.saveBanners(bn); DB.set('home.draft', null); dirty = false; location.reload(); } }));
    window.addEventListener('message', (e) => { const d = e.data || {}; if (d.type === 'amnu-select' && sec(d.id)) { if (d.id === 'hero' || true) select(d.id, false); } if (d.type === 'amnu-ready') setTimeout(goto, 250); });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    saveDraft(); frame.src = '../index.html?preview=1';
    paintList(); paintInsp();
  };

  /* ======================================================================
     Built-in page editor (about, contact, policies...): edit every text of the storefront page
     ====================================================================== */
  P['page-edit'] = async () => {
    const key = A.qs.get('key'); const rec = S.pageDoc(key);
    if (!rec) { location.href = 'pages.html'; return; }
    if (key === 'home') { location.replace('home-edit.html'); return; }
    $('#pe-title').textContent = 'Edit page: ' + rec.title;
    $('#pe-status').value = rec.status;
    $('#pe-view').href = '../' + (rec.file || 'index.html');
    const main = $('#pe-main');
    const saved = S.pageText(key); const isPolicy = key.startsWith('policy-'); const pk = key.replace('policy-', '');
    let pb = S.bn(key === 'shop' ? (S.banners().cats || {}).all : (S.banners().pages || {})[key]);
    const bannerHost = $('#pe-banner'); bannerHost.className = 'card';
    bannerPicker(bannerHost, key === 'shop' ? 'Shop page banner (all products)' : 'Page banner', () => pb, (v) => { pb = Object.assign({}, v); }, key === 'shop' ? 'Shown above the products. Each category can have its own banner under Pages > its shop page.' : 'A wide picture shown at the top of this page. Leave empty for no banner.');
    const saveBanner = () => { const bn = S.banners(); if (key === 'shop') { bn.cats = bn.cats || {}; if (S.bnHas(pb)) bn.cats.all = pb; else delete bn.cats.all; } else { bn.pages = bn.pages || {}; if (S.bnHas(pb)) bn.pages[key] = pb; else delete bn.pages[key]; } S.saveBanners(bn); };
    const done = (msg) => { saveBanner(); rec.status = $('#pe-status').value; rec.date = new Date().toISOString(); const l = S.pages(); l[l.findIndex((x) => x.id === rec.id)] = rec; S.savePages(l); A.toast(msg || 'Page updated'); };
    if (isPolicy) {
      const cur = S.policy(pk); const st = { title: cur.title, paras: cur.paras.slice() };
      const paint = () => { main.innerHTML = `<div class="card"><div class="field"><label for="pp-title">Page title</label><input id="pp-title" class="big-input" value="${esc(st.title)}"></div></div>
        <div class="card metabox"><div class="metabox-h"><h3>Page text</h3></div><div class="metabox-b col gap-12">${st.paras.map((t, i) => t === 'TABLE' ? `<div class="hm-qcard" data-i="${i}"><div class="row between"><b class="small">Size chart table</b><span class="muted xs">Shown automatically</span></div></div>` : `<div class="hm-qcard" data-i="${i}"><textarea data-para rows="3">${esc(t)}</textarea><div class="row gap-8"><button class="btn btn-ghost btn-icon btn-sm" data-mv="-1" ${i === 0 ? 'disabled' : ''} type="button" aria-label="Move up">${icon('chevron-up', 14)}</button><button class="btn btn-ghost btn-icon btn-sm" data-mv="1" ${i === st.paras.length - 1 ? 'disabled' : ''} type="button" aria-label="Move down">${icon('chevron-down', 14)}</button><button class="btn btn-ghost btn-sm danger" data-rm type="button">Remove paragraph</button></div></div>`).join('')}<button class="btn btn-glass btn-sm" id="pp-add" type="button" style="align-self:flex-start">${icon('plus', 14)} Add paragraph</button></div></div>`; };
      paint();
      main.addEventListener('input', (e) => { if (e.target.id === 'pp-title') st.title = e.target.value; const row = e.target.closest('[data-i]'); if (row && e.target.dataset.para != null) st.paras[Number(row.dataset.i)] = e.target.value; });
      main.addEventListener('click', (e) => {
        if (e.target.closest('#pp-add')) { st.paras.push(''); paint(); return; }
        const row = e.target.closest('[data-i]'); if (!row) return; const i = Number(row.dataset.i);
        if (e.target.closest('[data-rm]')) { st.paras.splice(i, 1); paint(); return; }
        const mv = e.target.closest('[data-mv]'); if (mv) { const j = i + Number(mv.dataset.mv); [st.paras[i], st.paras[j]] = [st.paras[j], st.paras[i]]; paint(); }
      });
      $('#pe-save').addEventListener('click', () => { S.savePageText(key, { title: st.title.trim() || cur.title, paras: st.paras.filter((t) => t === 'TABLE' || t.trim()) }); rec.title = st.title.trim() || rec.title; done(); });
      return;
    }
    if (key === 'shop') {
      main.innerHTML = '<div class="card"><p>Edit the shop page banner in the "Shop page banner" box above: add a picture and/or a headline, subtitle and button. Without a picture your headline sits on the default illustrated banner. The products and categories listed below the banner come from Products.</p><ul class="small muted" style="margin:10px 0 0 18px;list-style:disc"><li>Change products and categories in <a class="btn-link" href="products.html">Products</a>.</li><li>Each category and shop page has its own banner in <a class="btn-link" href="pages.html">Pages</a>.</li></ul></div>';
      $('#pe-save').addEventListener('click', () => done());
      return;
    }
    main.innerHTML = '<div class="card"><p class="muted">Loading the page…</p></div>';
    let fields = [];
    try {
      const html = await (await fetch('../' + rec.file)).text();
      const dom = new DOMParser().parseFromString(html, 'text/html');
      fields = [...dom.querySelectorAll('[data-edit]')].map((el) => ({ k: el.dataset.edit, label: el.dataset.label || el.dataset.edit, group: el.dataset.group || 'Content', type: el.dataset.type || (el.tagName === 'P' ? 'area' : 'text'), def: el.textContent.replace(/\s+/g, ' ').trim() }));
    } catch (e) { fields = []; }
    if (!fields.length) { main.innerHTML = '<div class="card"><p>This page could not be loaded for editing. Open the admin from your website address (not from a file on your computer) and try again.</p></div>'; return; }
    const groups = [...new Set(fields.map((f) => f.group))];
    const val = {}; fields.forEach((f) => { val[f.k] = saved[f.k] != null && saved[f.k] !== '' ? saved[f.k] : f.def; });
    main.innerHTML = groups.map((g) => `<div class="card metabox"><div class="metabox-h"><h3>${esc(g)}</h3><span class="mb-toggle">${icon('chevron-up', 18)}</span></div><div class="metabox-b col gap-12">${fields.filter((f) => f.group === g).map((f) => `<div class="field"><label>${esc(f.label)}</label>${f.type === 'area' ? `<textarea data-k="${esc(f.k)}" rows="3">${esc(val[f.k])}</textarea>` : `<input data-k="${esc(f.k)}" value="${esc(val[f.k])}">`}</div>`).join('')}</div></div>`).join('');
    main.addEventListener('input', (e) => { if (e.target.dataset.k) val[e.target.dataset.k] = e.target.value; });
    $$('.metabox-h', main).forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('closed')));
    $('#pe-save').addEventListener('click', () => { const out = {}; fields.forEach((f) => { if (val[f.k].trim() && val[f.k].replace(/\s+/g, ' ').trim() !== f.def) out[f.k] = val[f.k].trim(); }); S.savePageText(key, out); done(); });
  };

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
