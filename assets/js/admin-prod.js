/* ==========================================================================
   AMNO Fashion — admin controllers: warehouse, production & delivery
   fabrics · purchases (fabric) · production · order-new (social media) · couriers
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
  const sum = (arr, f) => arr.reduce((n, x) => n + (f ? f(x) : x), 0);

  /* ---------- shared bits ---------- */
  const swatch = (f) => `<span class="fab-sw" style="--c:${esc(f.hex || '#999')}" aria-hidden="true"></span>`;
  /** a quantity box with a yard / inch switch */
  const qtyBox = (id, val, unit = 'yd', step = '0.25') => `<div class="qty-unit"><input id="${id}" type="number" min="0" step="${step}" value="${val == null ? '' : val}" placeholder="0"><select id="${id}-u" aria-label="Unit"><option value="yd" ${unit === 'yd' ? 'selected' : ''}>yard</option><option value="in" ${unit === 'in' ? 'selected' : ''}>inch</option></select></div>`;
  const readQty = (root, id) => S.toYards($('#' + id, root).value, $('#' + id + '-u', root).value);
  const both = (yd) => `<b class="num">${S.fmtYd(yd)}</b><div class="xs muted num">${S.fmtIn(yd)}</div>`;
  const fabricOptions = (sel) => S.fabrics().map((f) => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.name)} · ${S.fmtYd(f.stock)} in stock</option>`).join('');
  const kpi = (label, value, sub, ic) => `<div class="card kpi-lite"><span class="kpi-label">${icon(ic, 14)} ${label}</span><b class="num">${value}</b>${sub ? `<span class="xs muted">${sub}</span>` : ''}</div>`;
  const tabs = (root, map) => root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    $$('button', root).forEach((x) => x.setAttribute('aria-selected', x === b));
    Object.entries(map).forEach(([k, el]) => { el.hidden = k !== b.dataset.tab; });
  });

  /* ======================================================================
     Fabric stock (warehouse)
     ====================================================================== */
  P.fabrics = () => {
    let unit = DB.get('fab.unit', 'yd');
    const kp = () => {
      const fs = S.fabrics(); const low = fs.filter(S.fabricLow);
      $('#fab-kpis').innerHTML = [
        kpi('Fabric in warehouse', S.fmtLen(S.fabricYards(), unit), unit === 'yd' ? S.fmtIn(S.fabricYards()) : S.fmtYd(S.fabricYards()), 'package'),
        kpi('Stock value (at cost)', money(S.fabricValue()), `${fs.length} fabrics`, 'coins'),
        kpi('Low on fabric', low.length, low.map((f) => f.name).join(', ') || 'All above reorder level', 'alert'),
        kpi('Sent to production (30 days)', S.fmtLen(S.fabricUsed(null, 30), unit), `${S.batches().filter((b) => new Date(b.date) >= new Date(Date.now() - 30 * 864e5)).length} batches`, 'scissors')
      ].join('');
    };
    kp();

    const edit = (id, api) => {
      const list = S.fabrics(); const f = id ? list.find((x) => x.id === id) : null;
      const m = A.modal({
        title: f ? `Edit fabric · ${f.name}` : 'Add fabric', wide: true,
        body: `<form id="ff" class="form-grid2" novalidate>
          <div class="field"><label for="ff-name">Fabric name *</label><input id="ff-name" value="${esc(f ? f.name : '')}" placeholder="e.g. Combed Cotton"><span class="msg">Enter a name.</span></div>
          <div class="field"><label for="ff-type">Type</label><input id="ff-type" value="${esc(f ? f.type : '')}" placeholder="Cotton, Linen, Silk…"></div>
          <div class="field"><label for="ff-colors">Colours in stock</label><input id="ff-colors" value="${esc(f ? f.colors : '')}" placeholder="e.g. Navy, Sky, Olive"></div>
          <div class="field"><label for="ff-hex">Swatch colour</label><input id="ff-hex" type="color" value="${esc(f ? f.hex : '#8a7a5a')}"></div>
          <div class="field"><label for="ff-width">Width (inches)</label><input id="ff-width" type="number" min="0" value="${f ? f.width : 44}"></div>
          <div class="field"><label for="ff-reorder">Reorder when below</label>${qtyBox('ff-reorder', f ? f.reorder : 50)}</div>
          ${f ? `<div class="field"><span class="label">In stock</span><div class="small" style="padding-top:10px">${S.fmtYd(f.stock)} · ${S.fmtIn(f.stock)} at ${money(f.rate)}/yd</div><span class="hint">Change stock with a purchase or an adjustment.</span></div>`
    : `<div class="field"><label for="ff-open">Opening stock</label>${qtyBox('ff-open', 0)}</div><div class="field"><label for="ff-rate">Cost per yard (৳)</label><input id="ff-rate" type="number" min="0" value="0"></div>`}
        </form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save fabric</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const name = $('#ff-name', m.el).value.trim();
        $('#ff-name', m.el).closest('.field').classList.toggle('err', !name);
        if (!name) return;
        const rec = Object.assign({}, f || { id: 'fab' + A.uid().slice(0, 5), stock: readQty(m.el, 'ff-open'), rate: Number($('#ff-rate', m.el).value) || 0 }, {
          name, type: $('#ff-type', m.el).value.trim(), colors: $('#ff-colors', m.el).value.trim(), hex: $('#ff-hex', m.el).value,
          width: Number($('#ff-width', m.el).value) || 0, reorder: readQty(m.el, 'ff-reorder')
        });
        if (f) list[list.indexOf(f)] = rec; else list.push(rec);
        S.saveFabrics(list); m.close(); api.refresh(); kp(); A.toast(f ? 'Fabric updated' : 'Fabric added');
      });
    };
    const adjust = (id, api) => {
      const f = S.fabric(id);
      const m = A.modal({
        title: `Adjust stock · ${f.name}`,
        body: `<p class="small muted">In the warehouse now: <b>${S.fmtYd(f.stock)}</b> (${S.fmtIn(f.stock)}).</p>
          <div class="field" style="margin-top:12px"><span class="label">What happened?</span><div class="seg" id="aj-mode" role="group"><button type="button" data-m="count" aria-pressed="true">Counted stock</button><button type="button" data-m="waste" aria-pressed="false">Wastage / damage</button><button type="button" data-m="found" aria-pressed="false">Found / returned</button></div></div>
          <div class="field" style="margin-top:12px"><label for="aj-q" id="aj-l">Counted quantity</label>${qtyBox('aj-q', '')}</div>
          <div class="field"><label for="aj-note">Note</label><input id="aj-note" placeholder="e.g. Monthly count, cutting waste"></div><p class="xs muted" id="aj-res"></p>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save</button>'
      });
      let mode = 'count';
      const delta = () => { const q = readQty(m.el, 'aj-q'); return mode === 'count' ? q - f.stock : mode === 'waste' ? -q : q; };
      const hint = () => { const d = delta(); $('#aj-res', m.el).textContent = $('#aj-q', m.el).value === '' ? '' : `Change: ${d > 0 ? '+' : ''}${S.fmtYd(d)} → new stock ${S.fmtYd(Math.max(0, f.stock + d))}`; };
      m.el.addEventListener('input', hint); m.el.addEventListener('change', hint);
      m.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (b) { mode = b.dataset.m; $$('#aj-mode button', m.el).forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#aj-l', m.el).textContent = mode === 'count' ? 'Counted quantity' : mode === 'waste' ? 'Quantity lost' : 'Quantity added'; hint(); return; }
        if (!e.target.closest('[data-save]')) return;
        if ($('#aj-q', m.el).value === '') { A.toast('Enter a quantity', 'err'); return; }
        const d = delta(); if (!d) { m.close(); return; }
        S.adjustFabric(id, d, mode === 'count' ? 'stocktake' : mode === 'waste' ? 'wastage' : 'found', $('#aj-note', m.el).value.trim());
        m.close(); api.refresh(); moves.refresh(); kp(); A.toast(`${f.name}: ${d > 0 ? '+' : ''}${S.fmtYd(d)}`);
      });
    };

    const api = Admin.listTable({
      id: 'fabrics', mount: $('#list'), perPage: 15, empty: 'No fabrics yet', searchPlaceholder: 'Search fabric or colour',
      rows: () => S.fabrics(), rowId: (f) => f.id,
      views: [{ id: 'all', label: 'All fabrics' }, { id: 'low', label: 'Low stock', filter: S.fabricLow }],
      filters: [{ id: 'type', label: 'All types', options: [...new Set(S.fabrics().map((f) => f.type).filter(Boolean))].map((t) => [t, t]), test: (f, v) => f.type === v }],
      search: (f, q) => [f.name, f.type, f.colors].join(' ').toLowerCase().includes(q),
      columns: [
        { id: 'name', label: 'Fabric', sort: (a, b) => a.name.localeCompare(b.name), render: (f) => `<div class="row gap-8">${swatch(f)}<div><b class="row-title">${esc(f.name)}</b><div class="xs muted">${esc([f.type, f.colors].filter(Boolean).join(' · '))}${f.width ? ` · ${f.width}" wide` : ''}</div></div></div>${Admin.actions([{ label: 'Buy more', href: `purchases.html?new=1&fab=${f.id}` }, { label: 'Adjust', act: 'adj', id: f.id }, { label: 'Edit', act: 'edit', id: f.id }])}` },
        { id: 'stock', label: 'In stock', cls: 'right', sort: (a, b) => a.stock - b.stock, render: (f) => `<b class="num nowrap">${S.fmtLen(f.stock, unit)}</b><div class="xs muted num nowrap">${unit === 'yd' ? S.fmtIn(f.stock) : S.fmtYd(f.stock)}</div>` },
        { id: 'rate', label: 'Cost / yard', cls: 'right', sort: (a, b) => a.rate - b.rate, render: (f) => `<span class="num">${money(f.rate)}</span><div class="xs muted num">${money(f.rate / 36)}/in</div>` },
        { id: 'value', label: 'Value', cls: 'right', sort: (a, b) => a.stock * a.rate - b.stock * b.rate, render: (f) => `<span class="num">${money(f.stock * f.rate)}</span>` },
        { id: 'status', label: 'Reorder', render: (f) => { const d = S.daysOfCover(f); return `${S.fabricLow(f) ? '<span class="badge b-err"><i class="dot"></i>Low</span>' : '<span class="badge b-ok"><i class="dot"></i>OK</span>'}<div class="xs muted">below ${S.fmtYd(f.reorder)}${d !== Infinity ? ` · lasts ~${d} days` : ''}</div>`; } },
        { id: 'designs', label: 'Designs from this cloth (can make)', render: (f) => S.designsFor(f.id).map((p) => `<div class="xs"><a class="u" href="product-edit.html?id=${p.id}">${esc(p.name)}</a> <b class="num">${S.canMake(p)}</b> pcs <span class="muted">· ${p.recipe.yards} yd each</span></div>`).join('') || '<span class="xs muted">No designs yet</span>' }
      ],
      actions: { adj: (id, f, a) => adjust(id, a), edit: (id, f, a) => edit(id, a) }
    });

    const REASON = { purchase: ['Purchase', 'b-ok'], production: ['To production', 'b-violet'], stocktake: ['Stock count', 'b-warn'], wastage: ['Wastage', 'b-err'], found: ['Found / returned', 'b-ok'] };
    const moves = Admin.listTable({
      id: 'fabric-moves', mount: $('#moves'), perPage: 15, empty: 'No fabric movements yet', searchPlaceholder: 'Search movements',
      rows: () => S.fabricMoves().map((m, i) => Object.assign({ _id: i }, m)), rowId: (m) => m._id,
      filters: [{ id: 'fab', label: 'All fabrics', options: S.fabrics().map((f) => [f.id, f.name]), test: (m, v) => m.fabricId === v }, { id: 'reason', label: 'All reasons', options: Object.entries(REASON).map(([k, v]) => [k, v[0]]), test: (m, v) => m.reason === v }],
      search: (m, q) => (S.fabricName(m.fabricId) + ' ' + m.ref + ' ' + m.note).toLowerCase().includes(q),
      columns: [
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (m) => `<span class="small">${A.date(m.date)}</span>` },
        { id: 'fab', label: 'Fabric', render: (m) => { const f = S.fabric(m.fabricId) || { hex: '#999', name: m.fabricId }; return `<div class="row gap-8">${swatch(f)}<b class="small">${esc(f.name)}</b></div>`; } },
        { id: 'delta', label: 'Change', cls: 'right', render: (m) => `<b class="num ${m.delta > 0 ? 'ok' : 'err'}">${m.delta > 0 ? '+' : ''}${S.fmtLen(m.delta, unit)}</b><div class="xs muted num">${unit === 'yd' ? S.fmtIn(m.delta) : S.fmtYd(m.delta)}</div>` },
        { id: 'reason', label: 'Reason', render: (m) => { const r = REASON[m.reason] || [m.reason, '']; return `<span class="badge ${r[1]}">${esc(r[0])}</span>`; } },
        { id: 'ref', label: 'Reference', render: (m) => `${m.ref ? `<span class="mono xs">${esc(m.ref)}</span>` : ''}<div class="xs muted">${esc(m.note || '')}</div>` }
      ]
    });

    tabs($('#fab-tabs'), { stock: $('#list'), moves: $('#moves') });
    $('#fab-unit').addEventListener('click', (e) => {
      const b = e.target.closest('[data-u]'); if (!b) return;
      unit = b.dataset.u; DB.set('fab.unit', unit);
      $$('#fab-unit button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      api.refresh(); moves.refresh(); kp();
    });
    $$('#fab-unit button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.u === unit));
    $('#add-fabric').addEventListener('click', () => edit(null, api));
    $('#fab-export').addEventListener('click', () => Admin.csv('amnu-fabric-stock.csv', [['Fabric', 'Type', 'Colours', 'Stock (yd)', 'Stock (in)', 'Cost per yard', 'Value', 'Reorder below (yd)']]
      .concat(S.fabrics().map((f) => [f.name, f.type, f.colors, f.stock, Math.round(f.stock * 36), f.rate, Math.round(f.stock * f.rate), f.reorder]))));
    $('#moves').hidden = true;
  };

  /* ======================================================================
     Fabric purchases (by yard or inch)
     ====================================================================== */
  P.purchases = () => {
    const kp = () => {
      const open = S.purchases().filter((p) => p.status === 'ordered');
      $('#po-kpis').innerHTML = [kpi('Open orders', open.length, money(sum(open, S.poTotal)), 'swap'), kpi('Fabric on order', S.fmtYd(sum(open, S.poYards)), S.fmtIn(sum(open, S.poYards)), 'package'), kpi('Spent on fabric (30 days)', money(sum(S.purchases().filter((p) => S.within(p.date, ...S.range('30'))), S.poTotal)), 'All purchases', 'coins')].join('');
    };

    const detail = (id, api) => {
      const po = S.purchases().find((p) => p.id === id); if (!po) return;
      const m = A.modal({
        title: `${po.id} · ${A.date(po.date)}`, wide: true,
        body: `<div class="row gap-16 wrap" style="margin-bottom:12px"><span class="badge ${po.status === 'received' ? 'b-ok' : 'b-info'}">${po.status === 'received' ? 'Received in warehouse' : 'Ordered'}</span><span class="muted small">${A.date(po.date)}</span></div>
          <div class="table-wrap"><table class="wp-table"><thead><tr><th>Fabric</th><th class="right">Quantity</th><th class="right">Rate / yd</th><th class="right">Amount</th></tr></thead><tbody>${po.items.map((i) => { const f = S.fabric(i.fabricId) || { name: i.fabricId, hex: '#999' }; return `<tr><td><div class="row gap-8">${swatch(f)}${esc(f.name)}</div></td><td class="right">${both(i.yards)}</td><td class="right num">${money(i.rate)}</td><td class="right num">${money(i.yards * i.rate)}</td></tr>`; }).join('')}</tbody></table></div>
          <div class="totals"><div><span>Fabric</span><b class="num">${money(S.poTotal(po) - (po.shipping || 0))}</b></div>${po.shipping ? `<div><span>Transport</span><b class="num">${money(po.shipping)}</b></div>` : ''}<div class="grand"><span>Total</span><b class="num">${money(S.poTotal(po))}</b></div><div><span>Paid</span><b class="num ok">${money(S.poPaid(po))}</b></div></div>
          ${(po.payments || []).length ? `<h4 class="sub-h" style="margin-top:14px">Payments</h4>${po.payments.map((p) => `<div class="draft-row"><span>${A.date(p.date)} · ${esc(S.accountName(p.account))}${p.note ? ' · ' + esc(p.note) : ''}</span><b class="num">${money(p.amount)}</b></div>`).join('')}` : ''}
          ${po.status === 'ordered' ? '<div class="row gap-8 wrap" style="margin-top:16px"><button class="btn btn-violet" data-receive>Receive fabric into warehouse</button></div>' : ''}
`
      });
      m.el.addEventListener('click', (e) => {
        if (e.target.closest('[data-receive]')) { S.receivePO(id); m.close(); api.refresh(); kp(); A.toast(`${S.fmtYd(S.poYards(po))} added to the warehouse`); return; }
      });
    };

    const create = (api, fabId) => {
      const first = S.fabric(fabId) || S.fabrics()[0];
      const lines = [{ fabricId: first.id, qty: 100, unit: 'yd', rate: first.rate }];
      const m = A.modal({
        title: 'Buy fabric', wide: true,
        body: `<div class="form-grid2"><div class="field"><label for="po-date">Date</label><input id="po-date" type="date" value="${A.ymd(Date.now())}" max="${A.ymd(Date.now())}"></div></div>
          <h4 class="sub-h" style="margin:16px 0 8px">Fabric</h4><div class="po-head xs muted"><span>Fabric</span><span>Quantity</span><span>Unit</span><span>Rate per yard (৳)</span><span class="right">Amount</span><span></span></div><div id="po-lines" class="col gap-8"></div>
          <button class="btn btn-glass btn-sm" id="po-add" type="button" style="align-self:flex-start;margin-top:8px">${icon('plus', 14)} Add fabric</button>
          <div class="form-grid2" style="margin-top:16px"><div class="field"><label for="po-ship">Transport / labour (৳)</label><input id="po-ship" type="number" min="0" value="0"><span class="hint">Added to the cost per yard when received.</span></div><div class="field"><label for="po-note">Note</label><input id="po-note" placeholder="Optional"></div></div>
          <div class="row between wrap" style="margin-top:12px"><label class="check small"><input type="checkbox" id="po-recv" checked> Received in the warehouse now</label><b class="big-n" id="po-total"></b></div>
          <div class="row gap-8 wrap" style="margin-top:10px"><span class="small">Paid:</span><input id="po-pay" type="number" min="0" value="0" style="width:140px" aria-label="Paid now"><select id="po-acc" style="width:auto" aria-label="Paid from">${Admin.accountOptions('bank')}</select></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save purchase</button>'
      });
      let payTouched = false;
      const yards = (l) => S.toYards(l.qty, l.unit);
      const total = () => { if (!payTouched) $('#po-pay', m.el).value = Math.round(sum(lines, (l) => yards(l) * l.rate) + (Number($('#po-ship', m.el).value) || 0)); $('#po-total', m.el).textContent = `${S.fmtYd(sum(lines, yards))} · ${money(sum(lines, (l) => yards(l) * l.rate) + (Number($('#po-ship', m.el).value) || 0))}`; };
      const paint = () => {
        $('#po-lines', m.el).innerHTML = lines.map((l, i) => `<div class="po-line fab" data-i="${i}"><select data-k="fabricId" aria-label="Fabric">${S.fabrics().map((f) => `<option value="${f.id}" ${f.id === l.fabricId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select><input data-k="qty" type="number" min="0" step="0.25" value="${l.qty}" aria-label="Quantity"><select data-k="unit" aria-label="Unit"><option value="yd" ${l.unit === 'yd' ? 'selected' : ''}>yard</option><option value="in" ${l.unit === 'in' ? 'selected' : ''}>inch</option></select><input data-k="rate" type="number" min="0" value="${l.rate}" aria-label="Rate per yard"><b class="num">${money(yards(l) * l.rate)}<span class="xs muted" style="display:block;font-weight:400">${S.fmtYd(yards(l))}</span></b><button class="btn btn-ghost btn-icon btn-sm" data-rm aria-label="Remove line">${icon('x', 14)}</button></div>`).join('');
        total();
      };
      paint();
      m.el.addEventListener('change', (e) => {
        const row = e.target.closest('.po-line'); if (!row) return;
        const l = lines[Number(row.dataset.i)]; const k = e.target.dataset.k;
        if (k === 'fabricId') { l.fabricId = e.target.value; l.rate = (S.fabric(l.fabricId) || {}).rate || 0; } else if (k === 'unit') l.unit = e.target.value; else l[k] = Math.max(0, Number(e.target.value) || 0);
        setTimeout(paint, 0);
      });
      m.el.addEventListener('input', (e) => { if (e.target.id === 'po-pay') payTouched = true; if (e.target.id === 'po-ship') total(); });
      m.el.addEventListener('click', (e) => {
        if (e.target.closest('#po-add')) { const f = S.fabrics()[0]; lines.push({ fabricId: f.id, qty: 50, unit: 'yd', rate: f.rate }); paint(); return; }
        const rm = e.target.closest('[data-rm]'); if (rm) { if (lines.length > 1) { lines.splice(Number(rm.closest('.po-line').dataset.i), 1); paint(); } return; }
        if (!e.target.closest('[data-save]')) return;
        if (lines.some((l) => !(yards(l) > 0) || !(l.rate > 0))) { A.toast('Every line needs a quantity and a rate', 'err'); return; }
        const id = S.nextPoId(); const pay = Number($('#po-pay', m.el).value) || 0;
        const date = new Date(($('#po-date', m.el).value || A.ymd(Date.now())) + 'T12:00:00').toISOString();
        const po = { id, n: Number(id.slice(3)), date, status: 'ordered', items: lines.map((l) => ({ fabricId: l.fabricId, yards: yards(l), rate: l.rate })), shipping: Number($('#po-ship', m.el).value) || 0, payments: pay > 0 ? [{ id: A.uid(), date, account: $('#po-acc', m.el).value, amount: pay, note: 'Paid at purchase' }] : [], note: $('#po-note', m.el).value.trim() };
        if (pay > S.poTotal(po)) { A.toast('Payment cannot be more than the total', 'err'); return; }
        const list = S.purchases(); list.unshift(po); S.savePurchases(list);
        if ($('#po-recv', m.el).checked) S.receivePO(id);
        m.close(); api.refresh(); kp(); A.toast(`${id} saved${$('#po-recv', m.el).checked ? ' · fabric added to the warehouse' : ''}`);
      });
    };

    const api = Admin.listTable({
      id: 'purchases', mount: $('#list'), perPage: 10, empty: 'No fabric purchases yet', searchPlaceholder: 'Search purchases',
      rows: () => S.purchases().slice().sort((a, b) => new Date(b.date) - new Date(a.date)), rowId: (p) => p.id,
      views: [{ id: 'all', label: 'All' }, { id: 'ordered', label: 'Ordered', filter: (p) => p.status === 'ordered' }, { id: 'received', label: 'Received', filter: (p) => p.status === 'received' }],
      filters: [{ id: 'fab', label: 'All fabrics', options: S.fabrics().map((f) => [f.id, f.name]), test: (p, v) => p.items.some((i) => i.fabricId === v) }],
      search: (p, q) => (p.id + ' ' + p.items.map((i) => S.fabricName(i.fabricId)).join(' ')).toLowerCase().includes(q),
      columns: [
        { id: 'id', label: 'Purchase', sort: (a, b) => a.n - b.n, render: (p) => `<a class="row-title" href="#" data-act="view" data-id="${p.id}">${p.id}</a><div class="xs muted">${A.date(p.date)}</div>${Admin.actions([{ label: 'View', act: 'view', id: p.id }, p.status === 'ordered' ? { label: 'Receive', act: 'recv', id: p.id } : null])}` },
        { id: 'fab', label: 'Fabric', render: (p) => p.items.map((i) => { const f = S.fabric(i.fabricId) || { hex: '#999', name: i.fabricId }; return `<div class="row gap-4 xs">${swatch(f)}${esc(f.name)} · ${S.fmtYd(i.yards)} @ ${money(i.rate)}</div>`; }).join('') },
        { id: 'yd', label: 'Quantity', cls: 'right', sort: (a, b) => S.poYards(a) - S.poYards(b), render: (p) => both(S.poYards(p)) },
        { id: 'total', label: 'Total', cls: 'right', sort: (a, b) => S.poTotal(a) - S.poTotal(b), render: (p) => `<b class="num">${money(S.poTotal(p))}</b>` },
        { id: 'status', label: 'Status', render: (p) => `<span class="badge ${p.status === 'received' ? 'b-ok' : 'b-info'}">${p.status === 'received' ? 'Received' : 'Ordered'}</span>` },
        { id: 'pay', label: 'Paid', cls: 'right', render: (p) => `<span class="num">${money(S.poPaid(p))}</span>${(p.payments || [])[0] ? `<div class="xs muted">from ${esc(S.accountName(p.payments[0].account))}</div>` : ''}` }
      ],
      actions: {
        view: (id, p, a) => detail(id, a),
        recv: (id, p, a) => A.confirm(`Receive ${S.fmtYd(S.poYards(p))} of fabric from ${id} into the warehouse?`, 'Receive').then((ok) => { if (ok) { S.receivePO(id); a.refresh(); kp(); A.toast('Fabric received'); } })
      }
    });
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-act]'); if (a) e.preventDefault(); });
    $('#add-po').addEventListener('click', () => create(api));
    if (A.qs.get('new')) create(api, A.qs.get('fab') || undefined);
    kp();
  };

  /* ======================================================================
     Production: fabric → finished panjabi in the showroom
     ====================================================================== */
  P.production = () => {
    const STATUS = { cutting: ['Cutting', 'b-warn'], stitching: ['Stitching', 'b-violet'], ready: ['Ready in showroom', 'b-ok'] };
    const kp = () => {
      const wip = S.inProduction();
      const monthStart = S.range('month')[0];
      const done = S.batches().filter((b) => b.status === 'ready' && new Date(b.readyAt).getTime() >= monthStart);
      const ready30 = S.batches().filter((b) => b.status === 'ready' && new Date(b.readyAt) >= new Date(Date.now() - 30 * 864e5));
      $('#pr-kpis').innerHTML = [
        kpi('In production', `${sum(wip, (b) => b.qty)} pcs`, `${wip.length} batch${wip.length === 1 ? '' : 'es'} cutting or stitching`, 'scissors'),
        kpi('Made this month', `${sum(done, (b) => b.qty)} pcs`, `${done.length} batches sent to the showroom`, 'store'),
        kpi('Fabric used (30 days)', S.fmtYd(S.fabricUsed(null, 30)), S.fmtIn(S.fabricUsed(null, 30)), 'package'),
        kpi('Average cost per piece', money(sum(ready30, S.batchCost) / Math.max(1, sum(ready30, (b) => b.qty))), 'Fabric + making + extras, last 30 days', 'coins')
      ].join('');
    };

    const designs = () => S.products().filter((p) => p.recipe && p.status === 'publish');
    const create = (api, pid) => {
      const list = designs();
      const st = { pid: Number(pid) || (list[0] || {}).id, sizes: {}, issueTouched: false };
      const m = A.modal({
        title: 'New production batch', wide: true,
        body: `<div class="form-grid2"><div class="field full"><label for="pb-p">Design</label><select id="pb-p">${S.fabrics().map((f) => { const ds = list.filter((p) => p.recipe.fabricId === f.id); return ds.length ? `<optgroup label="${esc(f.name)} · ${S.fmtYd(f.stock)} in stock">${ds.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></div></div>
          <div id="pb-body"></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Start cutting</button>'
      });
      $('#pb-p', m.el).value = st.pid;
      const paint = () => {
        const p = S.product(st.pid); const rc = p.recipe; const f = S.fabric(rc.fabricId);
        p.sizes.forEach((z) => { if (st.sizes[z] == null) st.sizes[z] = 0; });
        Object.keys(st.sizes).forEach((z) => { if (!p.sizes.includes(z)) delete st.sizes[z]; });
        $('#pb-body', m.el).innerHTML = `
          <div class="pb-recipe glass-soft"><div class="row gap-8">${swatch(f)}<div class="grow"><b>${esc(f.name)}</b><div class="xs muted">${S.fmtYd(f.stock)} (${S.fmtIn(f.stock)}) in the warehouse · ${money(f.rate)}/yd</div></div></div>
            <div class="form-grid3"><div class="field"><label for="pb-yd">Fabric per piece (yd)</label><input id="pb-yd" type="number" min="0" step="0.05" value="${rc.yards}"></div><div class="field"><label for="pb-mk">Making / tailoring per piece (৳)</label><input id="pb-mk" type="number" min="0" value="${rc.making}"></div><div class="field"><label for="pb-ex">Embroidery, buttons, packing per piece (৳)</label><input id="pb-ex" type="number" min="0" value="${rc.extras}"></div></div></div>
          <div class="field" style="margin-top:14px"><span class="label">Pieces by size</span><div class="row wrap gap-8">${p.sizes.map((z) => `<label class="os-cell"><span class="xs muted">${esc(S.sizeLabel(z))}</span><input type="number" min="0" data-z="${z}" value="${st.sizes[z] || ''}" placeholder="0" aria-label="Pieces in ${esc(z)}"></label>`).join('')}<button class="btn btn-ghost btn-sm" type="button" data-fill style="align-self:flex-end">10 each</button></div></div>
          <div class="form-grid2" style="margin-top:6px"><div class="field"><label for="pb-issue">Fabric to issue</label>${qtyBox('pb-issue', '')}<span class="hint" id="pb-need"></span></div><div class="field"><label for="pb-tailor">Tailor / karigar</label><input id="pb-tailor" list="pb-tailors" placeholder="e.g. Master Selim"><datalist id="pb-tailors">${[...new Set(S.batches().map((b) => b.tailor).filter(Boolean))].map((t) => `<option value="${esc(t)}">`).join('')}</datalist></div></div>
          <div class="pb-sum" id="pb-sum"></div>`;
        calc();
      };
      const calc = () => {
        const p = S.product(st.pid); const f = S.fabric(p.recipe.fabricId);
        const qty = sum(Object.values(st.sizes));
        const per = Number($('#pb-yd', m.el).value) || 0; const mk = Number($('#pb-mk', m.el).value) || 0; const ex = Number($('#pb-ex', m.el).value) || 0;
        const need = Math.round(qty * per * 100) / 100;
        if (!st.issueTouched) { $('#pb-issue', m.el).value = $('#pb-issue-u', m.el).value === 'in' ? Math.round(need * 36) : need; }
        const issue = readQty(m.el, 'pb-issue');
        const fabricCost = issue * f.rate; const labour = (mk + ex) * qty; const total = fabricCost + labour; const unit = qty ? total / qty : 0;
        $('#pb-need', m.el).innerHTML = `Needed: ${qty} × ${per} yd = <b>${S.fmtYd(need)}</b> (${S.fmtIn(need)}). ${issue > f.stock ? `<span class="err">Only ${S.fmtYd(f.stock)} in stock.</span>` : `Left after: ${S.fmtYd(f.stock - issue)}.`}`;
        $('#pb-sum', m.el).innerHTML = `<div><span>Pieces</span><b class="num">${qty}</b></div><div><span>Fabric cost</span><b class="num">${money(fabricCost)}</b></div><div><span>Making + extras</span><b class="num">${money(labour)}</b></div><div class="g"><span>Batch cost</span><b class="num">${money(total)}</b></div><div><span>Cost per piece</span><b class="num">${money(unit)}</b></div><div><span>Profit per piece at ${money(S.price(p))}</span><b class="num ${S.price(p) - unit >= 0 ? 'ok' : 'err'}">${money(S.price(p) - unit)}</b></div>`;
      };
      paint();
      m.el.addEventListener('change', (e) => { if (e.target.id === 'pb-p') { st.pid = Number(e.target.value); st.sizes = {}; st.issueTouched = false; paint(); } if (e.target.id === 'pb-issue-u') calc(); });
      m.el.addEventListener('input', (e) => {
        if (e.target.dataset.z) st.sizes[e.target.dataset.z] = Math.max(0, Math.round(Number(e.target.value) || 0));
        if (e.target.id === 'pb-issue') st.issueTouched = true;
        if (e.target.closest('#pb-body')) calc();
      });
      m.el.addEventListener('click', (e) => {
        if (e.target.closest('[data-fill]')) { Object.keys(st.sizes).forEach((z) => { st.sizes[z] = 10; }); $$('[data-z]', m.el).forEach((i) => { i.value = 10; }); calc(); return; }
        if (!e.target.closest('[data-save]')) return;
        const sizes = Object.fromEntries(Object.entries(st.sizes).filter(([, n]) => n > 0));
        const res = S.startBatch({ productId: st.pid, sizes, yards: readQty(m.el, 'pb-issue'), making: $('#pb-mk', m.el).value, extras: $('#pb-ex', m.el).value, tailor: $('#pb-tailor', m.el).value.trim() });
        if (!res.ok) { A.toast(res.error, 'err'); return; }
        m.close(); api.refresh(); kp(); designsPaint(); A.toast(`${res.batch.id} started · ${S.fmtYd(res.batch.yards)} issued from the warehouse`);
      });
    };
    const finish = (id, api) => {
      const b = S.batch(id); const p = S.product(b.productId) || { name: '#' + b.productId };
      const m = A.modal({
        title: `Ready for the showroom · ${b.id}`,
        body: `<p class="small muted">${esc(p.name)}. Enter the pieces that passed quality check; they go into showroom stock.</p>
          <div class="row wrap gap-8" style="margin:12px 0">${Object.entries(b.sizes).map(([z, n]) => `<label class="os-cell"><span class="xs muted">${esc(S.sizeLabel(z))}</span><input type="number" min="0" data-z="${z}" value="${n}" aria-label="Pieces in ${esc(z)}"></label>`).join('')}</div>
          <div class="form-grid2"><div class="field"><label for="fb-acc">Pay making cost from</label><select id="fb-acc">${Admin.accountOptions((b.making + b.extras) * b.qty > 6000 ? 'bank' : 'cash')}</select></div><div class="field"><span class="label">Making + extras to pay</span><b class="big-n" id="fb-pay"></b></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Send to showroom</button>'
      });
      const sizes = () => Object.fromEntries($$('[data-z]', m.el).map((i) => [i.dataset.z, Math.max(0, Math.round(Number(i.value) || 0))]));
      const upd = () => { $('#fb-pay', m.el).textContent = money((b.making + b.extras) * sum(Object.values(sizes()))); };
      upd(); m.el.addEventListener('input', upd);
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        S.finishBatch(id, { sizes: sizes(), account: $('#fb-acc', m.el).value });
        m.close(); api.refresh(); kp(); designsPaint(); A.toast(`${sum(Object.values(sizes()))} pieces of ${p.name} added to showroom stock`);
      });
    };
    const view = (id) => {
      const b = S.batch(id); const p = S.product(b.productId) || { name: '#' + b.productId }; const f = S.fabric(b.fabricId) || { name: b.fabricId, hex: '#999' };
      Admin.printModal(`${b.id} · ${p.name}`, `<div class="pb-view"><div class="row between wrap"><span class="badge ${STATUS[b.status][1]}">${STATUS[b.status][0]}</span><span class="small muted">Started ${A.date(b.date)}${b.readyAt ? ` · ready ${A.date(b.readyAt)}` : ''}${b.tailor ? ` · ${esc(b.tailor)}` : ''}</span></div>
        <table class="mini-table" style="min-width:0;margin-top:12px"><tbody>
          <tr><td>Fabric</td><td class="right">${esc(f.name)}: ${S.fmtYd(b.yards)} (${S.fmtIn(b.yards)}) × ${money(b.rate)}/yd</td></tr>
          <tr><td>Pieces</td><td class="right">${b.qty} (${Object.entries(b.sizes).map(([z, n]) => `${z} ${n}`).join(', ')})</td></tr>
          <tr><td>Fabric cost</td><td class="right num">${money(b.yards * b.rate)}</td></tr>
          <tr><td>Making + extras</td><td class="right num">${money((b.making + b.extras) * b.qty)} (${money(b.making)} + ${money(b.extras)} per piece)</td></tr>
          <tr><td><b>Batch cost</b></td><td class="right num"><b>${money(S.batchCost(b))}</b></td></tr>
          <tr><td><b>Cost per piece</b></td><td class="right num"><b>${money(S.batchUnitCost(b))}</b></td></tr>
          <tr><td>Fabric per piece (actual)</td><td class="right">${S.fmtYd(b.yards / b.qty)}</td></tr></tbody></table></div>`, false);
    };

    const api = Admin.listTable({
      id: 'batches', mount: $('#list'), perPage: 10, empty: 'No production batches yet', searchPlaceholder: 'Search batches',
      rows: () => S.batches(), rowId: (b) => b.id,
      views: [{ id: 'all', label: 'All' }, { id: 'wip', label: 'In production', filter: (b) => b.status !== 'ready' }, { id: 'ready', label: 'Ready', filter: (b) => b.status === 'ready' }],
      filters: [{ id: 'fab', label: 'All fabrics', options: S.fabrics().map((f) => [f.id, f.name]), test: (b, v) => b.fabricId === v }],
      search: (b, q) => (b.id + ' ' + (S.product(b.productId) || {}).name + ' ' + b.tailor).toLowerCase().includes(q),
      columns: [
        { id: 'id', label: 'Batch', sort: (a, b) => a.n - b.n, render: (b) => `<b class="row-title">${b.id}</b><div class="xs muted">${A.date(b.date)}${b.tailor ? ' · ' + esc(b.tailor) : ''}</div>${Admin.actions([{ label: 'View', act: 'view', id: b.id }, b.status === 'cutting' ? { label: 'Start stitching', act: 'next', id: b.id } : null, b.status !== 'ready' ? { label: 'Mark ready', act: 'done', id: b.id } : null, b.status !== 'ready' ? { label: 'Cancel', act: 'cancel', id: b.id, danger: true } : null])}` },
        { id: 'p', label: 'Design', render: (b) => { const p = S.product(b.productId); return p ? `<div class="row gap-8">${Admin.thumb(p, 'sm')}<a class="small row-title" href="product-edit.html?id=${p.id}">${esc(p.name)}</a></div>` : '—'; } },
        { id: 'fab', label: 'Fabric issued', render: (b) => { const f = S.fabric(b.fabricId) || { name: b.fabricId, hex: '#999' }; return `<div class="row gap-8">${swatch(f)}<div><span class="small">${esc(f.name)}</span><div class="xs muted num">${S.fmtYd(b.yards)} · ${S.fmtIn(b.yards)}</div></div></div>`; } },
        { id: 'qty', label: 'Pieces', render: (b) => `<b class="num">${b.qty}</b><div class="size-mini">${Object.entries(b.sizes).map(([z, n]) => `<span>${esc(z)}<b>${n}</b></span>`).join('')}</div>` },
        { id: 'unit', label: 'Cost / pc', cls: 'right', sort: (a, b) => S.batchUnitCost(a) - S.batchUnitCost(b), render: (b) => `<span class="num">${money(S.batchUnitCost(b))}</span>` },
        { id: 'cost', label: 'Batch cost', cls: 'right', sort: (a, b) => S.batchCost(a) - S.batchCost(b), render: (b) => `<b class="num">${money(S.batchCost(b))}</b>` },
        { id: 'status', label: 'Status', render: (b) => `<span class="badge ${STATUS[b.status][1]}">${STATUS[b.status][0]}</span>${b.readyAt ? `<div class="xs muted">${A.date(b.readyAt)}</div>` : ''}` }
      ],
      actions: {
        view: (id) => view(id),
        next: (id, b, a) => { S.advanceBatch(id); a.refresh(); A.toast(`${id} is being stitched`); },
        done: (id, b, a) => finish(id, a),
        cancel: (id, b, a) => A.confirm(`Cancel ${id}? ${S.fmtYd(b.yards)} of ${S.fabricName(b.fabricId)} goes back to the warehouse.`, 'Cancel batch').then((ok) => { if (ok) { S.cancelBatch(id); a.refresh(); kp(); designsPaint(); A.toast('Batch cancelled, fabric returned'); } })
      }
    });

    /* designs & costing, grouped by the cloth they are cut from */
    const designsPaint = () => {
      const groups = S.fabrics().map((f) => ({ f, ds: S.designsFor(f.id) })).filter((g) => g.ds.length);
      const none = S.products().filter((p) => !p.recipe);
      $('#designs').innerHTML = groups.map(({ f, ds }) => `<section class="card fab-group"><div class="fab-group-h">${swatch(f)}<div class="grow"><b>${esc(f.name)}</b><div class="xs muted">${esc(f.colors || '')}</div></div><div class="right"><b class="num">${S.fmtYd(f.stock)}</b><div class="xs muted num">${S.fmtIn(f.stock)} · ${money(f.rate)}/yd</div></div><a class="btn btn-glass btn-sm" href="purchases.html?new=1&fab=${f.id}">Buy</a></div>
        <div class="table-wrap"><table class="mini-table"><thead><tr><th>Design</th><th class="right">Fabric / pc</th><th class="right">Fabric cost</th><th class="right">Making + extras</th><th class="right">Cost / pc</th><th class="right">Price</th><th class="right">Profit / pc</th><th class="right">Can make</th><th></th></tr></thead><tbody>${ds.map((p) => {
    const rc = p.recipe; const cost = S.recipeCostLive(rc); const price = S.price(p); const profit = price - cost;
    return `<tr><td><div class="row gap-8">${Admin.thumb(p, 'xs')}<a class="small row-title" href="product-edit.html?id=${p.id}">${esc(p.name)}</a></div></td><td class="right num">${rc.yards} yd<div class="xs muted">${Math.round(rc.yards * 36)} in</div></td><td class="right num">${money(rc.yards * f.rate)}</td><td class="right num">${money(rc.making + rc.extras)}</td><td class="right num"><b>${money(cost)}</b></td><td class="right num">${money(price)}</td><td class="right num ${profit >= 0 ? 'ok' : 'err'}">${money(profit)}<div class="xs muted">${price ? Math.round((profit / price) * 100) : 0}%</div></td><td class="right"><b class="num">${S.canMake(p)}</b> pcs</td><td class="right"><button class="btn btn-glass btn-sm" data-make="${p.id}">Make</button></td></tr>`;
  }).join('')}</tbody></table></div></section>`).join('') + (none.length ? `<section class="card"><b class="small">No recipe yet</b><p class="xs muted">Add the fabric and making cost in the product editor (Inventory tab) to cost these designs: ${none.map((p) => `<a class="u" href="product-edit.html?id=${p.id}">${esc(p.name)}</a>`).join(', ')}.</p></section>` : '');
    };
    designsPaint();
    $('#designs').addEventListener('click', (e) => { const b = e.target.closest('[data-make]'); if (b) create(api, b.dataset.make); });
    tabs($('#pr-tabs'), { batches: $('#list'), designs: $('#designs') });
    $('#designs').hidden = true;
    $('#add-batch').addEventListener('click', () => create(api));
    if (A.qs.get('new')) create(api, A.qs.get('p'));
    kp();
  };

  /* ======================================================================
     New order from Facebook / WhatsApp / Instagram / phone
     ====================================================================== */
  P['order-new'] = () => {
    const prods = S.published();
    const st = { source: A.qs.get('src') || 'facebook', lines: [{ pid: prods[0].id, size: '', qty: 1, price: S.price(prods[0]) }], chargeDelivery: true, delivery: settings.shipping.dhaka, deliveryTouched: false, courier: 'pathao', book: true };
    const root = $('#on');
    root.innerHTML = `<div class="on-layout"><div class="col gap-16">
        <section class="card"><h3 class="sub-h">Where did the order come from?</h3><div class="chips" id="on-src">${Object.entries(S.SOURCES).map(([k, l]) => `<button type="button" class="chip" data-src="${k}">${icon(k === 'facebook' ? 'facebook' : k === 'whatsapp' ? 'whatsapp' : k === 'phone' ? 'phone' : 'message', 15)} ${l}</button>`).join('')}</div>
          <div class="field" style="margin-top:12px"><label for="on-ref">Message / profile link (optional)</label><input id="on-ref" placeholder="e.g. facebook.com/messages/… or customer's WhatsApp name"></div></section>
        <section class="card"><h3 class="sub-h">Customer</h3><div class="form-grid2">
          <div class="field"><label for="on-phone">Mobile number *</label><input id="on-phone" type="tel" placeholder="01XXXXXXXXX" autocomplete="off"><span class="msg">Enter a valid mobile number.</span><span class="hint" id="on-known"></span></div>
          <div class="field"><label for="on-name">Name *</label><input id="on-name"><span class="msg">Enter the customer's name.</span></div>
          <div class="field"><label for="on-district">District</label><select id="on-district">${S.districts.map((d) => `<option ${d === 'Dhaka' ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label for="on-addr">Address *</label><input id="on-addr" placeholder="House, road, area, thana"><span class="msg">Enter the delivery address.</span></div></div></section>
        <section class="card"><h3 class="sub-h">Panjabi</h3><div id="on-lines" class="col gap-8"></div><button class="btn btn-glass btn-sm" id="on-add" type="button" style="align-self:flex-start;margin-top:8px">${icon('plus', 14)} Add another</button></section>
        <section class="card"><h3 class="sub-h">Delivery &amp; payment</h3>
          <div class="options two"><label class="opt"><input type="radio" name="dc" value="charge" checked><span><b>Customer pays delivery</b><span class="xs muted" id="on-dc-hint"></span></span></label><label class="opt"><input type="radio" name="dc" value="free"><span><b>Free delivery</b><span class="xs muted">You pay the courier</span></span></label></div>
          <div class="form-grid2" style="margin-top:12px"><div class="field"><label for="on-dc">Delivery charge (৳)</label><input id="on-dc" type="number" min="0"></div><div class="field"><label for="on-disc">Discount (৳)</label><input id="on-disc" type="number" min="0" value="0"></div>
          <div class="field"><label for="on-adv">Advance received (৳)</label><input id="on-adv" type="number" min="0" value="0"><span class="hint">Often the delivery charge by bKash, to confirm the order.</span></div><div class="field"><label for="on-advm">Advance by</label><select id="on-advm"><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="cash">Cash</option></select></div></div>
          <div class="form-grid2" style="margin-top:4px"><div class="field"><label for="on-courier">Courier</label><select id="on-courier">${S.couriers().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="own">Own delivery (rider)</option><option value="pickup">Customer picks up at showroom</option></select></div>
          <div class="field"><label for="on-trk">Tracking / consignment ID</label><input id="on-trk" placeholder="Leave empty to book later"><label class="check small" style="margin-top:8px"><input type="checkbox" id="on-book" checked> Handed to the courier now</label></div></div>
          <div class="field"><label for="on-note">Note for the order</label><input id="on-note" placeholder="e.g. Call before delivery"></div></section>
      </div>
      <aside class="card on-sum" id="on-sum" aria-live="polite"></aside></div>`;

    const linesPaint = () => {
      $('#on-lines').innerHTML = st.lines.map((l, i) => {
        const p = S.product(l.pid);
        if (!l.size || !p.sizes.includes(l.size)) l.size = p.sizes.find((z) => S.stock(p.id, S.onlineLoc(), z) > 0) || p.sizes[0];
        const avail = S.stock(p.id, S.onlineLoc(), l.size);
        return `<div class="on-line" data-i="${i}"><span class="thumb sm">${S.thumb(p)}</span><select data-k="pid" aria-label="Design">${prods.map((x) => `<option value="${x.id}" ${x.id === l.pid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          <select data-k="size" aria-label="Size">${p.sizes.map((z) => `<option value="${z}" ${z === l.size ? 'selected' : ''}>${esc(z)} (${S.stock(p.id, S.onlineLoc(), z)})</option>`).join('')}</select>
          <input data-k="qty" type="number" min="1" value="${l.qty}" aria-label="Quantity"><input data-k="price" type="number" min="0" value="${l.price}" aria-label="Price each">
          <b class="num">${money(l.qty * l.price)}</b><button class="btn btn-ghost btn-icon btn-sm" data-rm aria-label="Remove">${icon('x', 14)}</button>
          ${l.qty > avail ? `<span class="xs err on-warn">Only ${avail} in stock in ${esc(l.size)}</span>` : ''}</div>`;
      }).join('');
      sumPaint();
    };
    const totals = () => {
      const subtotal = sum(st.lines, (l) => l.qty * l.price);
      const discount = Math.min(subtotal, Math.max(0, Number($('#on-disc').value) || 0));
      const delivery = st.chargeDelivery ? Math.max(0, Number($('#on-dc').value) || 0) : 0;
      const base = subtotal - discount;
      const vat = settings.vatRate > 0 ? Math.round(base * settings.vatRate / 100) : 0;
      const total = base + vat + delivery;
      const advance = Math.min(total, Math.max(0, Number($('#on-adv').value) || 0));
      const cod = total - advance;
      const courier = $('#on-courier').value; const c = settings.couriers[courier];
      const fee = c ? S.courierFee(courier, $('#on-district').value) + Math.round(cod * c.codPct / 100) : 0;
      return { subtotal, discount, delivery, vat, total, advance, cod, courier, fee, cost: sum(st.lines, (l) => l.qty * ((S.product(l.pid) || {}).cost || 0)) };
    };
    const sumPaint = () => {
      const t = totals();
      $('#on-dc-hint').textContent = `Inside Dhaka ${money(settings.shipping.dhaka)} · outside ${money(settings.shipping.outside)}`;
      $('#on-sum').innerHTML = `<h3 class="sub-h">Order summary</h3><div class="pc-sum">
          <div><span>Panjabi (${sum(st.lines, (l) => l.qty)} pcs)</span><b class="num">${money(t.subtotal)}</b></div>${t.discount ? `<div><span>Discount</span><b class="num ok">− ${money(t.discount)}</b></div>` : ''}${t.vat ? `<div><span>VAT</span><b class="num">${money(t.vat)}</b></div>` : ''}
          <div><span>Delivery charge</span><b class="num">${t.delivery ? money(t.delivery) : 'Free'}</b></div><div class="g"><span>Total</span><b class="num">${money(t.total)}</b></div>
          ${t.advance ? `<div><span>Advance received</span><b class="num ok">− ${money(t.advance)}</b></div>` : ''}<div class="g"><span>${t.courier === 'pickup' ? 'To pay at pickup' : 'Courier collects (COD)'}</span><b class="num">${money(t.cod)}</b></div></div>
        <div class="on-econ glass-soft"><div><span>Courier will charge you</span><b class="num">${money(t.fee)}</b></div><div><span>Delivery ${t.delivery - t.fee >= 0 ? 'profit' : 'cost to you'}</span><b class="num ${t.delivery - t.fee >= 0 ? 'ok' : 'err'}">${money(t.delivery - t.fee)}</b></div><div><span>Profit on this order</span><b class="num ${t.subtotal - t.discount - t.cost + t.delivery - t.fee >= 0 ? 'ok' : 'err'}">${money(t.subtotal - t.discount - t.cost + t.delivery - t.fee)}</b></div></div>
        <button class="btn btn-violet btn-lg btn-block" id="on-save" type="button">${icon('check', 18)} Save order</button><p class="xs muted">Stock leaves the showroom now. The cash shows in the courier's merchant balance once the parcel is delivered.</p>`;
    };
    const setDeliveryDefault = () => { if (!st.deliveryTouched) $('#on-dc').value = $('#on-district').value === 'Dhaka' ? settings.shipping.dhaka : settings.shipping.outside; };
    const srcPaint = () => $$('#on-src [data-src]').forEach((b) => b.classList.toggle('active', b.dataset.src === st.source));
    setDeliveryDefault(); srcPaint(); linesPaint();

    root.addEventListener('click', (e) => {
      const s = e.target.closest('[data-src]'); if (s) { st.source = s.dataset.src; srcPaint(); return; }
      if (e.target.closest('#on-add')) { const p = prods[0]; st.lines.push({ pid: p.id, size: '', qty: 1, price: S.price(p) }); linesPaint(); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { if (st.lines.length > 1) { st.lines.splice(Number(rm.closest('.on-line').dataset.i), 1); linesPaint(); } return; }
      if (e.target.closest('#on-save')) save();
    });
    root.addEventListener('change', (e) => {
      const row = e.target.closest('.on-line');
      if (row) { const l = st.lines[Number(row.dataset.i)]; const k = e.target.dataset.k; if (k === 'pid') { l.pid = Number(e.target.value); l.size = ''; l.price = S.price(S.product(l.pid)); } else if (k === 'size') l.size = e.target.value; else l[k] = Math.max(k === 'qty' ? 1 : 0, Math.round(Number(e.target.value) || 0)); setTimeout(linesPaint, 0); return; }
      if (e.target.name === 'dc') { st.chargeDelivery = e.target.value === 'charge'; $('#on-dc').disabled = !st.chargeDelivery; }
      if (e.target.id === 'on-district') setDeliveryDefault();
      if (e.target.id === 'on-courier') { $('#on-book').closest('label').hidden = e.target.value === 'pickup'; }
      sumPaint();
    });
    root.addEventListener('input', (e) => { if (e.target.id === 'on-dc') st.deliveryTouched = true; if (['on-dc', 'on-disc', 'on-adv'].includes(e.target.id)) sumPaint(); });
    $('#on-phone').addEventListener('change', () => {
      const d = (x) => String(x).replace(/\D/g, '').slice(-10);
      const raw = $('#on-phone').value; const c = raw && S.customers().find((x) => d(x.phone) === d(raw));
      $('#on-known').textContent = c ? `Returning customer · ${c.orders} orders · ${money(c.spent)} spent${S.dueOf(c.phone) ? ` · owes ${money(S.dueOf(c.phone))}` : ''}` : '';
      if (c) { $('#on-name').value = $('#on-name').value || c.name; if (c.district) $('#on-district').value = c.district; $('#on-addr').value = $('#on-addr').value || c.address || ''; setDeliveryDefault(); sumPaint(); }
    });

    function save() {
      const phone = $('#on-phone').value.replace(/[\s-]/g, '');
      const bad = { 'on-phone': !/^(?:\+?88)?01[3-9]\d{8}$/.test(phone), 'on-name': !$('#on-name').value.trim(), 'on-addr': !$('#on-addr').value.trim() };
      Object.entries(bad).forEach(([id, b]) => $('#' + id).closest('.field').classList.toggle('err', b));
      const firstBad = Object.keys(bad).find((k) => bad[k]);
      if (firstBad) { $('#' + firstBad).focus(); A.toast('Please fix the highlighted fields', 'err'); return; }
      const short = st.lines.find((l) => S.stock(l.pid, S.onlineLoc(), l.size) < l.qty);
      if (short) { A.toast(`${S.product(short.pid).name} (${short.size}) does not have enough stock`, 'err'); return; }
      const t = totals();
      const payments = [];
      if (t.advance > 0) payments.push({ method: $('#on-advm').value, amount: t.advance });
      if (t.cod > 0) payments.push({ method: 'cod', amount: t.cod });
      if (!payments.length) payments.push({ method: 'cod', amount: 0 });
      const booked = t.courier !== 'pickup' && $('#on-book').checked;
      const ship = { courier: t.courier, status: booked ? 'transit' : 'pending', fee: booked ? S.courierFee(t.courier, $('#on-district').value) : 0, codFee: 0, cod: t.cod, collected: 0, tracking: $('#on-trk').value.trim(), bookedAt: booked ? new Date().toISOString() : '' };
      if (booked && !ship.tracking) ship.tracking = (t.courier === 'pathao' ? 'PTH' : t.courier === 'steadfast' ? 'SFC' : 'OWN') + String(Date.now()).slice(-6);
      if (!booked && t.courier !== 'pickup') ship.courier = '';
      const order = S.addOrder({
        channel: 'social', source: st.source, status: booked ? 'shipped' : 'processing',
        customer: { name: $('#on-name').value.trim(), phone, email: '', district: $('#on-district').value, address: $('#on-addr').value.trim() },
        items: st.lines.map((l) => { const p = S.product(l.pid); return { pid: p.id, name: p.name, price: l.price, cost: p.cost, qty: l.qty, size: l.size, color: p.colorName, hex: p.color, style: p.style }; }),
        subtotal: t.subtotal, shipping: t.delivery, discount: t.discount, coupon: '', vat: t.vat, total: t.total,
        payment: payments[0].method, payments, payRef: $('#on-ref').value.trim(), note: $('#on-note').value.trim(), pickup: t.courier === 'pickup' ? S.onlineLoc() : '',
        ship: t.courier === 'pickup' ? { courier: 'pickup', status: 'pending', fee: 0, codFee: 0, cod: t.cod, collected: 0 } : ship,
        notes: [{ text: `Order taken on ${S.SOURCES[st.source]}${t.delivery ? '' : ' · free delivery'}.`, date: new Date().toISOString(), by: 'Amnu Admin' }]
      });
      A.toast(`Order #${order.id} saved`);
      setTimeout(() => { location.href = 'order-view.html?id=' + order.id; }, 400);
    }
  };

  /* ======================================================================
     Couriers & COD (Pathao, Steadfast, own rider)
     ====================================================================== */
  P.couriers = () => {
    const PST = { pending: ['To book', 'b-warn'], transit: ['In transit', 'b-violet'], delivered: ['Delivered', 'b-ok'], returned: ['Returned', 'b-err'] };
    const r30 = () => S.range('30');
    const live = (o) => S.isLive(o) || o.status === 'returned';
    const kp = () => {
      const ps = S.parcels().filter(live);
      const toBook = ps.filter((o) => o.ship.status === 'pending' && o.ship.courier !== 'pickup');
      const transit = ps.filter((o) => o.ship.status === 'transit');
      const bal = S.balances(); const waiting = sum(S.couriers(), (c) => Math.max(0, bal[c.id] || 0));
      const costs = S.courierCosts(...r30());
      $('#cr-kpis').innerHTML = [
        kpi('To book', `${toBook.length} parcels`, `${money(sum(toBook, (o) => o.ship.cod))} to collect`, 'package'),
        kpi('With couriers', `${transit.length} parcels`, `${money(sum(transit, (o) => o.ship.cod))} cash on delivery in transit`, 'truck'),
        kpi('Waiting in merchant accounts', money(waiting), 'Delivered cash you can withdraw', 'wallet'),
        kpi('Courier charges (30 days)', money(costs.total), `${costs.delivered} delivered · ${costs.returned} returned`, 'receipt')
      ].join('');
      $('#cr-cards').innerHTML = S.couriers().map((c) => {
        const s = S.courierStats(c.id, ...r30()); const last = S.payouts().find((p) => p.courier === c.id);
        return `<article class="card cr-card"><div class="row between"><div class="row gap-8"><span class="cr-logo cr-${c.id}">${esc(c.name.slice(0, 1))}</span><div><b>${esc(c.name)}</b><div class="xs muted">${money(c.inside)} inside Dhaka · ${money(c.outside)} outside · COD ${c.codPct}%</div></div></div><button class="btn btn-violet btn-sm" data-withdraw="${c.id}" ${s.balance > 0 ? '' : 'disabled'}>Withdraw</button></div>
          <div class="cr-bal"><span class="kpi-label">Balance to withdraw</span><b class="num ${s.balance < 0 ? 'err' : ''}">${money(s.balance)}</b>${last ? `<span class="xs muted">Last payout ${money(last.amount)} · ${A.ago(last.date)}</span>` : ''}</div>
          <div class="cr-stats"><div><span class="xs muted">In transit</span><b class="num">${s.transit}</b><span class="xs muted">${money(s.transitCod)}</span></div><div><span class="xs muted">Delivered (30d)</span><b class="num">${s.delivered}</b><span class="xs muted">${money(s.collected)}</span></div><div><span class="xs muted">Returned</span><b class="num ${s.returnRate > 10 ? 'err' : ''}">${s.returned}</b><span class="xs muted">${s.returnRate.toFixed(1)}%</span></div><div><span class="xs muted">Charges</span><b class="num">${money(s.fees)}</b><span class="xs muted">30 days</span></div></div></article>`;
      }).join('');
    };

    const book = (ids, courier, api) => {
      const one = ids.length === 1 ? S.order(ids[0]) : null;
      const m = A.modal({
        title: one ? `Book parcel · #${one.id}` : `Book ${ids.length} parcels`,
        body: `<div class="form-grid2"><div class="field"><label for="bk-c">Courier</label><select id="bk-c">${S.couriers().map((c) => `<option value="${c.id}" ${c.id === courier ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="own">Own delivery (rider)</option></select></div>
          ${one ? `<div class="field"><label for="bk-t">Tracking / consignment ID</label><input id="bk-t" placeholder="Auto if empty"></div>` : ''}</div>
          ${one ? `<p class="small muted">${esc(one.customer.name)} · ${esc(one.customer.district)} · courier collects <b>${money(S.codOf(one))}</b></p>` : ''}`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Book</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        ids.forEach((id) => S.bookParcel(id, $('#bk-c', m.el).value, one ? $('#bk-t', m.el).value.trim() : ''));
        m.close(); api.refresh(); kp(); A.toast(`${ids.length} parcel${ids.length === 1 ? '' : 's'} booked with ${S.courierName($('#bk-c', m.el).value)}`);
      });
    };
    const deliver = (id, api) => {
      const o = S.order(id);
      const m = A.modal({
        title: `Delivered · #${o.id}`,
        body: `<p class="small muted">${esc(S.courierName(o.ship.courier))}${o.ship.tracking ? ' · ' + esc(o.ship.tracking) : ''} · ${esc(o.customer.name)}</p><div class="field" style="margin-top:10px"><label for="dl-a">Cash collected from the customer (৳)</label><input id="dl-a" type="number" min="0" value="${S.codOf(o)}"><span class="hint">${S.isMerchant(o.ship.courier) ? 'Goes into the courier merchant balance, minus their charges.' : 'Goes into Cash in hand.'}</span></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Mark delivered</button>'
      });
      m.el.addEventListener('click', (e) => { if (!e.target.closest('[data-save]')) return; S.deliverParcel(id, Math.max(0, Number($('#dl-a', m.el).value) || 0)); m.close(); api.refresh(); kp(); A.toast(`#${id} delivered`); });
    };
    const withdraw = (cid) => {
      const bal = S.balances();
      const m = A.modal({
        title: 'Withdraw from courier',
        body: `<div class="form-grid2"><div class="field"><label for="wd-c">From</label><select id="wd-c">${S.couriers().map((c) => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)} · ${money(bal[c.id] || 0)}</option>`).join('')}</select></div><div class="field"><label for="wd-a">Amount (৳)</label><input id="wd-a" type="number" min="1"></div>
          <div class="field"><label for="wd-to">Into</label><select id="wd-to">${S.accounts().filter((a) => a.type !== 'courier').map((a) => `<option value="${a.id}" ${a.id === 'bank' ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label for="wd-r">Reference</label><input id="wd-r" placeholder="Payout / invoice number"></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Record withdrawal</button>'
      });
      const fill = () => { $('#wd-a', m.el).value = Math.max(0, S.balances()[$('#wd-c', m.el).value] || 0); };
      fill(); m.el.addEventListener('change', (e) => { if (e.target.id === 'wd-c') fill(); });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const c = $('#wd-c', m.el).value; const amount = Math.round(Number($('#wd-a', m.el).value) || 0); const avail = S.balances()[c] || 0;
        if (!(amount > 0) || amount > avail) { A.toast(`Enter an amount up to ${money(avail)}`, 'err'); return; }
        S.addPayout({ courier: c, amount, account: $('#wd-to', m.el).value, ref: $('#wd-r', m.el).value.trim() });
        m.close(); kp(); payouts.refresh(); A.toast(`${money(amount)} withdrawn from ${S.courierName(c)}`);
      });
    };

    const api = Admin.listTable({
      id: 'parcels', mount: $('#list'), perPage: 12, empty: 'No parcels here', searchPlaceholder: 'Search order, customer, tracking',
      rows: () => S.parcels().filter(live).sort((a, b) => new Date(b.date) - new Date(a.date)), rowId: (o) => o.id,
      initialView: A.qs.get('view') || 'book',
      views: [
        { id: 'book', label: 'To book', filter: (o) => o.ship.status === 'pending' && o.ship.courier !== 'pickup' },
        { id: 'transit', label: 'In transit', filter: (o) => o.ship.status === 'transit' },
        { id: 'pickup', label: 'Showroom pickup', filter: (o) => o.ship.courier === 'pickup' && o.ship.status === 'pending' },
        { id: 'delivered', label: 'Delivered', filter: (o) => o.ship.status === 'delivered' },
        { id: 'returned', label: 'Returned', filter: (o) => o.ship.status === 'returned' },
        { id: 'all', label: 'All' }
      ],
      filters: [{ id: 'courier', label: 'All couriers', options: S.couriers().map((c) => [c.id, c.name]).concat([['own', 'Own delivery']]), test: (o, v) => o.ship.courier === v }, { id: 'ch', label: 'All channels', options: [['online', 'Website'], ['social', 'Social media']], test: (o, v) => S.channelOf(o) === v }],
      search: (o, q) => ('#' + o.id + ' ' + o.customer.name + ' ' + o.customer.phone + ' ' + (o.ship.tracking || '')).toLowerCase().includes(q),
      bulk: S.couriers().map((c) => ({ id: 'book-' + c.id, label: `Book with ${c.name}`, run: (ids) => { ids.forEach((id) => { const o = S.order(id); if (o && o.ship.status === 'pending') S.bookParcel(id, c.id); }); kp(); A.toast(`Booked with ${c.name}`); } }))
        .concat([{ id: 'deliver', label: 'Mark delivered (full COD)', confirm: 'Mark the selected parcels delivered with full cash collected?', run: (ids) => { ids.forEach((id) => { const o = S.order(id); if (o && o.ship.status === 'transit') S.deliverParcel(id); }); kp(); A.toast('Parcels marked delivered'); } }]),
      columns: [
        { id: 'order', label: 'Order', sort: (a, b) => a.id - b.id, render: (o) => `<a class="row-title" href="order-view.html?id=${o.id}">#${o.id}</a><div class="xs muted">${A.date(o.date)}</div>${Admin.actions([o.ship.status === 'pending' && o.ship.courier !== 'pickup' ? { label: 'Book', act: 'book', id: o.id } : null, o.ship.status === 'transit' || (o.ship.courier === 'pickup' && o.ship.status === 'pending') ? { label: o.ship.courier === 'pickup' ? 'Picked up' : 'Delivered', act: 'deliver', id: o.id } : null, o.ship.status === 'transit' ? { label: 'Returned', act: 'ret', id: o.id, danger: true } : null])}` },
        { id: 'cust', label: 'Customer', render: (o) => `${esc(o.customer.name)}<div class="xs muted">${esc(o.customer.phone)} · ${esc(o.customer.district)}</div>` },
        { id: 'ch', label: 'Channel', render: (o) => Admin.channelBadge(o) },
        { id: 'courier', label: 'Courier', render: (o) => `${esc(S.courierName(o.ship.courier))}${o.ship.tracking ? `<div class="xs muted mono">${esc(o.ship.tracking)}</div>` : ''}` },
        { id: 'cod', label: 'COD', cls: 'right', sort: (a, b) => a.ship.cod - b.ship.cod, render: (o) => `<b class="num">${money(o.ship.cod)}</b>${o.ship.status === 'delivered' && o.ship.collected !== o.ship.cod ? `<div class="xs warn">collected ${money(o.ship.collected)}</div>` : ''}` },
        { id: 'dc', label: 'Delivery: charged / courier fee', cls: 'right', render: (o) => { const fee = (o.ship.fee || 0) + (o.ship.codFee || 0) + (o.ship.returnFee || 0); return `<span class="num">${o.shipping ? money(o.shipping) : '<span class="muted">Free</span>'} / ${fee ? money(fee) : '—'}</span>`; } },
        { id: 'status', label: 'Status', render: (o) => { const p = o.ship.courier === 'pickup' && o.ship.status === 'pending' ? ['Awaiting pickup', 'b-info'] : PST[o.ship.status]; return `<span class="badge ${p[1]}">${p[0]}</span>${o.ship.doneAt ? `<div class="xs muted">${A.date(o.ship.doneAt)}</div>` : o.ship.bookedAt ? `<div class="xs muted">since ${A.date(o.ship.bookedAt)}</div>` : ''}`; } }
      ],
      actions: {
        book: (id, o, a) => book([id], 'pathao', a),
        deliver: (id, o, a) => deliver(id, a),
        ret: (id, o, a) => A.confirm(`Parcel #${id} came back? The pieces return to stock and ${S.courierName(o.ship.courier)} charges the return fee.`, 'Mark returned').then((ok) => { if (ok) { S.returnParcel(id); a.refresh(); kp(); A.toast(`#${id} returned · stock restored`); } })
      }
    });
    const payouts = Admin.listTable({
      id: 'payouts', mount: $('#payouts'), perPage: 12, empty: 'No withdrawals yet', searchPlaceholder: 'Search withdrawals',
      rows: () => S.payouts(), rowId: (p) => p.id,
      filters: [{ id: 'courier', label: 'All couriers', options: S.couriers().map((c) => [c.id, c.name]), test: (p, v) => p.courier === v }],
      search: (p, q) => (S.courierName(p.courier) + ' ' + p.ref).toLowerCase().includes(q),
      columns: [
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (p) => `<span class="small">${A.dateTime(p.date)}</span>` },
        { id: 'c', label: 'From', render: (p) => `<b class="small">${esc(S.courierName(p.courier))}</b>` },
        { id: 'to', label: 'Into', render: (p) => esc(S.accountName(p.account)) },
        { id: 'ref', label: 'Reference', render: (p) => `<span class="xs muted">${esc(p.ref || '')}</span>` },
        { id: 'amt', label: 'Amount', cls: 'right', sort: (a, b) => a.amount - b.amount, render: (p) => `<b class="num ok">${money(p.amount)}</b>` }
      ]
    });

    const ratesPaint = () => {
      $('#rates').innerHTML = `<section class="card"><h3 class="sub-h">What each courier charges you</h3><form id="rt" class="col gap-16" novalidate>${S.couriers().map((c) => `<div class="rate-row"><b>${esc(c.name)}</b><div class="form-grid4">
          <div class="field"><label>Inside Dhaka (৳)</label><input type="number" min="0" data-c="${c.id}" data-k="inside" value="${c.inside}"></div><div class="field"><label>Outside Dhaka (৳)</label><input type="number" min="0" data-c="${c.id}" data-k="outside" value="${c.outside}"></div>
          <div class="field"><label>COD charge (%)</label><input type="number" min="0" step="0.1" data-c="${c.id}" data-k="codPct" value="${c.codPct}"></div><div class="field"><label>Return charge (% of delivery)</label><input type="number" min="0" data-c="${c.id}" data-k="returnPct" value="${c.returnPct}"></div></div></div>`).join('')}
          <div class="row gap-8"><button class="btn btn-violet" type="submit">Save rates</button><span class="xs muted">Used for new bookings. Delivered parcels keep the charge they were booked with.</span></div></form></section>`;
    };
    ratesPaint();
    $('#rates').addEventListener('submit', (e) => {
      e.preventDefault();
      const cs = S.settings().couriers;
      $$('[data-c]', $('#rates')).forEach((i) => { cs[i.dataset.c][i.dataset.k] = Math.max(0, Number(i.value) || 0); });
      S.saveSettings({ couriers: cs }); kp(); A.toast('Courier rates saved');
    });

    $('#cr-cards').addEventListener('click', (e) => { const b = e.target.closest('[data-withdraw]'); if (b) withdraw(b.dataset.withdraw); });
    $('#cr-withdraw').addEventListener('click', () => withdraw(S.couriers()[0].id));
    tabs($('#cr-tabs'), { parcels: $('#list'), payouts: $('#payouts'), rates: $('#rates') });
    $('#payouts').hidden = true; $('#rates').hidden = true;
    kp();
  };
})();
