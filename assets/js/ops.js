/* ==========================================================================
   Amnu Fashion — store operations layer (extends Amnu.store)
   Locations · size-level inventory · accounts & ledger · expenses ·
   suppliers & purchases · day close · loyalty · P&L.
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
  const isValid = (o) => o.status !== 'cancelled' && o.status !== 'refunded';
  S.isValidOrder = isValid;

  /* ======================================================================
     Locations (showrooms + warehouse). One location fulfils online orders.
     ====================================================================== */
  const SEED_LOCATIONS = [
    { id: 'w1', name: 'Central Warehouse', type: 'warehouse', address: 'Plot 00, Tejgaon I/A, Dhaka', district: 'Dhaka', phone: '+880 1700-000010', hours: 'Sun – Thu · 9:00 am – 6:00 pm', manager: 'Shop Manager', active: true },
    { id: 's1', name: 'Dhanmondi Showroom', type: 'showroom', address: 'House 00, Road 00, Dhanmondi, Dhaka', district: 'Dhaka', phone: '+880 1700-000011', hours: 'Sat – Thu · 10:00 am – 9:00 pm', manager: 'Rafi Hossain', active: true },
    { id: 's2', name: 'Chattogram Showroom', type: 'showroom', address: 'Shop 00, GEC Circle, Chattogram', district: 'Chattogram', phone: '+880 1700-000012', hours: 'Sat – Thu · 10:00 am – 9:00 pm', manager: 'Nusrat Jahan', active: true }
  ];
  S.locations = () => DB.get('locations', null) || (DB.set('locations', SEED_LOCATIONS), clone(SEED_LOCATIONS));
  S.saveLocations = (l) => DB.set('locations', l);
  S.location = (id) => S.locations().find((l) => l.id === id);
  S.locName = (id) => (S.location(id) || { name: id === 'all' ? 'All locations' : id }).name;
  S.onlineLoc = () => S.settings().onlineLoc || 'w1';
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
    const shares = [['w1', 0.6], ['s1', 0.25], ['s2', 0.15]];
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
    { id: 'nagad', name: 'Nagad merchant', type: 'mfs', opening: 6000 }
  ];
  S.accounts = () => DB.get('accounts', null) || (DB.set('accounts', SEED_ACCOUNTS), clone(SEED_ACCOUNTS));
  S.saveAccounts = (l) => DB.set('accounts', l);
  S.account = (id) => S.accounts().find((a) => a.id === id);
  S.accountName = (id) => (S.account(id) || { name: id }).name;
  /* which account a sale tender lands in (COD is settled by the courier into the bank) */
  const TENDER_ACCOUNT = { cash: 'cash', card: 'bank', bkash: 'bkash', nagad: 'nagad', cod: 'bank' };
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
  S.expenseCats = ['Rent', 'Salaries', 'Utilities', 'Transport & courier', 'Packaging', 'Marketing & ads', 'Repairs & maintenance', 'Tailoring & production', 'Miscellaneous'];
  function genExpenses() {
    const r = rng(99);
    const out = [];
    const base = dayStart(0);
    for (let d = 59; d >= 0; d--) {
      const date = new Date(base - d * DAY + 12 * 36e5);
      const dom = date.getDate();
      const dim = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const add = (category, amount, account, loc, vendor, note) => out.push({ date: date.toISOString(), category, amount: Math.round(amount / 10) * 10, account, loc, vendor, note });
      if (dom === 1) { add('Rent', 30000, 'bank', 's1', 'Landlord (Dhanmondi)', 'Monthly showroom rent'); add('Rent', 18000, 'bank', 's2', 'Landlord (Chattogram)', 'Monthly showroom rent'); add('Rent', 10000, 'bank', 'w1', 'Warehouse landlord', 'Monthly warehouse rent'); }
      if (dom === dim) { add('Salaries', 22000, 'bank', 's1', 'Staff payroll', 'Dhanmondi showroom staff'); add('Salaries', 16000, 'bank', 's2', 'Staff payroll', 'Chattogram showroom staff'); add('Salaries', 14000, 'bank', 'w1', 'Staff payroll', 'Warehouse and packing staff'); }
      if (dom === 15) { add('Utilities', 6000 + r() * 3000, 'cash', 's1', 'Electricity', 'Dhanmondi showroom bill'); add('Utilities', 4000 + r() * 2500, 'cash', 's2', 'Electricity', 'Chattogram showroom bill'); add('Utilities', 3000 + r() * 1500, 'bank', 'w1', 'Internet and electricity', 'Warehouse bills'); }
      if (d % 7 === 3) add('Transport & courier', 3000 + r() * 3500, 'bank', 'w1', 'Courier fees', 'Weekly parcel charges');
      if (d % 6 === 2) add('Packaging', 1800 + r() * 1800, 'bank', 'w1', 'Packaging supplies', 'Poly bags, boxes and tags');
      if (d % 4 === 1) add('Marketing & ads', 1500 + r() * 4500, 'bank', 'all', 'Facebook ads', 'Page boost and campaigns');
      ['s1', 's2'].forEach((loc) => { if (r() < 0.7) add('Miscellaneous', 300 + r() * 600, 'cash', loc, 'Petty cash', 'Tea, cleaning and small repairs'); });
      if (d === 21 || d === 44) add('Repairs & maintenance', 2500 + r() * 1000, 'cash', 's1', 'AC servicing', 'Showroom maintenance');
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
     Suppliers & purchases (payables)
     ====================================================================== */
  const SEED_SUPPLIERS = [
    { id: 'sup1', name: 'Rahman Textiles', contact: 'Mr. Rahman', phone: '01700-000020', address: 'Narayanganj', category: 'Cotton and linen fabric' },
    { id: 'sup2', name: 'Dhaka Embroidery House', contact: 'Ms. Sultana', phone: '01700-000021', address: 'Mirpur, Dhaka', category: 'Embroidery and finishing' },
    { id: 'sup3', name: 'Jamdani Weavers Co-op', contact: 'Mr. Karim', phone: '01700-000022', address: 'Sonargaon', category: 'Jamdani and silk' },
    { id: 'sup4', name: 'Button & Trim Traders', contact: 'Mr. Hasan', phone: '01700-000023', address: 'Islampur, Dhaka', category: 'Buttons, thread and trims' }
  ];
  S.suppliers = () => DB.get('suppliers', null) || (DB.set('suppliers', SEED_SUPPLIERS), clone(SEED_SUPPLIERS));
  S.saveSuppliers = (l) => DB.set('suppliers', l);
  S.supplier = (id) => S.suppliers().find((s) => s.id === id);

  const poItems = (pids, qty) => pids.flatMap((pid) => { const p = S.seedProducts.find((x) => x.id === pid); return p.sizes.map((size) => ({ pid, size, qty, cost: p.cost })); });
  const ago = (n) => new Date(dayStart(n) + 11 * 36e5).toISOString();
  function seedPurchases() {
    const pay = (days, amount, account = 'bank', note = '') => ({ id: A.uid(), date: ago(days), account, amount, note });
    const mk = (n, sup, days, status, pids, qty, payments) => {
      const items = poItems(pids, qty);
      return { id: 'PO-' + pad(n, 4), n, date: ago(days), supplierId: sup, locId: 'w1', status, items, shipping: 0, payments: payments(sum(items, (i) => i.qty * i.cost)), note: '' };
    };
    return [
      mk(1, 'sup1', 52, 'received', [5, 6, 9, 15], 6, (t) => [pay(50, t)]),
      mk(2, 'sup2', 41, 'received', [2, 4, 7, 17], 4, (t) => [pay(40, Math.round(t / 2)), pay(30, t - Math.round(t / 2))]),
      mk(3, 'sup3', 30, 'received', [3, 11], 5, (t) => [pay(28, Math.round(t * 0.6), 'bank', 'Advance')]),
      mk(4, 'sup1', 18, 'received', [1, 8, 18, 10], 5, (t) => [pay(16, Math.round(t * 0.5), 'bank', 'Part payment')]),
      mk(5, 'sup4', 9, 'received', [13, 14, 16], 4, (t) => [pay(8, t, 'bank', 'Bank transfer')]),
      mk(6, 'sup2', 3, 'ordered', [12, 19], 3, () => [])
    ];
  }
  S.purchases = () => DB.get('purchases', null) || (DB.set('purchases', seedPurchases()), DB.get('purchases', []));
  S.savePurchases = (l) => DB.set('purchases', l);
  S.poTotal = (po) => sum(po.items, (i) => i.qty * i.cost) + (po.shipping || 0);
  S.poPaid = (po) => sum(po.payments || [], (p) => p.amount);
  S.poDue = (po) => (po.status === 'received' ? Math.max(0, S.poTotal(po) - S.poPaid(po)) : 0);
  S.nextPoId = () => 'PO-' + pad(S.purchases().reduce((m, p) => Math.max(m, p.n || 0), 0) + 1, 4);
  S.receivePO = (id, locId) => {
    const list = S.purchases();
    const po = list.find((p) => p.id === id);
    if (!po || po.status === 'received') return false;
    const loc = locId || po.locId || S.onlineLoc();
    po.items.forEach((i) => S.adjust(i.pid, loc, i.size, i.qty, 'purchase', { ref: po.id }));
    const prods = S.products();
    po.items.forEach((i) => { const p = prods.find((x) => x.id === i.pid); if (p) p.cost = i.cost; });
    S.saveProducts(prods);
    po.status = 'received'; po.locId = loc; po.receivedAt = new Date().toISOString();
    S.savePurchases(list);
    return true;
  };
  S.payPO = (id, account, amount, note) => {
    const list = S.purchases();
    const po = list.find((p) => p.id === id);
    if (!po || !(amount > 0)) return false;
    po.payments = (po.payments || []).concat([{ id: A.uid(), date: new Date().toISOString(), account, amount, note: note || '' }]);
    S.savePurchases(list);
    return true;
  };
  S.payables = () => sum(S.purchases(), S.poDue);

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
    ['s1', 's2'].forEach((loc) => {
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
          cashExpenses: cashExp, expected, counted, variance, deposit, denoms: breakdown(counted), cashier: loc === 's1' ? 'Rafi Hossain' : 'Nusrat Jahan', notes: '', submittedAt: new Date(`${date}T21:30:00`).toISOString(), seeded: true
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
     Loyalty points
     ====================================================================== */
  S.points = (phone) => {
    const cfg = S.settings().loyalty;
    const empty = { earned: 0, used: 0, adj: 0, balance: 0, value: 0, history: [] };
    if (!phone) return empty;
    let earned = 0; let used = 0;
    const history = [];
    S.orders().filter((o) => o.customer.phone === phone && isValid(o)).forEach((o) => {
      const e = Math.floor(Math.max(0, o.subtotal - (o.discount || 0)) / cfg.earnPer);
      earned += e;
      if (e) history.push({ date: o.date, label: `Earned on order #${o.id}${S.channelOf(o) === 'store' ? ' (store)' : ''}`, points: e });
      if (o.pointsUsed) { used += o.pointsUsed; history.push({ date: o.date, label: `Redeemed on order #${o.id}`, points: -o.pointsUsed }); }
    });
    const adj = (DB.get('loyalty.adj', {}))[phone] || 0;
    if (adj) history.push({ date: new Date().toISOString(), label: 'Manual adjustment', points: adj });
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    const balance = Math.max(0, earned - used + adj);
    return { earned, used, adj, balance, value: balance * cfg.pointValue, history };
  };
  S.adjustPoints = (phone, delta) => { const m = DB.get('loyalty.adj', {}); m[phone] = (m[phone] || 0) + delta; DB.set('loyalty.adj', m); };

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
        if (ch === 'online') {
          const got = t.method === 'cod' ? o.status === 'completed' : (o.status === 'processing' || o.status === 'completed');
          if (!got) return;
        }
        out.push({ date: o.date, account: acc, dir: 1, amount: t.amount, kind: 'sale', ref: '#' + o.id, orderId: o.id, loc: o.storeId, label: `${ch === 'store' ? 'Store' : 'Online'} sale #${o.id} · ${S.payLabel[t.method] || t.method}` });
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
    S.purchases().forEach((po) => (po.payments || []).forEach((p) => out.push({ date: p.date, account: p.account, dir: -1, amount: p.amount, kind: 'supplier', ref: po.id, label: `Supplier payment · ${(S.supplier(po.supplierId) || {}).name || ''} · ${po.id}` })));
    S.transfers().forEach((t) => { out.push({ date: t.date, account: t.from, dir: -1, amount: t.amount, kind: 'transfer', ref: 'TRF', label: `Transfer to ${S.accountName(t.to)}${t.note ? ' · ' + t.note : ''}` }); out.push({ date: t.date, account: t.to, dir: 1, amount: t.amount, kind: 'transfer', ref: 'TRF', label: `Transfer from ${S.accountName(t.from)}${t.note ? ' · ' + t.note : ''}` }); });
    S.closes().forEach((c) => { if (c.deposit > 0) { out.push({ date: c.submittedAt, account: 'cash', dir: -1, amount: c.deposit, kind: 'transfer', ref: c.id, label: `Cash deposited to bank · ${S.locName(c.loc)}` }); out.push({ date: c.submittedAt, account: 'bank', dir: 1, amount: c.deposit, kind: 'transfer', ref: c.id, label: `Cash deposit from ${S.locName(c.loc)}` }); } });
    S.otherIncome().forEach((i) => out.push({ date: i.date, account: i.account, dir: 1, amount: i.amount, kind: 'income', ref: 'INC', label: `${i.source || 'Other income'}${i.note ? ' · ' + i.note : ''}` }));
    COLLECTIONS.all().forEach((c) => out.push({ date: c.date, account: c.account, dir: 1, amount: c.amount, kind: 'due', ref: 'DUE', label: `Due collected · ${c.name || c.phone}` }));
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
  /** profit & loss for a period, with online vs store split */
  S.pnl = (from, to) => {
    const orders = S.orders().filter((o) => isValid(o) && within(o.date, from, to));
    const mk = () => ({ orders: 0, revenue: 0, cogs: 0, shipping: 0, vat: 0, discount: 0, pieces: 0 });
    const ch = { online: mk(), store: mk() };
    const loc = {};
    orders.forEach((o) => {
      const parts = orderParts(o);
      const c = ch[S.channelOf(o)];
      const l = (loc[o.storeId] = loc[o.storeId] || mk());
      [c, l].forEach((x) => { x.orders += 1; x.revenue += parts.revenue; x.cogs += parts.cogs; x.shipping += parts.shipping; x.vat += parts.vat; x.discount += o.discount || 0; x.pieces += sum(o.items, (i) => i.qty); });
    });
    const revenue = ch.online.revenue + ch.store.revenue;
    const cogs = ch.online.cogs + ch.store.cogs;
    const shipping = ch.online.shipping + ch.store.shipping;
    const vat = ch.online.vat + ch.store.vat;
    const exp = S.expenses().filter((e) => within(e.date, from, to));
    const byCat = {};
    exp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const expenses = sum(exp, (e) => e.amount);
    const grossProfit = revenue - cogs;
    return { orders: orders.length, revenue, cogs, grossProfit, shipping, vat, expenses, byCat, expList: exp, net: grossProfit + shipping - expenses, ch, loc, margin: revenue ? (grossProfit / revenue) * 100 : 0 };
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
      const isLive = patch.status !== 'cancelled' && patch.status !== 'refunded';
      const loc = before.storeId || S.onlineLoc();
      if (wasLive && !isLive) before.items.forEach((i) => S.adjust(i.pid, loc, i.size || 'M', i.qty, 'return', { ref: before.id, note: `Order #${before.id} ${patch.status}` }));
      if (!wasLive && isLive) before.items.forEach((i) => S.adjust(i.pid, loc, i.size || 'M', -i.qty, 'sale', { ref: before.id, note: `Order #${before.id} reinstated` }));
    }
    return res;
  };
})();
