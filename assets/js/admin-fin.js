/* ==========================================================================
   Amnu Fashion — admin controllers: finance & revenue
   finance · expenses · accounts · reports · loyalty
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const Admin = A.admin;
  const { $, $$, esc, icon, money } = A;
  const P = (A.adminPages = A.adminPages || {});
  const M = Admin.metrics;
  const sum = (arr, f) => arr.reduce((n, x) => n + (f ? f(x) : x), 0);
  const valid = S.isValidOrder;
  const today = () => A.ymd(Date.now());
  const rev = (o) => Math.max(0, o.subtotal - (o.discount || 0));
  const prevRange = ([f, t]) => { const len = t - f + 1; return [f - len, f - 1]; };
  const RANGE_LABEL = { today: 'Today', 7: 'Last 7 days', 30: 'Last 30 days', month: 'This month', 90: 'Last 90 days', 365: 'Last 12 months' };
  const fmtRange = ([f, t]) => `${A.date(f)} – ${A.date(Math.min(t, Date.now()))}`;
  const eachDay = (from, to) => { const out = []; const d = new Date(from); d.setHours(0, 0, 0, 0); while (d.getTime() <= to) { out.push(d.getTime()); d.setDate(d.getDate() + 1); } return out; };
  const ordersIn = (from, to) => S.orders().filter((o) => valid(o) && S.within(o.date, from, to));
  const inverseDelta = (d, label) => `<span class="delta ${d <= 0 ? 'up' : 'down'}">${icon(d >= 0 ? 'arrow-up' : 'arrow-down', 14)}${Math.abs(d).toFixed(1)}%${label ? `<span class="muted"> ${esc(label)}</span>` : ''}</span>`;
  const kpiCard = (label, value, delta, ic, tone, sub) => `<article class="kpi glass"><div class="kpi-top"><div><span class="kpi-label">${label}</span><b class="kpi-val num">${value}</b></div><span class="kpi-ico ${tone}">${icon(ic, 22)}</span></div>${delta}${sub ? `<div class="xs muted" style="margin-top:6px">${sub}</div>` : ''}</article>`;

  /** revenue per day split by channel: showroom, website, social media (grouped weekly for long ranges) */
  const CHS = ['store', 'online', 'social'];
  Admin.CH_SERIES = [{ name: 'Showroom', cls: 's-a' }, { name: 'Website', cls: 's-b' }, { name: 'Social media', cls: 's-c' }];
  const channelSeries = (from, to) => {
    const days = eachDay(from, to);
    const idx = new Map(days.map((t, i) => [t, i]));
    const by = CHS.map(() => days.map(() => 0));
    S.orders().forEach((o) => { if (!valid(o)) return; const i = idx.get(M.startOf(o.date)); if (i == null) return; by[Math.max(0, CHS.indexOf(S.channelOf(o)))][i] += rev(o); });
    const step = days.length > 45 ? 7 : 1;
    const out = [];
    for (let i = 0; i < days.length; i += step) {
      const a = days[i]; const b = days[Math.min(i + step, days.length) - 1];
      out.push({ label: A.dateShort(a), tip: step > 1 ? `${A.dateShort(a)} – ${A.dateShort(b)}` : A.date(a), values: by.map((arr) => sum(arr.slice(i, i + step))) });
    }
    return out;
  };
  Admin.channelSeries = channelSeries;

  /** the profit & loss statement as stacked rows */
  const plRow = (label, val, cls = '', sub = '') => `<div class="pl-row ${cls}"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><b class="num">${val}</b></div>`;
  const pnlHTML = (p) => {
    const cats = Object.entries(p.byCat).sort((a, b) => b[1] - a[1]);
    return `<div class="pl">
      ${plRow('Sales revenue', money(p.revenue), 'head', 'After discounts, before delivery and VAT')}
      ${plRow('Showroom (POS)', money(p.ch.store.revenue), 'indent')}
      ${plRow('Website', money(p.ch.online.revenue), 'indent')}
      ${plRow('Social media (Facebook, WhatsApp…)', money(p.ch.social.revenue), 'indent')}
      ${plRow('Cost of goods sold', '− ' + money(p.cogs))}
      ${plRow('Gross profit', money(p.grossProfit), 'sum', p.margin.toFixed(1) + '% margin')}
      ${p.shipping ? plRow('Delivery charges collected', '+ ' + money(p.shipping)) : ''}
      ${plRow('Operating expenses', '− ' + money(p.expenses), 'subtotal')}
      ${cats.map(([c, v]) => plRow(esc(c), money(v), 'indent')).join('') || '<div class="pl-row indent"><span class="muted">No expenses in this period</span><b></b></div>'}
      ${plRow('Net profit', money(p.net), 'sum grand ' + (p.net < 0 ? 'neg' : ''), (p.revenue ? ((p.net / p.revenue) * 100).toFixed(1) : '0.0') + '% of revenue')}
      ${p.vat ? `<p class="xs muted pl-note">VAT collected (${money(p.vat)}) is a liability and is not counted as revenue.</p>` : ''}</div>`;
  };

  /* ======================================================================
     Finance overview
     ====================================================================== */
  P.finance = () => {
    const sel = $('#f-range'); sel.value = DB.get('fin.range', '30');
    const render = () => {
      const key = sel.value; DB.set('fin.range', key);
      const r = S.range(key); const p = S.pnl(r[0], r[1]);
      const pr = prevRange(r); const q = S.pnl(pr[0], pr[1]);
      const label = 'vs previous period';
      $('#f-period').textContent = fmtRange(r);
      $('#f-kpis').innerHTML = [
        kpiCard('Revenue', money(p.revenue), M.deltaHTML(M.pctDelta(p.revenue, q.revenue), label), 'coins', 'violet', `${A.plural(p.orders, 'order')} · ${A.plural(sum(Object.values(p.ch), (c) => c.pieces), 'piece')}`),
        kpiCard('Gross profit', money(p.grossProfit), M.deltaHTML(M.pctDelta(p.grossProfit, q.grossProfit), label), 'trend', 'green', `${p.margin.toFixed(1)}% margin`),
        kpiCard('Expenses', money(p.expenses), inverseDelta(M.pctDelta(p.expenses, q.expenses), label), 'trend-down', 'pink', `${A.plural(p.expList.length, 'entry', 'entries')}`),
        kpiCard('Net profit', money(p.net), M.deltaHTML(M.pctDelta(p.net, q.net), label), 'bank', 'blue', p.revenue ? `${((p.net / p.revenue) * 100).toFixed(1)}% of revenue` : '')
      ].join('');

      $('#f-total').textContent = money(p.revenue);
      $('#f-delta').innerHTML = M.deltaHTML(M.pctDelta(p.revenue, q.revenue), label);
      A.charts.stacked($('#f-rev'), channelSeries(r[0], r[1]), Admin.CH_SERIES, { height: 270 });

      $('#f-pnl').innerHTML = pnlHTML(p);

      const bal = S.balances(); const liquid = sum(S.accounts(), (a) => bal[a.id] || 0);
      const dues = sum(S.dueList(), (d) => d.due);
      const cod = sum(S.parcels().filter((o) => o.ship.status === 'transit'), (o) => o.ship.cod || 0);
      const stock = S.valuation().cost; const fabric = S.fabricValue();
      const wip = sum(S.inProduction(), (b) => b.yards * b.rate);
      $('#f-pos').innerHTML = `<div class="pl">
        ${S.accounts().map((a) => plRow(esc(a.name), money(bal[a.id] || 0), 'indent')).join('')}
        ${plRow('Money in hand and bank', money(liquid), 'sum')}
        ${plRow('Customer dues', '+ ' + money(dues), '', 'Credit sales not yet collected')}
        ${plRow('Cash on delivery in transit', '+ ' + money(cod), '', 'Parcels with Pathao / Steadfast, not yet delivered')}
        ${plRow('Fabric in warehouse', '+ ' + money(fabric), '', 'At average cost per yard')}
        ${plRow('Fabric in production', '+ ' + money(wip), '', 'Batches being cut or stitched')}
        ${plRow('Showroom stock at cost', '+ ' + money(stock))}
        ${plRow('Estimated business value', money(liquid + dues + cod + fabric + wip + stock), 'sum grand')}</div>`;

      const locRows = S.channelRows(r[0], r[1]).map((x) => [x.label, x.revenue]);
      A.charts.hbars($('#f-loc'), locRows.map(([l, v]) => ({ label: l, value: v, display: `${money(v)}${p.revenue ? ` · ${Math.round((v / p.revenue) * 100)}%` : ''}` })));
      const cats = Object.entries(p.byCat).sort((a, b) => b[1] - a[1]);
      if (cats.length) A.charts.hbars($('#f-exp'), cats.map(([l, v]) => ({ label: l, value: v, display: `${money(v)} · ${Math.round((v / p.expenses) * 100)}%` })));
      else $('#f-exp').innerHTML = '<p class="muted small">No expenses recorded in this period.</p>';
    };
    sel.addEventListener('change', render);
    render();
  };

  /* ======================================================================
     Expenses
     ====================================================================== */
  P.expenses = () => {
    const kp = () => {
      const m = S.range('month'); const t30 = S.range('30');
      const month = S.expenses().filter((e) => S.within(e.date, m[0], m[1]));
      const last = S.expenses().filter((e) => S.within(e.date, t30[0], t30[1]));
      const by = {}; last.forEach((e) => { by[e.category] = (by[e.category] || 0) + e.amount; });
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      $('#exp-kpis').innerHTML = [['This month', money(sum(month, (e) => e.amount))], ['Last 30 days', money(sum(last, (e) => e.amount))], ['Biggest category (30 days)', top ? `${esc(top[0])} · ${money(top[1])}` : '—']]
        .map(([l, v]) => `<div class="card kpi-lite"><span class="kpi-label">${l}</span><b class="num">${v}</b></div>`).join('');
    };
    kp();

    const edit = (id, api) => {
      const e = id ? S.expenses().find((x) => String(x.id) === String(id)) : null;
      const m = A.modal({
        title: e ? 'Edit expense' : 'Add expense',
        body: `<form id="ef" class="form-grid2" novalidate>
          <div class="field"><label for="ex-date">Date</label><input id="ex-date" name="date" type="date" value="${e ? A.ymd(e.date) : today()}" max="${today()}"></div>
          <div class="field"><label for="ex-amount">Amount (৳) *</label><input id="ex-amount" name="amount" type="number" min="1" value="${e ? e.amount : ''}" placeholder="0"><span class="msg">Enter an amount above 0.</span></div>
          <div class="field"><label for="ex-cat">Category</label><select id="ex-cat" name="category">${S.expenseCats.map((c) => `<option ${e && e.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label for="ex-acc">Paid from</label><select id="ex-acc" name="account">${Admin.accountOptions(e ? e.account : 'cash')}</select></div>
          <div class="field"><label for="ex-vendor">Paid to</label><input id="ex-vendor" name="vendor" value="${esc(e ? e.vendor || '' : '')}" placeholder="Vendor or person"></div>
          <div class="field full"><label for="ex-note">Note</label><input id="ex-note" name="note" value="${esc(e ? e.note || '' : '')}" placeholder="Optional"></div></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save expense</button>'
      });
      const f = $('#ef', m.el).elements;
      m.el.addEventListener('click', (ev) => {
        if (!ev.target.closest('[data-save]')) return;
        const amount = Math.round(Number(f.amount.value));
        f.amount.closest('.field').classList.toggle('err', !(amount > 0));
        if (!(amount > 0)) { f.amount.focus(); return; }
        const rec = { date: new Date((f.date.value || today()) + 'T12:00:00').toISOString(), category: f.category.value, amount, account: f.account.value, loc: 's1', vendor: f.vendor.value.trim(), note: f.note.value.trim() };
        if (e) S.patchExpense(e.id, rec); else S.addExpense(rec);
        m.close(); api.refresh(); kp(); A.toast(e ? 'Expense updated' : 'Expense added');
      });
    };

    const api = Admin.listTable({
      id: 'expenses', mount: $('#list'), perPage: 12, empty: 'No expenses found', searchPlaceholder: 'Search expenses',
      rows: () => S.expenses().slice().sort((a, b) => new Date(b.date) - new Date(a.date)), rowId: (x) => x.id,
      initialQ: A.qs.get('q') || '',
      views: [{ id: 'all', label: 'All' }, { id: 'cash', label: 'Paid in cash', filter: (x) => x.account === 'cash' }, { id: 'bank', label: 'Bank and wallets', filter: (x) => x.account !== 'cash' }],
      filters: [
        { id: 'cat', label: 'All categories', options: S.expenseCats.map((c) => [c, c]), test: (x, v) => x.category === v },
        { id: 'month', label: 'All time', options: [['month', 'This month'], ['lastmonth', 'Last month'], ['30', 'Last 30 days']], test: (x, v) => { const r = S.range(v); return S.within(x.date, r[0], r[1]); } }
      ],
      search: (x, q) => [x.category, x.vendor, x.note].join(' ').toLowerCase().includes(q),
      bulk: [{ id: 'delete', label: 'Delete', confirm: 'Delete the selected expenses?', run: (ids) => { S.deleteExpenses(ids.map(Number)); kp(); A.toast('Expenses deleted'); } }],
      columns: [
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (x) => `<b class="row-title">${A.date(x.date)}</b>${Admin.actions([{ label: 'Edit', act: 'edit', id: x.id }, { label: 'Delete', act: 'del', id: x.id, danger: true }])}` },
        { id: 'cat', label: 'Category', sort: (a, b) => a.category.localeCompare(b.category), render: (x) => `<span class="badge b-violet">${esc(x.category)}</span>` },
        { id: 'vendor', label: 'Paid to', render: (x) => `${esc(x.vendor || '—')}${x.note ? `<div class="xs muted">${esc(x.note)}</div>` : ''}` },
        { id: 'acc', label: 'Paid from', render: (x) => esc(S.accountName(x.account)) },
        { id: 'amount', label: 'Amount', cls: 'right', sort: (a, b) => a.amount - b.amount, render: (x) => `<b class="num">${money(x.amount)}</b>` }
      ],
      actions: {
        edit: (id, x, a) => edit(id, a),
        del: (id, x, a) => A.confirm('Delete this expense? Account balances will be restored.', 'Delete').then((ok) => { if (ok) { S.deleteExpenses([x.id]); a.refresh(); kp(); A.toast('Expense deleted'); } })
      }
    });
    $('#add-exp').addEventListener('click', () => edit(null, api));
    $('#exp-export').addEventListener('click', () => Admin.csv('amnu-expenses.csv', [['Date', 'Category', 'Paid to', 'Paid from', 'Amount', 'Note']].concat(S.expenses().map((x) => [A.ymd(x.date), x.category, x.vendor || '', S.accountName(x.account), x.amount, x.note || '']))));
    if (A.qs.get('new')) edit(null, api);
  };

  /* ======================================================================
     Accounts & ledger
     ====================================================================== */
  P.accounts = () => {
    const KIND = { cod: ['Cash on delivery', 'b-ok'], 'courier-fee': ['Courier charge', 'b-err'], payout: ['Courier payout', 'b-violet'], production: ['Making cost', 'b-warn'], sale: ['Sale', 'b-ok'], expense: ['Expense', 'b-err'], fabric: ['Fabric purchase', 'b-warn'], transfer: ['Transfer', 'b-violet'], income: ['Income', 'b-info'], due: ['Due collected', 'b-ok'], opening: ['Opening', ''] };
    const ICON = { cash: 'coins', bank: 'bank', mfs: 'phone', courier: 'truck' };
    const cards = () => {
      const bal = S.balances(); const r = S.range('30');
      const rows = S.ledger({ from: r[0], to: r[1] });
      $('#acc-cards').innerHTML = S.accounts().map((a) => {
        const inn = sum(rows.filter((x) => x.account === a.id && x.dir > 0), (x) => x.amount); const out = sum(rows.filter((x) => x.account === a.id && x.dir < 0), (x) => x.amount);
        return `<button class="card acc-card" type="button" data-acc="${a.id}"><span class="acc-ico">${icon(ICON[a.type] || 'coins', 22)}</span><span class="grow"><span class="kpi-label">${esc(a.name)}</span><b class="num acc-bal ${bal[a.id] < 0 ? 'err' : ''}">${money(bal[a.id] || 0)}</b><span class="xs muted acc-flow"><span>30 days</span><span class="ok">+${money(inn)}</span><span class="err">−${money(out)}</span></span></span></button>`;
      }).join('') + `<div class="card acc-card total"><span class="grow"><span class="kpi-label">Total across accounts</span><b class="num acc-bal">${money(sum(S.accounts(), (a) => bal[a.id] || 0))}</b><span class="xs muted">Cash + bank + wallets</span></span></div>`;
    };
    cards();

    const api = Admin.listTable({
      id: 'ledger', mount: $('#list'), perPage: 15, empty: 'No transactions', searchPlaceholder: 'Search the ledger',
      rows: () => S.ledger().map((e, i) => Object.assign({ _id: i }, e)), rowId: (e) => e._id,
      views: [{ id: 'all', label: 'All' }, { id: 'in', label: 'Money in', filter: (e) => e.dir > 0 }, { id: 'out', label: 'Money out', filter: (e) => e.dir < 0 }],
      filters: [
        { id: 'acc', label: 'All accounts', options: S.accounts().map((a) => [a.id, a.name]), test: (e, v) => e.account === v },
        { id: 'kind', label: 'All types', options: Object.entries(KIND).map(([k, v]) => [k, v[0]]), test: (e, v) => e.kind === v },
        { id: 'range', label: 'All time', options: [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month']], test: (e, v) => { const r = S.range(v); return S.within(e.date, r[0], r[1]); } }
      ],
      search: (e, q) => (e.label + ' ' + e.ref + ' ' + S.accountName(e.account)).toLowerCase().includes(q),
      columns: [
        { id: 'date', label: 'Date', sort: (a, b) => new Date(a.date) - new Date(b.date), render: (e) => `<span class="small">${A.dateTime(e.date)}</span>` },
        { id: 'label', label: 'Description', render: (e) => `${e.orderId ? `<a class="row-title" href="order-view.html?id=${e.orderId}">${esc(e.label)}</a>` : `<span class="row-title">${esc(e.label)}</span>`}` },
        { id: 'acc', label: 'Account', render: (e) => esc(S.accountName(e.account)) },
        { id: 'kind', label: 'Type', render: (e) => { const k = KIND[e.kind] || [e.kind, '']; return `<span class="badge ${k[1]}">${esc(k[0])}</span>`; } },
        { id: 'in', label: 'Money in', cls: 'right', sort: (a, b) => a.dir * a.amount - b.dir * b.amount, render: (e) => (e.dir > 0 ? `<b class="num ok">+${money(e.amount)}</b>` : '') },
        { id: 'out', label: 'Money out', cls: 'right', render: (e) => (e.dir < 0 ? `<b class="num err">−${money(e.amount)}</b>` : '') }
      ]
    });
    const refreshAll = () => { api.refresh(); cards(); };
    $('#acc-cards').addEventListener('click', (e) => {
      const c = e.target.closest('[data-acc]'); if (!c) return;
      const st = api.state; st.filters.acc = st.filters.acc === c.dataset.acc ? '' : c.dataset.acc; st.page = 1;
      $('[data-filter="acc"]', $('#list')).value = st.filters.acc; api.refresh();
      $$('#acc-cards .acc-card').forEach((x) => x.classList.toggle('on', !!st.filters.acc && x.dataset.acc === st.filters.acc));
      $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const transfer = () => {
      const m = A.modal({
        title: 'Transfer between accounts',
        body: `<div class="form-grid2"><div class="field"><label for="tr-from">From</label><select id="tr-from">${Admin.accountOptions('cash')}</select></div><div class="field"><label for="tr-to">To</label><select id="tr-to">${Admin.accountOptions('bank')}</select></div>
          <div class="field"><label for="tr-amt">Amount (৳) *</label><input id="tr-amt" type="number" min="1" placeholder="0"><span class="msg" id="tr-msg">Enter an amount above 0.</span></div><div class="field"><label for="tr-note">Note</label><input id="tr-note" placeholder="e.g. Bank deposit"></div></div><p class="xs muted" id="tr-bal"></p>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Transfer</button>'
      });
      const bal = S.balances();
      const hint = () => { $('#tr-bal', m.el).textContent = `Available in ${S.accountName($('#tr-from', m.el).value)}: ${money(bal[$('#tr-from', m.el).value] || 0)}`; };
      m.el.addEventListener('change', hint); hint();
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const from = $('#tr-from', m.el).value; const to = $('#tr-to', m.el).value; const amount = Math.round(Number($('#tr-amt', m.el).value));
        const fld = $('#tr-amt', m.el).closest('.field');
        if (from === to) { A.toast('Choose two different accounts', 'err'); return; }
        if (!(amount > 0)) { fld.classList.add('err'); return; }
        if (amount > (bal[from] || 0)) { A.toast(`Not enough in ${S.accountName(from)}`, 'err'); return; }
        S.addTransfer({ from, to, amount, note: $('#tr-note', m.el).value.trim() });
        m.close(); refreshAll(); A.toast(`Moved ${money(amount)} to ${S.accountName(to)}`);
      });
    };
    const income = () => {
      const m = A.modal({
        title: 'Record other income',
        body: `<div class="form-grid2"><div class="field full"><label for="in-src">Source *</label><input id="in-src" placeholder="e.g. Tailoring service, scrap sale"><span class="msg">Enter a source.</span></div><div class="field"><label for="in-amt">Amount (৳) *</label><input id="in-amt" type="number" min="1" placeholder="0"><span class="msg">Enter an amount above 0.</span></div><div class="field"><label for="in-acc">Received in</label><select id="in-acc">${Admin.accountOptions('cash')}</select></div><div class="field full"><label for="in-note">Note</label><input id="in-note" placeholder="Optional"></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Save income</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const source = $('#in-src', m.el).value.trim(); const amount = Math.round(Number($('#in-amt', m.el).value));
        $('#in-src', m.el).closest('.field').classList.toggle('err', !source); $('#in-amt', m.el).closest('.field').classList.toggle('err', !(amount > 0));
        if (!source || !(amount > 0)) return;
        S.addIncome({ source, amount, account: $('#in-acc', m.el).value, note: $('#in-note', m.el).value.trim() });
        m.close(); refreshAll(); A.toast('Income recorded');
      });
    };
    const addAccount = () => {
      const m = A.modal({
        title: 'Add account',
        body: `<div class="form-grid2"><div class="field full"><label for="ac-name">Account name *</label><input id="ac-name" placeholder="e.g. Rocket wallet"><span class="msg">Enter a name.</span></div><div class="field"><label for="ac-type">Type</label><select id="ac-type"><option value="bank">Bank</option><option value="mfs">Mobile wallet</option><option value="cash">Cash</option></select></div><div class="field"><label for="ac-open">Opening balance (৳)</label><input id="ac-open" type="number" value="0"></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Add account</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const name = $('#ac-name', m.el).value.trim();
        $('#ac-name', m.el).closest('.field').classList.toggle('err', !name);
        if (!name) return;
        const list = S.accounts(); const id = A.slug(name) || 'acc' + A.uid().slice(0, 3);
        if (list.some((a) => a.id === id)) { A.toast('An account with that name exists', 'err'); return; }
        list.push({ id, name, type: $('#ac-type', m.el).value, opening: Number($('#ac-open', m.el).value) || 0 });
        S.saveAccounts(list); m.close(); refreshAll(); A.toast('Account added');
      });
    };
    $('#add-transfer').addEventListener('click', transfer);
    $('#add-income').addEventListener('click', income);
    $('#add-account').addEventListener('click', addAccount);
    $('#acc-export').addEventListener('click', () => Admin.csv('amnu-ledger.csv', [['Date', 'Description', 'Account', 'Type', 'Money in', 'Money out']].concat(S.ledger().map((e) => [A.dateTime(e.date), e.label, S.accountName(e.account), (KIND[e.kind] || [e.kind])[0], e.dir > 0 ? e.amount : '', e.dir < 0 ? e.amount : '']))));
  };

  /* ======================================================================
     Reports
     ====================================================================== */
  const n = (v) => ({ n: v });                           /* money cell: shown as ৳, exported as a number */
  const cellHTML = (c) => (c && typeof c === 'object' ? money(c.n) : typeof c === 'number' ? c.toLocaleString('en-IN') : c == null ? '' : c);
  const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const cellCSV = (c) => (c && typeof c === 'object' ? c.n : typeof c === 'number' ? c : plain(c == null ? '' : c));
  const isNum = (c) => typeof c === 'number' || (c && typeof c === 'object');
  const sec = (title, head, rows, foot) => ({ title, head, rows, foot });
  const secHTML = (s) => {
    const right = (s.rows[0] || s.foot || []).map(isNum);
    const tr = (cells, tag = 'td') => `<tr>${cells.map((c, i) => `<${tag} class="${right[i] ? 'right' : ''}">${cellHTML(c)}</${tag}>`).join('')}</tr>`;
    return `<h3 class="sub-h rep-h">${esc(s.title)}</h3><div class="table-wrap"><table class="mini-table rep-table"><thead><tr>${s.head.map((h, i) => `<th class="${right[i] ? 'right' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r) => tr(r)).join('') || `<tr><td colspan="${s.head.length}" class="muted">Nothing to show for this period.</td></tr>`}</tbody>${s.foot ? `<tfoot>${tr(s.foot)}</tfoot>` : ''}</table></div>`;
  };

  const REPORTS = {
    sales: (r) => {
      const orders = ordersIn(r[0], r[1]);
      const days = eachDay(r[0], r[1]).map((t) => {
        const o = orders.filter((x) => M.startOf(x.date) === t);
        const g = CHS.map((c) => o.filter((x) => S.channelOf(x) === c));
        return [A.date(t)].concat(g.map((x) => x.length), g.map((x) => n(sum(x, rev))), [n(sum(o, (x) => x.discount || 0)), n(sum(o, rev))]);
      }).filter((row) => row[1] + row[2] + row[3] > 0);
      const foot = ['Total'].concat([1, 2, 3].map((k) => sum(days, (d) => d[k])), [4, 5, 6, 7, 8].map((k) => n(sum(days, (d) => d[k].n))));
      const prod = new Map();
      orders.forEach((o) => o.items.forEach((i) => { const e = prod.get(i.name) || { q: 0, v: 0 }; e.q += i.qty; e.v += i.price * i.qty; prod.set(i.name, e); }));
      const pay = {}; orders.forEach((o) => S.tenders(o).forEach((t) => { pay[t.method] = (pay[t.method] || 0) + t.amount; }));
      return [
        sec('Sales by day', ['Date', 'Showroom orders', 'Website orders', 'Social orders', 'Showroom revenue', 'Website revenue', 'Social revenue', 'Discounts', 'Total revenue'], days, foot),
        sec('Sales by channel', ['Channel', 'Orders', 'Pieces', 'Revenue', 'Share'], S.channelRows(r[0], r[1]).map((x, i, all) => [esc(x.label), x.orders, x.pieces, n(x.revenue), Math.round((x.revenue / Math.max(1, sum(all, (y) => y.revenue))) * 100) + '%'])),
        sec('Best sellers', ['Product', 'Units sold', 'Sales'], [...prod].sort((a, b) => b[1].v - a[1].v).slice(0, 10).map(([name, e]) => [esc(name), e.q, n(e.v)])),
        sec('Payments received by method', ['Method', 'Amount'], Object.entries(pay).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(S.payLabel[k] || k), n(v)]), ['Total', n(sum(Object.values(pay)))])
      ];
    },
    pnl: (r) => {
      const p = S.pnl(r[0], r[1]); const cs = CHS.map((c) => p.ch[c]);
      const cats = Object.entries(p.byCat).sort((a, b) => b[1] - a[1]);
      const row = (label, f, total) => [label].concat(cs.map(f), [total]);
      const pct = (c) => (c.revenue ? ((c.revenue - c.cogs) / c.revenue * 100).toFixed(1) : '0.0') + '%';
      return [
        sec('Profit & loss by channel', ['', 'Showroom', 'Website', 'Social media', 'Total'], [
          row('Orders', (c) => c.orders, p.orders), row('Pieces sold', (c) => c.pieces, sum(cs, (c) => c.pieces)),
          row('Sales revenue', (c) => n(c.revenue), n(p.revenue)), row('Discounts given', (c) => n(c.discount), n(sum(cs, (c) => c.discount))),
          row('Cost of goods sold', (c) => n(c.cogs), n(p.cogs)), row('Gross profit', (c) => n(c.revenue - c.cogs), n(p.grossProfit)),
          row('Gross margin', pct, p.margin.toFixed(1) + '%'), row('Delivery charges collected', (c) => n(c.shipping), n(p.shipping))
        ]),
        sec('Operating expenses', ['Category', 'Amount', 'Share'], cats.map(([c, v]) => [esc(c), n(v), Math.round((v / p.expenses) * 100) + '%']), ['Total expenses', n(p.expenses), '']),
        sec('Result', ['', 'Amount'], [['Gross profit', n(p.grossProfit)], ['Delivery charges collected', n(p.shipping)], ['Operating expenses', n(-p.expenses)]], ['Net profit', n(p.net)])
      ];
    },
    expenses: (r) => {
      const list = S.expenses().filter((e) => S.within(e.date, r[0], r[1])).sort((a, b) => new Date(b.date) - new Date(a.date));
      const by = {}; list.forEach((e) => { by[e.category] = (by[e.category] || 0) + e.amount; });
      const total = sum(list, (e) => e.amount);
      return [
        sec('By category', ['Category', 'Entries', 'Amount', 'Share'], Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => [esc(c), list.filter((e) => e.category === c).length, n(v), Math.round((v / total) * 100) + '%']), ['Total', list.length, n(total), '']),
        sec('All entries', ['Date', 'Category', 'Paid to', 'Paid from', 'Amount'], list.map((e) => [A.date(e.date), esc(e.category), esc(e.vendor || ''), esc(S.accountName(e.account)), n(e.amount)]))
      ];
    },
    stock: () => {
      const v = S.valuation();
      return [sec('Stock valuation (today)', ['SKU', 'Product', 'Unit cost', 'Units', 'Cost value', 'Retail value'],
        v.rows.filter((x) => x.qty > 0).sort((a, b) => b.cost - a.cost).map((x) => [esc(x.p.sku), esc(x.p.name), n(x.p.cost || 0), x.qty, n(x.cost), n(x.retail)]),
        ['', 'Total', '', v.qty, n(v.cost), n(v.retail)])];
    },
    vat: (r) => {
      const cfg = S.settings(); const orders = ordersIn(r[0], r[1]);
      const days = eachDay(r[0], r[1]).map((t) => { const o = orders.filter((x) => M.startOf(x.date) === t); return [A.date(t), o.length, n(sum(o, rev)), n(sum(o, (x) => x.vat || 0))]; }).filter((x) => x[1] > 0);
      return [sec(`VAT collected · rate ${cfg.vatRate}%${cfg.bin ? ' · BIN ' + cfg.bin : ''}`, ['Date', 'Orders', 'Taxable sales', 'VAT collected'], days, ['Total', sum(days, (d) => d[1]), n(sum(days, (d) => d[2].n)), n(sum(days, (d) => d[3].n))])];
    },
    fabric: (r) => {
      const fs = S.fabrics();
      const moves = S.fabricMoves().filter((m) => S.within(m.date, r[0], r[1]));
      const used = (id, why) => sum(moves.filter((m) => m.fabricId === id && m.reason === why), (m) => Math.abs(m.delta));
      return [
        sec('Fabric in the warehouse (today)', ['Fabric', 'In stock (yd)', 'In stock (in)', 'Cost / yd', 'Value', 'Status'], fs.map((f) => [esc(f.name), f.stock, Math.round(f.stock * 36), n(f.rate), n(f.stock * f.rate), S.fabricLow(f) ? '<span class="err">Low</span>' : 'OK']), ['Total', r2s(sum(fs, (f) => f.stock)), Math.round(sum(fs, (f) => f.stock) * 36), '', n(S.fabricValue()), '']),
        sec('Fabric in and out in this period (yards)', ['Fabric', 'Bought', 'Sent to production', 'Wastage', 'Counted / found'], fs.map((f) => [esc(f.name), r2s(used(f.id, 'purchase')), r2s(used(f.id, 'production')), r2s(used(f.id, 'wastage')), r2s(used(f.id, 'stocktake') + used(f.id, 'found'))])),
        sec('Production finished in this period', ['Batch', 'Design', 'Pieces', 'Fabric (yd)', 'Cost / piece', 'Batch cost'], S.batches().filter((b) => b.status === 'ready' && S.within(b.readyAt, r[0], r[1])).map((b) => [b.id, esc((S.product(b.productId) || {}).name || ''), b.qty, b.yards, n(S.batchUnitCost(b)), n(S.batchCost(b))]))
      ];
    },
    couriers: (r) => {
      const cs = S.couriers().map((c) => Object.assign({ c }, S.courierStats(c.id, r[0], r[1])));
      return [
        sec('Couriers in this period', ['Courier', 'Delivered', 'Cash collected', 'Returned', 'Return rate', 'Charges', 'Paid out to you', 'Balance now'], cs.map((x) => [esc(x.c.name), x.delivered, n(x.collected), x.returned, x.returnRate.toFixed(1) + '%', n(x.fees), n(x.paidOut), n(x.balance)]),
          ['Total', sum(cs, (x) => x.delivered), n(sum(cs, (x) => x.collected)), sum(cs, (x) => x.returned), '', n(sum(cs, (x) => x.fees)), n(sum(cs, (x) => x.paidOut)), n(sum(cs, (x) => x.balance))]),
        sec('Delivery charges: collected vs paid', ['', 'Amount'], (() => { const p = S.pnl(r[0], r[1]); return [['Charged to customers', n(p.shipping)], ['Paid to couriers (delivery + COD %)', n(p.courier.delivery + p.courier.cod)], ['Return charges', n(p.courier.returns)]]; })(), (() => { const p = S.pnl(r[0], r[1]); return ['Net delivery result', n(p.shipping - p.courier.total)]; })())
      ];
    },
    dues: () => {
      const dues = S.dueList();
      return [
        sec('Customers who owe us', ['Customer', 'Phone', 'Orders', 'Outstanding'], dues.map((d) => [esc(d.name), esc(d.phone), d.orders.length, n(d.due)]), ['Total receivable', '', sum(dues, (d) => d.orders.length), n(sum(dues, (d) => d.due))])
      ];
    }
  };
  const r2s = (x) => Math.round(x * 100) / 100;
  const TITLES = { fabric: 'Fabric & production', couriers: 'Couriers & delivery', sales: 'Sales report', pnl: 'Profit & loss statement', expenses: 'Expenses report', stock: 'Stock valuation', vat: 'VAT report', dues: 'Customer dues' };

  P.reports = () => {
    const st = { tab: DB.get('rep.tab', 'sales'), range: DB.get('rep.range', '30') };
    if (!REPORTS[st.tab]) st.tab = 'sales';
    const sel = $('#rep-range'); sel.value = st.range;
    let secs = [];
    const render = () => {
      DB.set('rep.tab', st.tab); DB.set('rep.range', st.range);
      $$('#rep-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === st.tab));
      const r = S.range(st.range);
      secs = REPORTS[st.tab](r);
      const timeless = st.tab === 'stock' || st.tab === 'dues';
      sel.hidden = timeless;
      $('#rep-body').innerHTML = `<div class="rep-head"><div><h2>${TITLES[st.tab]}</h2><p class="muted small">${S.settings().storeName} · ${timeless ? 'As of ' + A.date(Date.now()) : fmtRange(r)}</p></div><span class="xs muted">Generated ${A.dateTime(Date.now())}</span></div>${secs.map(secHTML).join('')}${st.tab === 'vat' && !S.settings().vatRate ? '<p class="empty-note small muted">VAT is switched off (rate 0%). Set a rate in Settings → Store &amp; POS to start collecting it on store and online orders.</p>' : ''}`;
    };
    $('#rep-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { st.tab = b.dataset.tab; render(); } });
    sel.addEventListener('change', () => { st.range = sel.value; render(); });
    $('#rep-print').addEventListener('click', () => window.print());
    $('#rep-csv').addEventListener('click', () => {
      const rows = [[TITLES[st.tab]], []];
      secs.forEach((s) => { rows.push([s.title], s.head, ...s.rows.map((r) => r.map(cellCSV))); if (s.foot) rows.push(s.foot.map(cellCSV)); rows.push([]); });
      Admin.csv(`amnu-${st.tab}-report.csv`, rows);
    });
    render();
  };

  /* ======================================================================
     Loyalty points
     ====================================================================== */
  P.loyalty = () => {
    const cfg = () => S.settings().loyalty;
    const members = () => S.customers().filter((c) => c.phone).map((c) => Object.assign({}, c, { pts: S.points(c.phone) }));
    const kp = () => {
      const mem = members();
      const out = sum(mem, (c) => c.pts.balance);
      $('#loy-kpis').innerHTML = [
        kpiCard('Members with points', mem.filter((c) => c.pts.balance > 0).length, '', 'users', 'violet', `${mem.length} customers with a phone number`),
        kpiCard('Points outstanding', out.toLocaleString('en-IN'), '', 'sparkle', 'green', `Worth ${money(out * cfg().pointValue)} at today's rate`),
        kpiCard('Points redeemed', sum(mem, (c) => c.pts.used).toLocaleString('en-IN'), '', 'tag', 'blue', 'Across online and store orders')
      ].join('');
    };
    kp();

    const f = $('#loy-form').elements;
    const fill = () => { $('#l-earn').value = cfg().earnPer; $('#l-val').value = cfg().pointValue; $('#l-min').value = cfg().minRedeem; };
    fill();
    $('#loy-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const earnPer = Math.round(Number($('#l-earn').value)); const pointValue = Number($('#l-val').value); const minRedeem = Math.max(0, Math.round(Number($('#l-min').value) || 0));
      $('#l-earn').closest('.field').classList.toggle('err', !(earnPer >= 1));
      if (!(earnPer >= 1) || !(pointValue > 0)) { A.toast('Check the highlighted values', 'err'); return; }
      S.saveSettings({ loyalty: Object.assign({}, cfg(), { earnPer, pointValue, minRedeem }) });
      kp(); members_api.refresh(); A.toast('Loyalty programme saved');
    });
    void f;

    /* members + manual point adjustments */
    const adjust = (phone, api) => {
      const c = members().find((x) => x.phone === phone); if (!c) return;
      const m = A.modal({
        title: `Adjust points · ${c.name}`,
        body: `<p class="small muted">Current balance: <b>${c.pts.balance} points</b> (${money(c.pts.value)}). Use a negative number to remove points.</p><div class="form-grid2" style="margin-top:10px"><div class="field"><label for="pa-d">Points to add or remove</label><input id="pa-d" type="number" placeholder="e.g. 50 or -20"></div><div class="field"><label for="pa-r">Reason</label><input id="pa-r" placeholder="e.g. Goodwill"></div></div>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-violet" data-save>Apply</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const d = Math.round(Number($('#pa-d', m.el).value));
        if (!d) { A.toast('Enter a number of points', 'err'); return; }
        if (c.pts.balance + d < 0) { A.toast('That would take the balance below zero', 'err'); return; }
        S.adjustPoints(phone, d); m.close(); api.refresh(); kp(); A.toast(`${d > 0 ? '+' : ''}${d} points for ${c.name}`);
      });
    };
    const members_api = Admin.listTable({
      id: 'members', mount: $('#members'), perPage: 8, empty: 'No members yet', searchPlaceholder: 'Search members',
      rows: members, rowId: (c) => c.phone, search: (c, q) => (c.name + c.phone).toLowerCase().includes(q), sort: { col: 'bal', dir: 'desc' },
      views: [{ id: 'all', label: 'All members' }, { id: 'pts', label: 'With points', filter: (c) => c.pts.balance > 0 }],
      columns: [
        { id: 'name', label: 'Member', sort: (a, b) => a.name.localeCompare(b.name), render: (c) => `<div class="row gap-8">${Admin.avatar(c.name, 'sm')}<div><b class="row-title">${esc(c.name)}</b><div class="xs muted mono">${esc(c.phone)}</div></div></div>${Admin.actions([{ label: 'Adjust points', act: 'adj', id: c.phone }])}` },
        { id: 'earned', label: 'Earned', cls: 'right', render: (c) => `<span class="num">${c.pts.earned}</span>` },
        { id: 'used', label: 'Used', cls: 'right', render: (c) => `<span class="num">${c.pts.used}</span>` },
        { id: 'bal', label: 'Balance', cls: 'right', sort: (a, b) => a.pts.balance - b.pts.balance, render: (c) => `<b class="num">${c.pts.balance}</b><div class="xs muted">${money(c.pts.value)}</div>` }
      ],
      actions: { adj: (phone, c, a) => adjust(phone, a) }
    });
  };
})();
