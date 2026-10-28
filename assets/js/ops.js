/* ==========================================================================
   AMNO Fashion — store operations layer (extends Amnu.store)
   Showroom stock (per size) · accounts & ledger · expenses ·
   fabric purchases · day close · P&L.
   Fabric warehouse, production and courier parcels live in prod.js.
   DEMO data: swap these methods for calls to your backend.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const DAY = 864e5;

  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  A.ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const ymd = A.ymd;
  const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d.getTime(); };
  const sum = (arr, f) => arr.reduce((n, x) => n + (f ? f(x) : x), 0);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const isValid = S.isLive;
  S.isValidOrder = isValid;

  /* ======================================================================
     One store location: it holds the stock and fulfils online orders.
     ====================================================================== */
  const SEED_LOCATIONS = [
    { id: 's1', name: 'AMNO Store', type: 'showroom', address: 'House 00, Road 00, Dhanmondi, Dhaka', district: 'Dhaka', phone: '+880 1700-000011', hours: 'Sat – Thu · 10:00 am – 9:00 pm', manager: 'Rafi Hossain', active: true }
  ];
  S.locations = () => DB.get('locations', null) || (DB.set('locations', SEED_LOCATIONS), clone(SEED_LOCATIONS));
  S.saveLocations = (l) => DB.set('locations', l);
  S.location = (id) => S.locations().find((l) => l.id === id);
  S.locName = (id) => (S.location(id) || { name: id === 'all' ? 'All locations' : id }).name;
  S.onlineLoc = () => S.settings().onlineLoc || 's1';
  S.showrooms = () => S.locations().filter((l) => l.type === 'showroom' && l.active !== false);

  /* ======================================================================
     Inventory: { productId: { locationId: { size: qty } } }
     ====================================================================== */
  const SIZE_W = { S: 0.6, M: 1.2, L: 1.4, XL: 1, XXL: 0.6, '2Y': 1, '4Y': 1, '6Y': 1, '8Y': 0.9, '10Y': 0.8 };
  const CHEST = { S: 38, M: 40, L: 42, XL: 44, XXL: 46 };
  S.sizeLabel = (size) => (CHEST[size] ? `${size}/${CHEST[size]}` : size);

  function distribute(sizes, qty, r) {
    const out = {};
    sizes.forEach((s) => { out[s] = 0; });
    const w = sizes.map((s) => SIZE_W[s] || 1);
    const total = sum(w);
    for (let i = 0; i < qty; i++) {
      let x = r() * total; let k = 0;
      while (k < sizes.length - 1 && x > w[k]) { x -= w[k]; k++; }
      out[sizes[k]] += 1;
    }
    return out;
  }
  function seedInventory() {
    const inv = {};
    const shares = [['s1', 1]];
    S.seedProducts.forEach((p) => {
      const r = rng(p.id * 131 + 7);
      inv[p.id] = {};
      let left = p.stock;
      shares.forEach(([loc, share], i) => {
        const q = i === shares.length - 1 ? left : Math.min(left, Math.round(p.stock * share));
        left -= q;
        inv[p.id][loc] = distribute(p.sizes, q, r);
      });
    });
    return inv;
  }
  S.inv = () => { let v = DB.get('inventory', null); if (!v) { v = seedInventory(); DB.set('inventory', v); } return v; };
  S.saveInv = (v) => DB.set('inventory', v);
  S.stockBySize = (pid, loc) => ((S.inv()[pid] || {})[loc === 'online' ? S.onlineLoc() : loc]) || {};
  /** loc: id | 'online' | null (all locations); size optional */
  S.stock = (pid, loc, size) => {
    const byLoc = S.inv()[pid] || {};
    const tot = (o) => sum(Object.values(o || {}));
    if (loc == null) return size == null ? sum(Object.values(byLoc), tot) : sum(Object.values(byLoc), (m) => (m || {})[size] || 0);
    const m = byLoc[loc === 'online' ? S.onlineLoc() : loc] || {};
    return size == null ? tot(m) : (m[size] || 0);
  };
  S.onlineStock = (pid, size) => S.stock(pid, 'online', size);
  S.syncStock = (pid, inv) => {
    const list = S.products();
    const p = list.find((x) => x.id === pid);
    if (!p) return;
    p.stock = sum(Object.values((inv || S.inv())[pid] || {}), (o) => sum(Object.values(o)));
    S.saveProducts(list);
  };

  S.moves = () => DB.get('moves', []);
  function logMove(m) {
    const list = S.moves();
    list.unshift(Object.assign({ id: A.uid(), date: new Date().toISOString(), by: 'System' }, m));
    DB.set('moves', list.slice(0, 400));
  }
  /** change one cell; never below 0; returns the actual delta applied */
  S.adjust = (pid, loc, size, delta, reason, meta) => {
    const inv = S.inv();
    inv[pid] = inv[pid] || {};
    inv[pid][loc] = inv[pid][loc] || {};
    const cur = inv[pid][loc][size] || 0;
    const next = Math.max(0, cur + delta);
    inv[pid][loc][size] = next;
    S.saveInv(inv);
    S.syncStock(pid, inv);
    if (next !== cur) logMove(Object.assign({ pid, loc, size, delta: next - cur, reason }, meta));
    return next - cur;
  };
  S.setStock = (pid, loc, size, qty, by) => S.adjust(pid, loc, size, qty - S.stock(pid, loc, size), 'adjustment', { by: by || 'Admin' });
  S.transferStock = (pid, size, from, to, qty, by) => {
    if (from === to || qty <= 0 || S.stock(pid, from, size) < qty) return false;
    const ref = 'TR-' + A.uid().toUpperCase().slice(0, 5);
    S.adjust(pid, from, size, -qty, 'transfer-out', { ref, to, by });
    S.adjust(pid, to, size, qty, 'transfer-in', { ref, from, by });
    return ref;
  };
  S.initInventory = (pid, sizes, qty, loc) => {
    const inv = S.inv();
    inv[pid] = {};
    inv[pid][loc || S.onlineLoc()] = Object.fromEntries(sizes.map((z) => [z, typeof qty === 'object' ? (qty[z] || 0) : qty]));
    S.saveInv(inv);
    S.syncStock(pid, inv);
  };
  S.dropInventory = (pids) => { const inv = S.inv(); pids.forEach((id) => delete inv[id]); S.saveInv(inv); };
  const deleteProducts = S.deleteProducts;
  S.deleteProducts = (ids) => { deleteProducts(ids); S.dropInventory(ids); };

  /* ======================================================================
     Accounts + one unified ledger
     ====================================================================== */
  const SEED_ACCOUNTS = [
    { id: 'cash', name: 'Cash in hand', type: 'cash', opening: 25000 },
    { id: 'bank', name: 'Bank account', type: 'bank', opening: 150000 },
    { id: 'bkash', name: 'bKash merchant', type: 'mfs', opening: 12000 },
    { id: 'nagad', name: 'Nagad merchant', type: 'mfs', opening: 6000 },
    { id: 'pathao', name: 'Pathao merchant balance', type: 'courier', opening: 0 },
    { id: 'steadfast', name: 'Steadfast merchant balance', type: 'courier', opening: 0 }
  ];
  S.accounts = () => DB.get('accounts', null) || (DB.set('accounts', SEED_ACCOUNTS), clone(SEED_ACCOUNTS));
  S.saveAccounts = (l) => DB.set('accounts', l);
  S.account = (id) => S.accounts().find((a) => a.id === id);
  S.accountName = (id) => (S.account(id) || { name: id }).name;
  /* which account a sale tender lands in. Cash on delivery is collected by the courier and lands in
     that courier's merchant balance when the parcel is delivered (see prod.js), so it is not listed here. */
  const TENDER_ACCOUNT = { cash: 'cash', card: 'bank', bkash: 'bkash', nagad: 'nagad' };
  S.tenderAccount = (m) => TENDER_ACCOUNT[m] || null;
  S.tenders = (o) => o.payments || [{ method: o.payment, amount: o.total }];

  /* layered collection: generated seed + new + patched − removed (same pattern as orders) */
  function layered(key, gen) {
    let seed;
    const base = () => seed || (seed = gen());
    return {
      all: () => {
        const patch = DB.get(key + '.patch', {});
        const del = DB.get(key + '.del', []);
        return base().concat(DB.get(key + '.new', [])).filter((x) => !del.includes(x.id)).map((x) => (patch[x.id] ? Object.assign({}, x, patch[x.id]) : x));
      },
      add: (rec) => {
        const fresh = DB.get(key + '.new', []);
        const row = Object.assign({ id: base().length + fresh.length + 1 }, rec);
        fresh.push(row); DB.set(key + '.new', fresh);
        return row;
      },
      patch: (id, p) => { const all = DB.get(key + '.patch', {}); all[id] = Object.assign({}, all[id], p); return DB.set(key + '.patch', all); },
      remove: (ids) => DB.set(key + '.del', DB.get(key + '.del', []).concat(ids))
    };
  }
  function simpleList(key) {
    return {
      all: () => DB.get(key, []),
      add: (rec) => { const l = DB.get(key, []); const row = Object.assign({ id: A.uid(), date: new Date().toISOString() }, rec); l.push(row); DB.set(key, l); return row; },
      remove: (id) => DB.set(key, DB.get(key, []).filter((x) => x.id !== id))
    };
  }

  /* ---------- expenses ---------- */
  /* courier charges are counted per parcel automatically, and tailoring is part of production cost, so neither is an expense category */
  S.expenseCats = ['Rent', 'Salaries', 'Utilities', 'Transport', 'Packaging', 'Marketing & ads', 'Repairs & maintenance', 'Miscellaneous'];
  function genExpenses() {
    const r = rng(99);
    const out = [];
    const base = dayStart(0);
    for (let d = 59; d >= 0; d--) {
      const date = new Date(base - d * DAY + 12 * 36e5);
      const dom = date.getDate();
      const dim = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const add = (category, amount, account, loc, vendor, note) => out.push({ date: date.toISOString(), category, amount: Math.round(amount / 10) * 10, account, loc, vendor, note });
      if (dom === 1) add('Rent', 58000, 'bank', 's1', 'Landlord', 'Monthly shop rent');
      if (dom === dim) add('Salaries', 52000, 'bank', 's1', 'Staff payroll', 'Shop and packing staff');
      if (dom === 15) { add('Utilities', 10000 + r() * 5000, 'cash', 's1', 'Electricity', 'Shop electricity bill'); add('Utilities', 3000 + r() * 1500, 'bank', 's1', 'Internet', 'Internet bill'); }
      if (d % 6 === 2) add('Packaging', 1800 + r() * 1800, 'bank', 's1', 'Packaging supplies', 'Poly bags, boxes and tags');
      if (d % 4 === 1) add('Marketing & ads', 1500 + r() * 4500, 'bank', 's1', 'Facebook ads', 'Page boost and campaigns');
      if (r() < 0.9) add('Miscellaneous', 300 + r() * 600, 'cash', 's1', 'Petty cash', 'Tea, cleaning and small repairs');
      if (d === 21 || d === 44) add('Repairs & maintenance', 2500 + r() * 1000, 'cash', 's1', 'AC servicing', 'Shop maintenance');
    }
    out.forEach((e, i) => { e.id = i + 1; });
    return out;
  }
  const EXP = layered('expenses', genExpenses);
  S.expenses = EXP.all;
  S.addExpense = (e) => EXP.add(Object.assign({ date: new Date().toISOString() }, e));
  S.patchExpense = EXP.patch;
  S.deleteExpenses = EXP.remove;

  const TRANSFERS = simpleList('transfers');
  const INCOME = simpleList('income');
  const COLLECTIONS = simpleList('dues');
  S.transfers = TRANSFERS.all; S.addTransfer = TRANSFERS.add; S.removeTransfer = TRANSFERS.remove;
  S.otherIncome = INCOME.all; S.addIncome = INCOME.add; S.removeIncome = INCOME.remove;
  S.dueCollections = COLLECTIONS.all;

  /* ---------- customer dues (credit sales at the counter) ---------- */
  S.dueOf = (phone) => {
    if (!phone) return 0;
    const owed = sum(S.orders().filter((o) => o.customer.phone === phone && isValid(o)), (o) => o.due || 0);
    return Math.max(0, owed - sum(COLLECTIONS.all().filter((c) => c.phone === phone), (c) => c.amount));
  };
  S.dueList = () => {
    const map = new Map();
    S.orders().filter((o) => isValid(o) && o.due && o.customer.phone).forEach((o) => {
      const e = map.get(o.customer.phone) || { phone: o.customer.phone, name: o.customer.name, owed: 0, orders: [] };
      e.owed += o.due; e.orders.push(o.id); map.set(o.customer.phone, e);
    });
    return [...map.values()].map((e) => Object.assign(e, { due: S.dueOf(e.phone) })).filter((e) => e.due > 0).sort((a, b) => b.due - a.due);
  };
  S.collectDue = (phone, name, amount, account, note) => COLLECTIONS.add({ phone, name, amount, account, note });

  /* ======================================================================
     Fabric purchases (paid when bought; no supplier accounts)
     ====================================================================== */

  /* purchase orders buy fabric by the yard: items = [{ fabricId, yards, rate }] (rate = BDT per yard) */
  const ago = (n) => new Date(dayStart(n) + 11 * 36e5).toISOString();
  function seedPurchases() {
    const pay = (days, amount, account = 'bank', note = '') => ({ id: A.uid(), date: ago(days), account, amount, note });
    const mk = (n, days, status, lines) => {
      const items = lines.map(([fabricId, yards, rate]) => ({ fabricId, yards, rate }));
      const po = { id: 'PO-' + pad(n, 4), n, date: ago(days), status, items, shipping: n % 2 ? 500 : 0, note: '' };
      if (status === 'received') po.receivedAt = ago(Math.max(0, days - 1));
      po.payments = status === 'received' ? [pay(Math.max(0, days - 1), S.poTotal(po), 'bank', 'Paid when bought')] : [];
      return po;
    };
    return [
      mk(1, 55, 'received', [['fab5', 300, 205], ['fab9', 200, 295]]),
      mk(2, 46, 'received', [['fab11', 60, 640], ['fab2', 120, 515]]),
      mk(3, 37, 'received', [['fab12', 50, 770], ['fab4', 80, 940]]),
      mk(4, 26, 'received', [['fab10', 200, 335], ['fab6', 150, 255], ['fab8', 120, 228]]),
      mk(5, 15, 'received', [['fab1', 220, 415], ['fab7', 120, 238]]),
      mk(6, 6, 'received', [['fab3', 90, 380], ['fab12', 30, 780]]),
      mk(7, 2, 'ordered', [['fab11', 80, 650]])
    ];
  }
  S.purchases = () => DB.get('purchases', null) || (DB.set('purchases', seedPurchases()), DB.get('purchases', []));
  S.savePurchases = (l) => DB.set('purchases', l);
  S.poTotal = (po) => sum(po.items, (i) => Math.round(i.yards * i.rate)) + (po.shipping || 0);
  S.poYards = (po) => sum(po.items, (i) => i.yards);
  S.poPaid = (po) => sum(po.payments || [], (p) => p.amount);
  S.nextPoId = () => 'PO-' + pad(S.purchases().reduce((m, p) => Math.max(m, p.n || 0), 0) + 1, 4);
  /** receiving adds the yards to the warehouse and re-averages each fabric's cost per yard */
  S.receivePO = (id) => {
    const list = S.purchases();
    const po = list.find((p) => p.id === id);
    if (!po || po.status === 'received') return false;
    const yards = S.poYards(po) || 1;
    po.items.forEach((i) => S.fabricIn(i.fabricId, i.yards, i.rate + (po.shipping || 0) / yards, po.id));
    po.status = 'received'; po.receivedAt = new Date().toISOString();
    S.savePurchases(list);
    return true;
  };

  /* ======================================================================
     Day close (cash register): sales by tender for a location + date
     ====================================================================== */
  S.salesFor = (loc, date) => {
    const orders = S.orders().filter((o) => S.channelOf(o) === 'store' && o.storeId === loc && ymd(o.date) === date && o.status !== 'cancelled');
    const byTender = {};
    let total = 0; let discount = 0; let vat = 0; let pieces = 0; let refunded = 0;
    orders.forEach((o) => {
      if (o.status === 'refunded') { refunded += o.total; return; }
      total += o.total; discount += o.discount || 0; vat += o.vat || 0; pieces += sum(o.items, (i) => i.qty);
      S.tenders(o).forEach((t) => { byTender[t.method] = (byTender[t.method] || 0) + t.amount; });
    });
    return { orders: orders.filter((o) => o.status !== 'refunded'), count: orders.filter((o) => o.status !== 'refunded').length, byTender, total, discount, vat, pieces, refunded };
  };
  S.cashExpensesFor = (loc, date) => sum(S.expenses().filter((e) => e.account === 'cash' && e.loc === loc && ymd(e.date) === date), (e) => e.amount);

  const NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
  S.denoms = NOTES;
  const breakdown = (amount) => { const out = {}; let left = Math.max(0, Math.round(amount)); NOTES.forEach((n) => { out[n] = Math.floor(left / n); left -= out[n] * n; }); return out; };

  let seedCloses;
  function genCloses() {
    const r = rng(404);
    const out = [];
    ['s1'].forEach((loc) => {
      let opening = 5000;
      for (let d = 59; d >= 1; d--) {
        const date = ymd(dayStart(d));
        const sales = S.salesFor(loc, date);
        const cashExp = S.cashExpensesFor(loc, date);
        if (!sales.count && !cashExp) continue;
        const expected = opening + (sales.byTender.cash || 0) - cashExp;
        const variance = [0, 0, 0, 0, 0, -50, -100, 50, 20, -200][Math.floor(r() * 10)];
        const counted = expected + variance;
        const deposit = Math.max(0, Math.floor((counted - 5000) / 100) * 100);
        out.push({
          id: `DC-${loc}-${date}`, date, loc, opening, byTender: sales.byTender, orders: sales.count, total: sales.total, discount: sales.discount, vat: sales.vat,
          cashExpenses: cashExp, expected, counted, variance, deposit, denoms: breakdown(counted), cashier: 'Rafi Hossain', notes: '', submittedAt: new Date(`${date}T21:30:00`).toISOString(), seeded: true
        });
        opening = counted - deposit;
      }
    });
    return out;
  }
  S.closes = () => { seedCloses = seedCloses || genCloses(); return seedCloses.concat(DB.get('closes.new', [])); };
  S.closeFor = (loc, date) => S.closes().filter((c) => c.loc === loc && c.date === date).pop() || null;
  S.openingFor = (loc, date) => {
    const prev = S.closes().filter((c) => c.loc === loc && c.date < date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return prev ? prev.counted - prev.deposit : 5000;
  };
  S.addClose = (c) => { const l = DB.get('closes.new', []); const rec = Object.assign({ id: `DC-${c.loc}-${c.date}-${l.length + 1}`, submittedAt: new Date().toISOString() }, c); l.push(rec); DB.set('closes.new', l); return rec; };

  /* ======================================================================
     Ledger: every rupee in / out of every account, from one place
     ====================================================================== */
  S.ledger = (opts = {}) => {
    const out = [];
    S.accounts().forEach((a) => out.push({ date: new Date(dayStart(61)).toISOString(), account: a.id, dir: 1, amount: a.opening, kind: 'opening', label: 'Opening balance', ref: '' }));
    S.orders().forEach((o) => {
      if (!isValid(o)) return;
      const ch = S.channelOf(o);
      S.tenders(o).forEach((t) => {
        const acc = TENDER_ACCOUNT[t.method];
        if (!acc || !(t.amount > 0)) return;
        /* website / social prepayments count once the order is confirmed */
        if (ch !== 'store' && !['processing', 'shipped', 'completed'].includes(o.status)) return;
        out.push({ date: o.date, account: acc, dir: 1, amount: t.amount, kind: 'sale', ref: '#' + o.id, orderId: o.id, loc: o.storeId, label: `${S.channelLabel(o)} sale #${o.id} · ${S.payLabel[t.method] || t.method}` });
      });
    });
    ['bkash', 'nagad'].forEach((acc) => {
      const sales = out.filter((e) => e.account === acc && e.kind === 'sale');
      let prev = -Infinity;
      [56, 49, 42, 35, 28, 21, 14, 7].forEach((d) => {
        const at = dayStart(d) + 16 * 36e5; const cut = at - 2 * DAY;
        const amt = sum(sales.filter((e) => { const t = new Date(e.date).getTime(); return t > prev && t <= cut; }), (e) => e.amount);
        prev = cut;
        if (amt > 0) {
          const date = new Date(at).toISOString();
          out.push({ date, account: acc, dir: -1, amount: amt, kind: 'transfer', ref: 'STL', label: `Merchant settlement to bank` });
          out.push({ date, account: 'bank', dir: 1, amount: amt, kind: 'transfer', ref: 'STL', label: `${S.accountName(acc)} settlement` });
        }
      });
    });
    S.expenses().forEach((e) => out.push({ date: e.date, account: e.account, dir: -1, amount: e.amount, kind: 'expense', ref: 'E-' + e.id, loc: e.loc, label: `${e.category}${e.vendor ? ' · ' + e.vendor : ''}` }));
    S.purchases().forEach((po) => (po.payments || []).forEach((p) => out.push({ date: p.date, account: p.account, dir: -1, amount: p.amount, kind: 'fabric', ref: po.id, label: `Fabric purchase · ${po.id} · ${po.items.map((i) => S.fabricName(i.fabricId)).join(', ')}` })));
    S.transfers().forEach((t) => { out.push({ date: t.date, account: t.from, dir: -1, amount: t.amount, kind: 'transfer', ref: 'TRF', label: `Transfer to ${S.accountName(t.to)}${t.note ? ' · ' + t.note : ''}` }); out.push({ date: t.date, account: t.to, dir: 1, amount: t.amount, kind: 'transfer', ref: 'TRF', label: `Transfer from ${S.accountName(t.from)}${t.note ? ' · ' + t.note : ''}` }); });
    S.closes().forEach((c) => { if (c.deposit > 0) { out.push({ date: c.submittedAt, account: 'cash', dir: -1, amount: c.deposit, kind: 'transfer', ref: c.id, label: `Cash deposited to bank · ${S.locName(c.loc)}` }); out.push({ date: c.submittedAt, account: 'bank', dir: 1, amount: c.deposit, kind: 'transfer', ref: c.id, label: `Cash deposit from ${S.locName(c.loc)}` }); } });
    S.otherIncome().forEach((i) => out.push({ date: i.date, account: i.account, dir: 1, amount: i.amount, kind: 'income', ref: 'INC', label: `${i.source || 'Other income'}${i.note ? ' · ' + i.note : ''}` }));
    COLLECTIONS.all().forEach((c) => out.push({ date: c.date, account: c.account, dir: 1, amount: c.amount, kind: 'due', ref: 'DUE', label: `Due collected · ${c.name || c.phone}` }));
    /* courier COD, courier charges, payouts and production labour (prod.js) */
    (S.ledgerHooks || []).forEach((fn) => fn(out));
    let rows = out;
    if (opts.account) rows = rows.filter((r) => r.account === opts.account);
    if (opts.from != null) rows = rows.filter((r) => r.kind !== 'opening' && new Date(r.date).getTime() >= opts.from);
    if (opts.to != null) rows = rows.filter((r) => new Date(r.date).getTime() <= opts.to);
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  S.balances = () => {
    const bal = {};
    S.accounts().forEach((a) => { bal[a.id] = 0; });
    S.ledger().forEach((e) => { bal[e.account] = (bal[e.account] || 0) + e.dir * e.amount; });
    return bal;
  };

  /* ======================================================================
     Reporting
     ====================================================================== */
  /** [from, to] timestamps for a named range */
  S.range = (key) => {
    const end = dayStart(-1) - 1;
    const now = new Date();
    if (key === 'today') return [dayStart(0), end];
    if (key === 'yesterday') return [dayStart(1), dayStart(0) - 1];
    if (key === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end];
    if (key === 'lastmonth') return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1];
    const n = Number(key) || 30;
    return [dayStart(n - 1), end];
  };
  const within = (iso, from, to) => { const t = new Date(iso).getTime(); return t >= from && t <= to; };
  S.within = within;

  const orderParts = (o) => ({
    revenue: Math.max(0, o.subtotal - (o.discount || 0)),
    cogs: sum(o.items, (i) => (i.cost != null ? i.cost : i.price * 0.56) * i.qty),
    shipping: o.shipping || 0,
    vat: o.vat || 0
  });
  /** profit & loss for a period, split by channel: showroom, website, social media */
  S.pnl = (from, to) => {
    const orders = S.orders().filter((o) => isValid(o) && within(o.date, from, to));
    const mk = () => ({ orders: 0, revenue: 0, cogs: 0, shipping: 0, vat: 0, discount: 0, pieces: 0 });
    const ch = { store: mk(), online: mk(), social: mk() };
    const loc = {};
    orders.forEach((o) => {
      const parts = orderParts(o);
      const c = ch[S.channelOf(o)];
      const l = (loc[o.storeId] = loc[o.storeId] || mk());
      [c, l].forEach((x) => { x.orders += 1; x.revenue += parts.revenue; x.cogs += parts.cogs; x.shipping += parts.shipping; x.vat += parts.vat; x.discount += o.discount || 0; x.pieces += sum(o.items, (i) => i.qty); });
    });
    const all = Object.values(ch);
    const revenue = sum(all, (c) => c.revenue);
    const cogs = sum(all, (c) => c.cogs);
    const shipping = sum(all, (c) => c.shipping);
    const vat = sum(all, (c) => c.vat);
    const exp = S.expenses().filter((e) => within(e.date, from, to));
    const byCat = {};
    exp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    /* what couriers charged you for delivered and returned parcels in the period */
    const courier = S.courierCosts ? S.courierCosts(from, to) : { total: 0 };
    if (courier.total) byCat['Courier charges'] = courier.total;
    const expenses = sum(exp, (e) => e.amount) + courier.total;
    const grossProfit = revenue - cogs;
    return { orders: orders.length, revenue, cogs, grossProfit, shipping, vat, expenses, byCat, expList: exp, courier, net: grossProfit + shipping - expenses, ch, loc, margin: revenue ? (grossProfit / revenue) * 100 : 0 };
  };
  /** stock valuation (cost + retail) by product, with per-location quantities */
  S.valuation = () => {
    const rows = S.products().map((p) => {
      const byLoc = {};
      S.locations().forEach((l) => { byLoc[l.id] = S.stock(p.id, l.id); });
      const qty = sum(Object.values(byLoc));
      return { p, byLoc, qty, cost: qty * (p.cost || 0), retail: qty * S.price(p) };
    });
    return { rows, qty: sum(rows, (r) => r.qty), cost: sum(rows, (r) => r.cost), retail: sum(rows, (r) => r.retail) };
  };

  /* ======================================================================
     POS: held bills
     ====================================================================== */
  S.holds = () => DB.get('pos.holds', []);
  S.saveHolds = (l) => DB.set('pos.holds', l);

  /* cancelling or refunding an order puts the pieces back on the shelf of the location that sold them */
  const patchOrder = S.patchOrder;
  S.patchOrder = (id, patch) => {
    const before = S.orders().find((o) => String(o.id) === String(id));
    const res = patchOrder(id, patch);
    if (before && patch.status && patch.status !== before.status) {
      const wasLive = isValid(before);
      const isLive = S.isLive({ status: patch.status });
      const loc = before.storeId || S.onlineLoc();
      if (wasLive && !isLive) before.items.forEach((i) => S.adjust(i.pid, loc, i.size || 'M', i.qty, 'return', { ref: before.id, note: `Order #${before.id} ${patch.status}` }));
      if (!wasLive && isLive) before.items.forEach((i) => S.adjust(i.pid, loc, i.size || 'M', -i.qty, 'sale', { ref: before.id, note: `Order #${before.id} reinstated` }));
    }
    return res;
  };
})();
