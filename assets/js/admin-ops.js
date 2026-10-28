/* ==========================================================================
   AMNO Fashion — admin controllers: store operations
   pos · showroom stock · day-close (fabric purchases: admin-prod.js)
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
  const today = () => A.ymd(Date.now());
  const sum = (arr, f) => arr.reduce((n, x) => n + (f ? f(x) : x), 0);
  const TENDERS = [['cash', 'Cash'], ['card', 'Card'], ['bkash', 'bKash'], ['nagad', 'Nagad']];

  /* ----- receipts / Z-report ----- */
  Admin.receiptHTML = (o) => {
    const loc = S.location(o.storeId) || {};
    const cfg = S.settings();
    const tenders = S.tenders(o);
    return `<div class="receipt">
      <div class="rc-c"><b class="rc-big">${esc(cfg.storeName)}</b><div><i>${esc(cfg.tagline)}</i></div><div>${esc(loc.name || '')}</div><div>${esc(loc.address || '')}</div><div>${esc(loc.phone || '')}</div>${cfg.bin ? `<div>BIN: ${esc(cfg.bin)}</div>` : ''}</div>
      <div class="rc-dash"></div>
      <div class="rc-row"><span>Receipt #${o.id}</span><span>${A.dateTime(o.date)}</span></div>
      <div class="rc-row"><span>Cashier: ${esc(o.cashier || '-')}</span><span>${esc(o.customer.name)}</span></div>
      <div class="rc-dash"></div>
      ${o.items.map((i) => `<div class="rc-item"><div>${esc(i.name)}</div><div class="rc-row"><span>${i.qty} x ${money(i.price)} · ${esc(S.sizeLabel(i.size))}</span><span>${money(i.price * i.qty)}</span></div></div>`).join('')}
      <div class="rc-dash"></div>
      <div class="rc-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.discount ? `<div class="rc-row"><span>Discount</span><span>- ${money(o.discount)}</span></div>` : ''}
      ${o.vat ? `<div class="rc-row"><span>VAT (${cfg.vatRate}%)</span><span>${money(o.vat)}</span></div>` : ''}
      <div class="rc-row rc-total"><span>TOTAL</span><span>${money(o.total)}</span></div>
      <div class="rc-dash"></div>
      ${tenders.map((t) => `<div class="rc-row"><span>${esc(S.payLabel[t.method] || t.method)}</span><span>${money(t.amount)}</span></div>`).join('')}
      ${o.change ? `<div class="rc-row"><span>Change</span><span>${money(o.change)}</span></div>` : ''}
      ${o.due ? `<div class="rc-row"><b>Amount due</b><b>${money(o.due)}</b></div>` : ''}
      <div class="rc-dash"></div><div class="rc-c">${esc(cfg.receiptFooter)}</div></div>`;
  };
  Admin.zReportHTML = (c) => {
    const loc = S.locName(c.loc);
    return `<div class="receipt">
      <div class="rc-c"><b class="rc-big">${esc(settings.storeName)}</b><div><i>${esc(settings.tagline)}</i></div><div>${esc(loc)}</div><b>DAY CLOSE (Z-REPORT)</b></div><div class="rc-dash"></div>
      <div class="rc-row"><span>Date</span><span>${A.date(c.date)}</span></div><div class="rc-row"><span>Cashier</span><span>${esc(c.cashier)}</span></div><div class="rc-row"><span>Orders</span><span>${c.orders}</span></div>
      <div class="rc-dash"></div>
      ${Object.entries(c.byTender || {}).map(([k, v]) => `<div class="rc-row"><span>${esc(S.payLabel[k] || k)}</span><span>${money(v)}</span></div>`).join('')}
      <div class="rc-row rc-total"><span>NET SALES</span><span>${money(c.total)}</span></div>
      <div class="rc-dash"></div>
      <div class="rc-row"><span>Opening float</span><span>${money(c.opening)}</span></div>
      <div class="rc-row"><span>+ Cash sales</span><span>${money((c.byTender || {}).cash || 0)}</span></div>
      <div class="rc-row"><span>- Cash expenses</span><span>${money(c.cashExpenses)}</span></div>
      <div class="rc-row"><span>Expected cash</span><span>${money(c.expected)}</span></div>
      <div class="rc-row"><span>Counted cash</span><span>${money(c.counted)}</span></div>
      <div class="rc-row rc-total"><span>VARIANCE</span><span>${c.variance > 0 ? '+' : ''}${money(c.variance)}</span></div>
      <div class="rc-row"><span>Deposited to bank</span><span>${money(c.deposit)}</span></div>
      <div class="rc-row"><span>Float for tomorrow</span><span>${money(c.counted - c.deposit)}</span></div>
      ${c.notes ? `<div class="rc-dash"></div><div>${esc(c.notes)}</div>` : ''}
      <div class="rc-dash"></div><div class="rc-c xs">Submitted ${A.dateTime(c.submittedAt)}</div></div>`;
  };

  /* ======================================================================
     POS register
     ====================================================================== */
  P.pos = () => {
    const rooms = S.showrooms();
    const cashiers = S.users().filter((u) => ['Cashier', 'Shop Manager', 'Administrator'].includes(u.role));
    const st = {
      loc: DB.get('pos.loc', null) && rooms.some((r) => r.id === DB.get('pos.loc')) ? DB.get('pos.loc') : (rooms[0] || {}).id,
      cashier: '', q: '', cat: '', cart: [], customer: null, discount: 0, discType: 'amount', holdId: null
    };
    const pickCashier = () => { const u = cashiers.find((x) => x.loc === st.loc) || cashiers[0]; st.cashier = u ? u.name : 'Cashier'; };
    pickCashier();
    const lineKey = (pid, size) => pid + '|' + size;
    const catList = S.categories();

    /* ---------- header ---------- */
    const paintTop = () => {
      $('#pos-cashier').innerHTML = cashiers.map((u) => `<option ${u.name === st.cashier ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
      const closed = S.closeFor(st.loc, today());
      $('#pos-status').className = 'badge ' + (closed ? 'b-err' : 'b-ok');
      $('#pos-status').innerHTML = closed ? `<i class="dot"></i>Day closed · ${A.dateTime(closed.submittedAt)}` : `<i class="dot"></i>Register open · float ${money(S.openingFor(st.loc, today()))}`;
      $('#holds-n').textContent = S.holds().filter((h) => h.loc === st.loc).length;
    };
    const clock = () => { $('#pos-clock').textContent = new Date().toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    clock(); setInterval(clock, 30000);

    /* ---------- catalog ---------- */
    const stockAt = (p) => S.stock(p.id, st.loc);
    const paintCats = () => { $('#pos-cats').innerHTML = `<button class="chip ${!st.cat ? 'active' : ''}" data-cat="">All</button>` + catList.map((c) => `<button class="chip ${st.cat === c.slug ? 'active' : ''}" data-cat="${c.slug}">${esc(c.name)}</button>`).join(''); };
    const paintGrid = () => {
      const q = st.q.toLowerCase();
      const list = S.published().filter((p) => (!st.cat || p.cats.includes(st.cat)) && (!q || [p.name, p.sku, p.colorName, ...p.cats].join(' ').toLowerCase().includes(q)));
      $('#pos-grid').innerHTML = list.map((p) => {
        const n = stockAt(p);
        return `<button class="pos-card ${n <= 0 ? 'out' : ''}" data-pid="${p.id}" ${n <= 0 ? 'disabled' : ''}><span class="pos-img">${S.thumb(p)}</span><b class="pos-name">${esc(p.name)}</b><span class="pos-row"><b>${money(S.price(p))}</b><span class="badge ${n <= 0 ? 'b-err' : n <= settings.lowStock ? 'b-warn' : 'b-ok'}">${n <= 0 ? 'Out' : n + ' here'}</span></span></button>`;
      }).join('') || '<div class="empty-card"><p class="muted">No products match.</p></div>';
    };

    /* ---------- cart maths ---------- */
    const totals = () => {
      const subtotal = sum(st.cart, (l) => l.price * l.qty);
      let disc = st.discType === 'percent' ? Math.round(subtotal * Math.min(100, st.discount) / 100) : Math.min(st.discount, subtotal);
      const cfg = S.settings();
      const base = subtotal - disc;
      const vat = cfg.vatRate > 0 ? Math.round(base * cfg.vatRate / 100) : 0;
      return { subtotal, disc, vat, total: base + vat };
    };

    const addLine = (p, size, color, qty = 1) => {
      const avail = S.stock(p.id, st.loc, size);
      const key = lineKey(p.id, size);
      const hit = st.cart.find((l) => l.key === key);
      const want = (hit ? hit.qty : 0) + qty;
      if (want > avail) { A.toast(`Only ${avail} of ${S.sizeLabel(size)} in stock at this showroom`, 'err'); return false; }
      if (hit) hit.qty = want; else st.cart.push({ key, pid: p.id, name: p.name, size, color: color || p.color, price: S.price(p), cost: p.cost, qty, style: p.style });
      paintCart(); return true;
    };
    const picker = (p) => {
      let size = ''; let color = p.color;
      const m = A.modal({ title: p.name, body: '', footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-add>Add to sale</button>' });
      const paint = () => {
        $('.modal-b', m.el).innerHTML = `<div class="row gap-16 wrap"><span class="pos-img lg">${A.panjabi(color, p.style, 'front')}</span><div class="grow col">
          <div><b class="big-n">${money(S.price(p))}</b> ${p.sale ? `<del class="muted">${money(p.price)}</del>` : ''}<div class="xs muted">SKU ${esc(p.sku)} · ${esc(S.locName(st.loc))}</div></div>
          <div><div class="label" style="margin-bottom:6px">Colour</div><div class="swatches">${p.colors.map((c) => `<button type="button" class="swatch ${c.hex === color ? 'on' : ''}" data-c="${c.hex}" style="--c:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`).join('')}</div></div>
          <div><div class="label" style="margin-bottom:6px">Size (stock here)</div><div class="row wrap gap-8">${p.sizes.map((z) => { const n = S.stock(p.id, st.loc, z); return `<button type="button" class="size ${z === size ? 'on' : ''}" data-s="${z}" ${n <= 0 ? 'disabled' : ''}>${esc(S.sizeLabel(z))} <span class="size-n">${n}</span></button>`; }).join('')}</div></div></div></div>`;
      };
      paint();
      m.el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-c]'); if (c) { color = c.dataset.c; paint(); return; }
        const z = e.target.closest('[data-s]'); if (z) { size = z.dataset.s; paint(); return; }
        if (e.target.closest('[data-add]')) { if (!size) { A.toast('Choose a size', 'err'); return; } if (addLine(p, size, color)) m.close(); }
      });
    };

    /* ---------- cart panel ---------- */
    const paintCart = () => {
      const t = totals();
      const closed = S.closeFor(st.loc, today());
      const cust = st.customer;
      const due = cust && cust.phone ? S.dueOf(cust.phone) : 0;
      $('#pos-cart').innerHTML = `
        <div class="pc-head"><h2>Current sale</h2><button class="btn-link danger small" data-clear ${st.cart.length ? '' : 'disabled'}>Clear</button></div>
        <div class="pc-cust">${cust ? `<div class="row gap-8">${Admin.avatar(cust.name, 'sm')}<div class="grow"><b class="small">${esc(cust.name)}</b><div class="xs muted">${esc(cust.phone || 'Walk-in')}${due ? ` · <span class="err">due ${money(due)}</span>` : ''}</div></div><button class="btn btn-ghost btn-icon btn-sm" data-cust-clear aria-label="Remove customer">${icon('x', 14)}</button></div>`
          : `<form class="row gap-8" id="cust-form"><div class="input-group grow"><i data-icon="user"></i><input id="cust-q" type="tel" placeholder="Customer mobile (to keep a record)" aria-label="Customer mobile"></div><button class="btn btn-glass btn-sm" type="submit">Find</button></form>`}</div>
        <div class="pc-lines">${st.cart.map((l) => `<div class="pc-line" data-key="${esc(l.key)}"><div class="grow"><b class="small">${esc(l.name)}</b><div class="xs muted">${esc(S.sizeLabel(l.size))}${l.price !== (S.product(l.pid) ? S.price(S.product(l.pid)) : l.price) ? ' · price changed' : ''}</div></div>
          <div class="qty-mini"><button data-q="-1" aria-label="Decrease">${icon('minus', 13)}</button><span class="num">${l.qty}</span><button data-q="1" aria-label="Increase">${icon('plus', 13)}</button></div>
          <b class="num pc-price">${money(l.price * l.qty)}</b><button class="btn btn-ghost btn-icon btn-sm" data-rm aria-label="Remove">${icon('x', 14)}</button></div>`).join('') || `<div class="pc-empty">${icon('barcode', 34)}<p class="muted small">Scan a barcode or tap a product to start a sale.</p></div>`}</div>
        <div class="pc-foot">
          <div class="pc-disc"><label class="xs muted" for="disc">Discount</label><input id="disc" type="number" min="0" value="${st.discount || ''}" placeholder="0"><select id="disc-type" aria-label="Discount type"><option value="amount" ${st.discType === 'amount' ? 'selected' : ''}>৳</option><option value="percent" ${st.discType === 'percent' ? 'selected' : ''}>%</option></select></div>
          <div class="pc-sum"><div><span>Subtotal</span><b class="num">${money(t.subtotal)}</b></div>${t.disc ? `<div><span>Discount</span><b class="num ok">- ${money(t.disc)}</b></div>` : ''}${t.vat ? `<div><span>VAT (${settings.vatRate}%)</span><b class="num">${money(t.vat)}</b></div>` : ''}<div class="g"><span>Total</span><b class="num">${money(t.total)}</b></div></div>
          ${closed ? '<p class="xs err">The day is closed for this showroom. Reopen it in Day close to sell.</p>' : ''}
          <div class="row gap-8"><button class="btn btn-glass" data-hold ${st.cart.length ? '' : 'disabled'}>${icon('pause', 16)} Hold</button><button class="btn btn-violet grow btn-lg" data-pay ${st.cart.length && !closed ? '' : 'disabled'}>Pay ${money(t.total)}</button></div>
        </div>`;
      A.hydrate($('#pos-cart'));
    };

    /* ---------- payment ---------- */
    const payModal = () => {
      const t = totals();
      const cust = st.customer;
      const m = A.modal({
        title: `Take payment · ${money(t.total)}`, wide: true,
        body: `<div class="pay-grid"><div class="col gap-8" id="pay-fields">
            ${TENDERS.map(([k, l]) => `<label class="pay-row"><span>${l}</span><input type="number" min="0" data-t="${k}" placeholder="0"></label>`).join('')}
            <label class="pay-row ${cust && cust.phone ? '' : 'dim'}"><span>On credit (due)</span><input type="number" min="0" data-t="due" placeholder="0" ${cust && cust.phone ? '' : 'disabled'}></label>
            ${cust && cust.phone ? '' : '<span class="xs muted">Add the customer\'s mobile number to sell on credit.</span>'}
            <div class="row gap-8 wrap"><button class="btn btn-glass btn-sm" data-fill="cash:${t.total}">Exact cash</button>${[500, 1000, 2000, 5000].map((n) => `<button class="btn btn-ghost btn-sm" data-fill="cash:${n}">${money(n)}</button>`).join('')}</div></div>
          <div class="pay-sum glass-soft"><div><span>Total</span><b class="num">${money(t.total)}</b></div><div><span>Paid</span><b class="num" id="ps-paid">${money(0)}</b></div><div class="g" id="ps-rem"><span>Remaining</span><b class="num">${money(t.total)}</b></div><div id="ps-change" hidden><span>Change to give</span><b class="num ok">${money(0)}</b></div></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Back</button><button class="btn btn-violet btn-lg" data-complete disabled>Complete sale</button>'
      });
      const val = (k) => Math.max(0, Number($(`[data-t="${k}"]`, m.el).value) || 0);
      const calc = () => {
        const other = val('card') + val('bkash') + val('nagad') + val('due');
        const need = Math.max(0, t.total - other);
        const cash = val('cash');
        const applied = Math.min(cash, need);
        const paid = other + applied;
        const change = Math.max(0, cash - need);
        const rem = t.total - paid;
        $('#ps-paid', m.el).textContent = money(paid);
        $('#ps-rem', m.el).innerHTML = `<span>${rem > 0 ? 'Remaining' : 'Remaining'}</span><b class="num ${rem > 0 ? 'err' : 'ok'}">${money(Math.max(0, rem))}</b>`;
        $('#ps-change', m.el).hidden = !(change > 0); $('#ps-change b', m.el).textContent = money(change);
        $('[data-complete]', m.el).disabled = rem > 0 || other > t.total || (val('due') > 0 && !(cust && cust.phone));
        return { cash: applied, change };
      };
      m.el.addEventListener('input', calc);
      m.el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-fill]');
        if (f) { const [k, n] = f.dataset.fill.split(':'); $(`[data-t="${k}"]`, m.el).value = n; calc(); return; }
        if (!e.target.closest('[data-complete]')) return;
        const r = calc();
        const payments = [];
        if (r.cash > 0) payments.push({ method: 'cash', amount: r.cash });
        ['card', 'bkash', 'nagad'].forEach((k) => { if (val(k) > 0) payments.push({ method: k, amount: val(k) }); });
        if (val('due') > 0) payments.push({ method: 'due', amount: val('due') });
        const short = st.cart.find((l) => S.stock(l.pid, st.loc, l.size) < l.qty);
        if (short) { A.toast(`${short.name} (${S.sizeLabel(short.size)}) is no longer in stock here`, 'err'); return; }
        const order = S.addOrder({
          channel: 'store', storeId: st.loc, cashier: st.cashier, status: 'completed',
          customer: cust || { name: 'Walk-in customer', phone: '', email: '', district: '', address: '' },
          items: st.cart.map((l) => { const p = S.product(l.pid) || {}; return { pid: l.pid, name: l.name, price: l.price, cost: p.cost || l.cost, qty: l.qty, size: l.size, color: ((p.colors || []).find((c) => c.hex === l.color) || {}).name || '', hex: l.color, style: l.style }; }),
          subtotal: t.subtotal, shipping: 0, discount: t.disc, coupon: '', vat: t.vat, total: t.total,
          payment: payments[0].method, payments, due: val('due'), change: r.change, payRef: '', note: '',
          notes: [{ text: 'Sold at the counter.', date: new Date().toISOString(), by: st.cashier }]
        });
        if (st.holdId) { S.saveHolds(S.holds().filter((h) => h.id !== st.holdId)); st.holdId = null; }
        st.cart = []; st.customer = null; st.discount = 0;
        m.close(); paintCart(); paintGrid(); paintTop();
        Admin.printModal(`Receipt #${order.id}`, Admin.receiptHTML(order));
      });
    };

    /* ---------- events ---------- */
    $('#pos-cashier').addEventListener('change', (e) => { st.cashier = e.target.value; });
    $('#pos-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { st.cat = b.dataset.cat; paintCats(); paintGrid(); } });
    $('#pos-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) picker(S.product(Number(b.dataset.pid))); });
    $('#pos-q').addEventListener('input', A.debounce((e) => { st.q = e.target.value.trim(); paintGrid(); }, 120));
    $('#pos-q').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const raw = e.target.value.trim().toUpperCase(); if (!raw) return;
      const m = raw.match(/^(?:AMN-)?(\d{3,5})(?:-([A-Z0-9]+))?$/);
      if (m) {
        const p = S.products().find((x) => x.sku === 'AMN-' + m[1] && x.status === 'publish');
        if (p) { e.target.value = ''; st.q = ''; paintGrid(); if (m[2] && p.sizes.includes(m[2])) addLine(p, m[2]); else picker(p); return; }
      }
      A.toast('No product with that code', 'err');
    });
    $('#pos-cart').addEventListener('click', (e) => {
      const t = e.target;
      const row = t.closest('.pc-line');
      if (row) {
        const l = st.cart.find((x) => x.key === row.dataset.key);
        const q = t.closest('[data-q]');
        if (q && l) { const n = l.qty + Number(q.dataset.q); if (n <= 0) st.cart = st.cart.filter((x) => x !== l); else if (n > S.stock(l.pid, st.loc, l.size)) A.toast('No more stock of that size here', 'err'); else l.qty = n; paintCart(); return; }
        if (t.closest('[data-rm]')) { st.cart = st.cart.filter((x) => x !== l); paintCart(); return; }
      }
      if (t.closest('[data-clear]')) { st.cart = []; st.discount = 0; st.holdId = null; paintCart(); return; }
      if (t.closest('[data-cust-clear]')) { st.customer = null; paintCart(); return; }
      if (t.closest('[data-hold]')) {
        const holds = S.holds(); holds.push({ id: st.holdId || A.uid(), date: new Date().toISOString(), loc: st.loc, cashier: st.cashier, customer: st.customer, cart: st.cart, discount: st.discount, discType: st.discType });
        S.saveHolds(holds.filter((h, i, a) => a.findIndex((x) => x.id === h.id) === i));
        st.cart = []; st.customer = null; st.discount = 0; st.holdId = null; paintCart(); paintTop(); A.toast('Sale put on hold'); return;
      }
      if (t.closest('[data-pay]')) payModal();
    });
    $('#pos-cart').addEventListener('change', (e) => {
      if (e.target.id === 'disc') { st.discount = Math.max(0, Number(e.target.value) || 0); paintCart(); }
      if (e.target.id === 'disc-type') { st.discType = e.target.value; paintCart(); }
    });
    $('#pos-cart').addEventListener('submit', (e) => {
      if (e.target.id !== 'cust-form') return;
      e.preventDefault();
      const raw = $('#cust-q').value.trim(); if (!raw) return;
      if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(raw.replace(/[\s-]/g, ''))) { A.toast('Enter a valid mobile number (01XXXXXXXXX)', 'err'); return; }
      const d = (x) => String(x).replace(/\D/g, '').slice(-10);
      const known = S.customers().find((c) => d(c.phone) === d(raw));
      if (known) { st.customer = { name: known.name, phone: known.phone, email: known.email || '', district: known.district, address: known.address }; paintCart(); A.toast(`Found ${known.name}`); return; }
      const m = A.modal({ title: 'New customer', body: `<p class="xs muted" style="margin-bottom:10px">${esc(raw)} is not in your customer list yet. Save the details so you can find them next time.</p><div class="form-grid2"><div class="field"><label for="nc-name">Name *</label><input id="nc-name" placeholder="Customer name"><span class="msg">Enter a name.</span></div><div class="field"><label for="nc-district">District</label><select id="nc-district">${S.districts.map((d) => `<option ${d === 'Dhaka' ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div class="field full"><label for="nc-addr">Address (optional)</label><input id="nc-addr" placeholder="House, road, area"></div></div>`, footer: '<button class="btn btn-ghost" data-close>Skip (walk-in)</button><button class="btn btn-violet" data-ok>Save customer</button>' });
      m.el.addEventListener('click', (ev) => { if (!ev.target.closest('[data-ok]')) return; const n = $('#nc-name', m.el).value.trim(); $('#nc-name', m.el).closest('.field').classList.toggle('err', !n); if (!n) return; st.customer = { name: n, phone: raw.replace(/[\s-]/g, ''), email: '', district: $('#nc-district', m.el).value, address: $('#nc-addr', m.el).value.trim() }; m.close(); paintCart(); A.toast(`${n} saved with this sale`); });
    });
    $('#pos-holds').addEventListener('click', () => {
      const holds = S.holds().filter((h) => h.loc === st.loc);
      const m = A.modal({ title: 'Held bills', body: holds.length ? holds.map((h) => `<div class="hold-row"><div class="grow"><b>${esc((h.customer && h.customer.name) || 'Walk-in')}</b><div class="xs muted">${A.ago(h.date)} · ${A.plural(sum(h.cart, (l) => l.qty), 'item')} · ${money(sum(h.cart, (l) => l.price * l.qty))}</div></div><button class="btn btn-violet btn-sm" data-resume="${h.id}">Resume</button><button class="btn btn-danger btn-sm" data-drop="${h.id}">Delete</button></div>`).join('') : '<p class="muted center" style="padding:20px">No held bills for this showroom.</p>' });
      m.el.addEventListener('click', (e) => {
        const r = e.target.closest('[data-resume]'); const d = e.target.closest('[data-drop]');
        if (r) { const h = S.holds().find((x) => x.id === r.dataset.resume); if (h) { st.cart = h.cart; st.customer = h.customer; st.discount = h.discount || 0; st.discType = h.discType || 'amount'; st.holdId = h.id; m.close(); paintCart(); } }
        if (d) { S.saveHolds(S.holds().filter((x) => x.id !== d.dataset.drop)); m.close(); paintTop(); A.toast('Held bill deleted'); }
      });
    });
    paintTop(); paintCats(); paintGrid(); paintCart();
    $('#pos-q').focus();
  };

  /* ======================================================================
     Inventory
     ====================================================================== */
  P.inventory = () => {
    const locs = S.locations();
    const prods = () => S.products().filter((p) => p.status === 'publish' || S.stock(p.id) > 0);
    const kpis = () => {
      const v = S.valuation();
      const list = S.products().filter((p) => p.status === 'publish');
      const low = list.filter((p) => { const n = S.stock(p.id); return n > 0 && n <= settings.lowStock; }).length;
      const out = list.filter((p) => S.stock(p.id) <= 0).length;
      $('#inv-kpis').innerHTML = [['Units in stock', v.qty.toLocaleString('en-IN'), 'package'], ['Stock value (cost)', money(v.cost), 'coins'], ['Retail value', money(v.retail), 'tag'], ['Low stock', low, 'alert'], ['Out of stock', out, 'x']].map(([l, n, ic]) => `<div class="card kpi-lite"><span class="kpi-label">${icon(ic, 14)} ${l}</span><b class="num">${n}</b></div>`).join('');
    };
    kpis();

    const adjust = (p, api) => {
      const cur = {}; locs.forEach((l) => { cur[l.id] = S.stockBySize(p.id, l.id); });
      const m = A.modal({
        title: `Adjust stock · ${p.name}`, wide: true,
        body: `<div class="table-wrap"><table class="wp-table inv-grid"><thead><tr><th>Size</th><th class="right">Quantity</th></tr></thead><tbody>${p.sizes.map((z) => `<tr><td><b>${esc(S.sizeLabel(z))}</b></td>${locs.map((l) => `<td class="right"><input type="number" min="0" data-loc="${l.id}" data-size="${z}" value="${cur[l.id][z] || 0}" style="width:84px;min-height:38px;text-align:right"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <div class="form-grid2" style="margin-top:16px"><div class="field"><label>Reason</label><select id="adj-reason"><option value="stocktake">Stocktake / recount</option><option value="damage">Damaged or lost</option><option value="correction">Correction</option><option value="opening">Opening stock</option></select></div><div class="field"><label>Note (optional)</label><input id="adj-note" placeholder="e.g. Monthly stocktake"></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save adjustment</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        let changed = 0;
        $$('input[data-loc]', m.el).forEach((i) => {
          const want = Math.max(0, Math.round(Number(i.value) || 0)); const have = cur[i.dataset.loc][i.dataset.size] || 0;
          if (want !== have) { S.adjust(p.id, i.dataset.loc, i.dataset.size, want - have, $('#adj-reason', m.el).value, { note: $('#adj-note', m.el).value.trim(), by: 'Amnu Admin' }); changed++; }
        });
        m.close(); api.refresh(); kpis(); moves.refresh(); A.toast(changed ? `${changed} stock level${changed === 1 ? '' : 's'} updated` : 'No changes');
      });
    };
    const api = Admin.listTable({
      id: 'inventory', mount: $('#list'), perPage: 12, empty: 'No products', searchPlaceholder: 'Search by name or SKU',
      rows: () => prods(), rowId: (p) => p.id, initialView: A.qs.get('view') || undefined, initialQ: A.qs.get('q') || '',
      views: [{ id: 'all', label: 'All' }, { id: 'low', label: 'Low stock', filter: (p) => { const n = S.stock(p.id); return n > 0 && n <= settings.lowStock; } }, { id: 'out', label: 'Out of stock', filter: (p) => S.stock(p.id) <= 0 }],
      filters: [{ id: 'cat', label: 'All categories', options: S.categories().map((c) => [c.slug, c.name]), test: (p, v) => p.cats.includes(v) }],
      search: (p, q) => (p.name + ' ' + p.sku).toLowerCase().includes(q),
      columns: [
        { id: 'img', label: '', cls: 'thumb-col', render: (p) => Admin.thumb(p) },
        { id: 'name', label: 'Product', sort: (a, b) => a.name.localeCompare(b.name), render: (p) => `<a class="row-title" href="product-edit.html?id=${p.id}">${esc(p.name)}</a><div class="xs muted mono">${esc(p.sku)}</div>${Admin.actions([{ label: 'Adjust stock', act: 'adj', id: p.id }])}` }
      ].concat([
        { id: 'sizes', label: 'Sizes (all locations)', render: (p) => `<div class="size-mini">${p.sizes.map((z) => { const n = S.stock(p.id, null, z); return `<span class="${n <= 0 ? 'off' : n <= 2 ? 'low' : ''}" title="${n} in stock">${esc(z)}<b>${n}</b></span>`; }).join('')}</div>` },
        { id: 'total', label: 'Total', cls: 'right', sort: (a, b) => S.stock(a.id) - S.stock(b.id), render: (p) => { const n = S.stock(p.id); return `<b class="num">${n}</b> ${n <= 0 ? '<span class="badge b-err">Out</span>' : n <= settings.lowStock ? '<span class="badge b-warn">Low</span>' : ''}`; } },
        { id: 'value', label: 'Cost value', cls: 'right', hidden: false, sort: (a, b) => S.stock(a.id) * a.cost - S.stock(b.id) * b.cost, render: (p) => `<span class="num">${money(S.stock(p.id) * (p.cost || 0))}</span>` }
      ]),
      actions: { adj: (id, p, a) => adjust(p, a) }
    });

    const REASON = { sale: ['Sale', 'b-info'], production: ['From production', 'b-ok'], purchase: ['Purchase', 'b-ok'], stocktake: ['Stocktake', 'b-warn'], damage: ['Damaged', 'b-err'], correction: ['Correction', 'b-warn'], opening: ['Opening', 'b-ok'], adjustment: ['Adjustment', 'b-warn'], return: ['Return', 'b-ok'] };
    const moves = Admin.listTable({
      id: 'moves', mount: $('#moves'), perPage: 10, empty: 'No stock movements yet. Sell something, receive a purchase or transfer stock.', searchPlaceholder: 'Search movements',
      rows: () => S.moves(), rowId: (m) => m.id,
      filters: [{ id: 'reason', label: 'All reasons', options: Object.entries(REASON).map(([k, v]) => [k, v[0]]), test: (m, v) => m.reason === v }],
      search: (m, q) => ((S.product(m.pid) || {}).name + ' ' + (m.ref || '') + ' ' + (m.note || '')).toLowerCase().includes(q),
      columns: [
        { id: 'date', label: 'When', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (m) => `<span class="small">${A.dateTime(m.date)}</span>` },
        { id: 'p', label: 'Product', render: (m) => { const p = S.product(m.pid); return p ? `<div class="row gap-8">${Admin.thumb(p, 'sm')}<b class="small">${esc(p.name)}</b></div>` : '—'; } },
        { id: 'size', label: 'Size', render: (m) => esc(S.sizeLabel(m.size)) },
        { id: 'delta', label: 'Change', cls: 'right', render: (m) => `<b class="num ${m.delta > 0 ? 'ok' : 'err'}">${m.delta > 0 ? '+' : ''}${m.delta}</b>` },
        { id: 'reason', label: 'Reason', render: (m) => { const r = REASON[m.reason] || [m.reason, '']; return `<span class="badge ${r[1]}">${esc(r[0])}</span>`; } },
        { id: 'ref', label: 'Ref', render: (m) => `<span class="mono xs">${esc(m.ref ? (typeof m.ref === 'number' ? '#' + m.ref : m.ref) : '—')}</span>${m.note ? `<div class="xs muted">${esc(m.note)}</div>` : ''}` },
        { id: 'by', label: 'By', hidden: true, render: (m) => esc(m.by || '') }
      ]
    });

    $('#inv-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      $$('#inv-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      $('#list').hidden = b.dataset.tab !== 'stock'; $('#moves').hidden = b.dataset.tab !== 'moves';
    });
    $('#inv-export').addEventListener('click', () => {
      Admin.csv('amnu-stock.csv', [['SKU', 'Product', 'Size', 'Quantity', 'Unit cost', 'Cost value']].concat(prods().flatMap((p) => p.sizes.map((z) => [p.sku, p.name, z, S.stock(p.id, null, z), p.cost, S.stock(p.id, null, z) * p.cost]))));
    });
    $('#list').hidden = false; $('#moves').hidden = true;
    void api;
  };

  /* ======================================================================
     Day close (cash register)
     ====================================================================== */
  P['day-close'] = () => {
    const rooms = S.showrooms();
    const st = { loc: (rooms[0] || {}).id, date: today() };
    const counts = {}; S.denoms.forEach((n) => { counts[n] = 0; });
    let opening = 0; let deposit = 0; let notes = ''; let float = 5000;

    const sel = () => { $('#dc-date').value = st.date; $('#dc-date').max = today(); };
    const render = () => {
      const sales = S.salesFor(st.loc, st.date);
      const closed = S.closeFor(st.loc, st.date);
      const cashExp = S.cashExpensesFor(st.loc, st.date);
      const expList = S.expenses().filter((e) => e.account === 'cash' && e.loc === st.loc && A.ymd(e.date) === st.date);
      opening = closed ? closed.opening : S.openingFor(st.loc, st.date);
      const cashSales = sales.byTender.cash || 0;
      const expected = opening + cashSales - cashExp;
      const counted = closed ? closed.counted : sum(S.denoms, (n) => n * (counts[n] || 0));
      const variance = counted - expected;
      const started = !!closed || counted > 0;
      $('#dc-badge').className = 'badge ' + (closed ? 'b-err' : 'b-ok');
      $('#dc-badge').innerHTML = closed ? `<i class="dot"></i>Closed by ${esc(closed.cashier)}` : '<i class="dot"></i>Open';
      const tenderRows = Object.entries(sales.byTender).map(([k, v]) => `<tr><td>${esc(S.payLabel[k] || k)}</td><td class="right num">${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No sales yet</td></tr>';
      $('#dc-sales').innerHTML = `<div class="dc-kpis"><div><span class="xs muted">Orders</span><b class="num">${sales.count}</b></div><div><span class="xs muted">Pieces</span><b class="num">${sales.pieces}</b></div><div><span class="xs muted">Net sales</span><b class="num">${money(sales.total)}</b></div><div><span class="xs muted">Discounts</span><b class="num">${money(sales.discount)}</b></div></div>
        <h4 class="sub-h">By payment method</h4><table class="mini-table"><tbody>${tenderRows}${sales.refunded ? `<tr><td class="err">Refunded sales (excluded)</td><td class="right num err">${money(sales.refunded)}</td></tr>` : ''}</tbody></table>
        <h4 class="sub-h" style="margin-top:16px">Cash paid out today</h4>${expList.length ? `<table class="mini-table"><tbody>${expList.map((e) => `<tr><td>${esc(e.category)}${e.vendor ? ' · ' + esc(e.vendor) : ''}</td><td class="right num">${money(e.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No cash expenses recorded. <a class="btn-link" href="expenses.html?new=1">Add an expense</a></p>'}`;
      $('#dc-count').innerHTML = closed ? `<div class="locked">${icon('lock', 30)}<p><b>Day closed</b><br><span class="muted small">Submitted ${A.dateTime(closed.submittedAt)} by ${esc(closed.cashier)}</span></p></div>`
        : `<div class="denoms">${S.denoms.map((n) => `<label class="denom"><span>${money(n).replace('৳', '৳ ')}</span><input type="number" min="0" data-d="${n}" value="${counts[n] || ''}" placeholder="0" aria-label="${n} taka notes or coins"><b class="num">${money(n * (counts[n] || 0))}</b></label>`).join('')}</div>`;
      const f = closed ? closed.deposit : deposit;
      $('#dc-recon').innerHTML = `<div class="recon"><div><span>Opening float</span><b class="num">${money(opening)}</b></div><div><span>+ Cash sales</span><b class="num">${money(cashSales)}</b></div><div><span>− Cash expenses</span><b class="num">${money(cashExp)}</b></div><div class="g"><span>Expected cash</span><b class="num">${money(expected)}</b></div><div><span>Counted cash</span><b class="num">${money(counted)}</b></div><div class="g ${!started ? '' : variance === 0 ? 'ok' : Math.abs(variance) <= 100 ? 'warn' : 'err'}"><span>Variance</span><b class="num">${started ? (variance > 0 ? '+' : '') + money(variance) : '—'}</b></div></div>
        ${closed ? '' : `<div class="form-grid2" style="margin-top:14px"><div class="field"><label for="dc-float">Float to keep in drawer (৳)</label><input id="dc-float" type="number" min="0" value="${float}"><span class="hint">Deposit = counted cash − float</span></div><div class="field"><label for="dc-dep">Deposit to bank (৳)</label><input id="dc-dep" type="number" min="0" value="${Math.max(0, deposit)}"></div></div><div class="field" style="margin-top:12px"><label for="dc-notes">Notes ${Math.abs(variance) > 500 ? '(required for variance over ৳500)' : '(optional)'}</label><textarea id="dc-notes" rows="2" placeholder="Explain any difference">${esc(notes)}</textarea></div>
        <button class="btn btn-violet btn-lg btn-block" id="dc-submit" style="margin-top:12px" ${st.date > today() ? 'disabled' : ''}>${icon('lock', 18)} Submit day close</button>`}
        ${closed ? `<div class="row gap-8" style="margin-top:12px"><button class="btn btn-glass grow" id="dc-print">${icon('printer', 16)} Print Z-report</button>${!closed.seeded ? '<button class="btn btn-danger" id="dc-reopen">Reopen day</button>' : ''}</div>` : ''}
        <p class="xs muted" style="margin-top:10px">Submitting locks the day: it records the sales summary, cash count and variance, and moves the deposit from Cash in hand to the bank.</p>`;
      state = { sales, expected, counted, variance, cashExp, closed };
    };
    let state = {};
    const submit = () => {
      const { sales, expected, counted, variance, cashExp } = state;
      if (counted <= 0 && sales.byTender.cash) { A.toast('Count the cash in the drawer first', 'err'); return; }
      if (Math.abs(variance) > 500 && !notes.trim()) { A.toast('Add a note explaining the variance', 'err'); $('#dc-notes').focus(); return; }
      if (deposit > counted) { A.toast('Deposit cannot be more than the counted cash', 'err'); return; }
      A.confirm(`Submit the day close for ${S.locName(st.loc)} on ${A.date(st.date)}? Counted ${money(counted)}, variance ${money(variance)}.`, 'Submit').then((ok) => {
        if (!ok) return;
        S.addClose({ date: st.date, loc: st.loc, opening, byTender: sales.byTender, orders: sales.count, total: sales.total, discount: sales.discount, vat: sales.vat, cashExpenses: cashExp, expected, counted, variance, deposit, denoms: Object.assign({}, counts), cashier: ($('#dc-cashier').value || 'Cashier'), notes: notes.trim() });
        S.denoms.forEach((n) => { counts[n] = 0; }); deposit = 0; notes = '';
        render(); history.refresh(); A.toast('Day closed and submitted');
      });
    };
    const cashiers = S.users().filter((u) => ['Cashier', 'Shop Manager', 'Administrator'].includes(u.role));
    $('#dc-cashier').innerHTML = cashiers.map((u) => `<option>${esc(u.name)}</option>`).join('');
    sel(); render();
    $('#dc-date').addEventListener('change', (e) => { st.date = e.target.value || today(); render(); });
    $('#dc-count').addEventListener('input', (e) => {
      const n = e.target.dataset.d; if (!n) return;
      counts[n] = Math.max(0, Math.round(Number(e.target.value) || 0));
      const pos = e.target.selectionStart; const active = e.target;
      render(); const again = $(`[data-d="${n}"]`); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (er) { /* number input */ } } void active;
      deposit = Math.max(0, Math.floor((state.counted - float) / 100) * 100);
      const dep = $('#dc-dep'); if (dep) dep.value = deposit;
    });
    $('#dc-recon').addEventListener('input', (e) => {
      if (e.target.id === 'dc-float') { float = Math.max(0, Number(e.target.value) || 0); deposit = Math.max(0, Math.floor((state.counted - float) / 100) * 100); $('#dc-dep').value = deposit; }
      if (e.target.id === 'dc-dep') deposit = Math.max(0, Number(e.target.value) || 0);
      if (e.target.id === 'dc-notes') notes = e.target.value;
    });
    $('#dc-recon').addEventListener('click', (e) => {
      if (e.target.closest('#dc-submit')) submit();
      if (e.target.closest('#dc-print')) Admin.printModal('Z-report', Admin.zReportHTML(state.closed));
      if (e.target.closest('#dc-reopen')) A.confirm('Reopen this day? You can then sell and submit again.', 'Reopen').then((ok) => { if (ok) { DB.set('closes.new', DB.get('closes.new', []).filter((c) => !(c.loc === st.loc && c.date === st.date))); render(); history.refresh(); A.toast('Day reopened'); } });
    });

    const history = Admin.listTable({
      id: 'closes', mount: $('#history'), perPage: 8, empty: 'No closed days yet', searchPlaceholder: 'Search closes',
      rows: () => S.closes().filter((c) => c.loc === st.loc).sort((a, b) => (a.date < b.date ? 1 : -1)), rowId: (c) => c.id,
      columns: [
        { id: 'date', label: 'Date', sort: (a, b) => (a.date < b.date ? -1 : 1), render: (c) => `<b>${A.date(c.date)}</b>${Admin.actions([{ label: 'Z-report', act: 'z', id: c.id }])}` },
        { id: 'orders', label: 'Orders', cls: 'right', render: (c) => `<span class="num">${c.orders}</span>` },
        { id: 'total', label: 'Net sales', cls: 'right', sort: (a, b) => a.total - b.total, render: (c) => `<b class="num">${money(c.total)}</b>` },
        { id: 'cash', label: 'Cash sales', cls: 'right', render: (c) => `<span class="num">${money((c.byTender || {}).cash || 0)}</span>` },
        { id: 'exp', label: 'Expected', cls: 'right', render: (c) => `<span class="num">${money(c.expected)}</span>` },
        { id: 'cnt', label: 'Counted', cls: 'right', render: (c) => `<span class="num">${money(c.counted)}</span>` },
        { id: 'var', label: 'Variance', cls: 'right', sort: (a, b) => a.variance - b.variance, render: (c) => `<b class="num ${c.variance === 0 ? 'ok' : Math.abs(c.variance) <= 100 ? '' : 'err'}">${c.variance > 0 ? '+' : ''}${money(c.variance)}</b>` },
        { id: 'dep', label: 'Deposited', cls: 'right', render: (c) => `<span class="num">${money(c.deposit)}</span>` },
        { id: 'cashier', label: 'Cashier', hidden: true, render: (c) => esc(c.cashier) }
      ],
      actions: { z: (id, c) => Admin.printModal('Z-report', Admin.zReportHTML(c)) }
    });
  };
})();
