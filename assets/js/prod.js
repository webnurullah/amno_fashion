/* ==========================================================================
   Amnu Fashion — warehouse, production & delivery layer (extends Amnu.store)
   Fabric stock in yards (1 yd = 36 in) · design recipes and costing ·
   production batches (fabric → finished panjabi in the showroom) ·
   courier parcels (Pathao, Steadfast, own rider) · COD merchant payouts.
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
  const sum = (arr, f) => arr.reduce((n, x) => n + (f ? f(x) : x), 0);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d.getTime(); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const within = (iso, from, to) => { const t = new Date(iso).getTime(); return t >= from && t <= to; };

  /* ======================================================================
     Units: everything is stored in yards; inches are shown alongside
     ====================================================================== */
  S.YD_IN = 36;
  S.toYards = (qty, unit) => r2((Number(qty) || 0) / (unit === 'in' ? 36 : 1));
  S.fmtYd = (yd) => `${(Number(yd) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} yd`;
  S.fmtIn = (yd) => `${Math.round((Number(yd) || 0) * 36).toLocaleString('en-IN')} in`;
  S.fmtLen = (yd, unit) => (unit === 'in' ? S.fmtIn(yd) : S.fmtYd(yd));

  /* ======================================================================
     Fabrics (cloth in the warehouse)
     ====================================================================== */
  S.fabrics = () => DB.get('fabrics', null) || (DB.set('fabrics', S.seedFabrics), clone(S.seedFabrics));
  S.saveFabrics = (l) => DB.set('fabrics', l);
  S.fabric = (id) => S.fabrics().find((f) => f.id === id);
  S.fabricName = (id) => (S.fabric(id) || { name: id || '—' }).name;
  S.fabricValue = () => sum(S.fabrics(), (f) => f.stock * f.rate);
  S.fabricYards = () => sum(S.fabrics(), (f) => f.stock);
  const mutate = (id, fn) => { const l = S.fabrics(); const f = l.find((x) => x.id === id); if (!f) return null; fn(f); f.stock = Math.max(0, r2(f.stock)); S.saveFabrics(l); return f; };
  /** yards arrive (purchase): stock goes up and the cost per yard is re-averaged */
  S.fabricIn = (id, yards, rate) => mutate(id, (f) => {
    const total = f.stock + yards;
    f.rate = total > 0 ? Math.round(((f.stock * f.rate) + yards * rate) / total) : rate;
    f.stock = total;
  });
  /** yards leave for production, or come back unused (negative) — cost per yard is unchanged */
  S.fabricOut = (id, yards) => mutate(id, (f) => { f.stock -= yards; });
  S.fabricAdjustments = () => DB.get('fabric.adj', []);
  S.adjustFabric = (id, delta, reason, note) => {
    const f = mutate(id, (x) => { x.stock += delta; });
    if (!f) return null;
    const l = S.fabricAdjustments(); l.unshift({ id: A.uid(), date: new Date().toISOString(), fabricId: id, delta: r2(delta), reason, note: note || '' }); DB.set('fabric.adj', l);
    return f;
  };
  S.fabricLow = (f) => f.stock <= f.reorder;

  /** every yard in or out, newest first: purchases received, production issues, counts and wastage */
  S.fabricMoves = () => {
    const out = [];
    S.purchases().filter((po) => po.status === 'received').forEach((po) => po.items.forEach((i) => out.push({ date: po.receivedAt || po.date, fabricId: i.fabricId, delta: i.yards, reason: 'purchase', ref: po.id, note: (S.supplier(po.supplierId) || {}).name || '' })));
    S.batches().forEach((b) => out.push({ date: b.date, fabricId: b.fabricId, delta: -b.yards, reason: 'production', ref: b.id, note: `${(S.product(b.productId) || { name: 'Design #' + b.productId }).name} × ${b.qty}` }));
    S.fabricAdjustments().forEach((a) => out.push({ date: a.date, fabricId: a.fabricId, delta: a.delta, reason: a.reason, ref: '', note: a.note }));
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  /** yards sent to production over the last N days */
  S.fabricUsed = (id, days = 30) => { const from = dayStart(days - 1); return sum(S.batches().filter((b) => (!id || b.fabricId === id) && new Date(b.date).getTime() >= from), (b) => b.yards); };
  /** how many days the stock lasts at the last 30 days' pace (Infinity when unused) */
  S.daysOfCover = (f) => { const perDay = S.fabricUsed(f.id, 30) / 30; return perDay > 0 ? Math.floor(f.stock / perDay) : Infinity; };

  /* ======================================================================
     Designs: each product has a recipe { fabricId, yards, making, extras }
     ====================================================================== */
  S.recipeCostLive = (rc) => { if (!rc) return 0; const f = S.fabric(rc.fabricId); return Math.round((Number(rc.yards) || 0) * (f ? f.rate : 0) + (Number(rc.making) || 0) + (Number(rc.extras) || 0)); };
  S.designsFor = (fabricId) => S.products().filter((p) => p.recipe && p.recipe.fabricId === fabricId);
  S.canMake = (p) => { const rc = p.recipe; const f = rc && S.fabric(rc.fabricId); return f && rc.yards > 0 ? Math.floor(f.stock / rc.yards) : 0; };

  /* ======================================================================
     Production batches: fabric is issued when cutting starts; finished
     pieces go to the showroom stock when the batch is marked ready.
     ====================================================================== */
  const SIZE_W = { S: 0.6, M: 1.2, L: 1.4, XL: 1, XXL: 0.6, '2Y': 1, '4Y': 1, '6Y': 1, '8Y': 0.9, '10Y': 0.8 };
  const TAILORS = ['Karigar Hanif', 'Master Selim', 'Sultana Embroidery', 'Rahim Tailors'];
  function splitBySize(sizes, qty) {
    const w = sizes.map((z) => SIZE_W[z] || 1); const tw = sum(w);
    const out = {}; let left = qty;
    sizes.forEach((z, i) => { const n = i === sizes.length - 1 ? left : Math.round(qty * w[i] / tw); out[z] = n; left -= n; });
    return out;
  }
  function genBatches() {
    const r = rng(777);
    const plan = [[56, 5, 60], [52, 9, 50], [47, 1, 36], [44, 2, 30], [40, 6, 40], [36, 4, 20], [33, 13, 40], [29, 10, 36], [25, 7, 30], [21, 8, 40], [17, 17, 24], [13, 11, 16], [10, 15, 40], [7, 3, 30], [4, 12, 14], [2, 18, 30], [1, 16, 24]];
    return plan.map(([days, pid, qty], i) => {
      const p = S.seedProducts.find((x) => x.id === pid);
      const rc = p.recipe; const f = S.seedFabrics.find((x) => x.id === rc.fabricId);
      const yards = Math.round(qty * rc.yards * (1 + r() * 0.03) * 4) / 4;      /* a little cutting waste */
      const date = new Date(dayStart(days) + 10 * 36e5).toISOString();
      const status = days <= 2 ? 'cutting' : days <= 4 ? 'stitching' : 'ready';
      const labour = (rc.making + rc.extras) * qty;
      return {
        id: 'PB-' + pad(i + 1, 4), n: i + 1, date, productId: pid, sizes: splitBySize(p.sizes, qty), qty, fabricId: rc.fabricId, yards, rate: f.rate,
        making: rc.making, extras: rc.extras, tailor: TAILORS[Math.floor(r() * TAILORS.length)], status,
        readyAt: status === 'ready' ? new Date(dayStart(days - 4) + 17 * 36e5).toISOString() : '', account: labour > 6000 ? 'bank' : 'cash', note: '', seeded: true
      };
    });
  }
  let seedBatches;
  const baseBatches = () => seedBatches || (seedBatches = genBatches());
  S.batches = () => {
    const patch = DB.get('batches.patch', {}); const del = DB.get('batches.del', []);
    return baseBatches().concat(DB.get('batches.new', [])).filter((b) => !del.includes(b.id)).map((b) => (patch[b.id] ? Object.assign({}, b, patch[b.id]) : b))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  S.batch = (id) => S.batches().find((b) => b.id === id);
  const patchBatch = (id, p) => { const all = DB.get('batches.patch', {}); all[id] = Object.assign({}, all[id], p); DB.set('batches.patch', all); };
  S.batchCost = (b) => Math.round(b.yards * b.rate + (b.making + b.extras) * b.qty);
  S.batchUnitCost = (b) => (b.qty ? Math.round(S.batchCost(b) / b.qty) : 0);
  S.nextBatchId = () => 'PB-' + pad(S.batches().reduce((m, b) => Math.max(m, b.n || 0), 0) + 1, 4);

  /** start cutting: checks and issues the fabric. Returns { ok, batch | error } */
  S.startBatch = ({ productId, sizes, yards, making, extras, tailor, note, date }) => {
    const p = S.product(productId);
    if (!p || !p.recipe) return { ok: false, error: 'Choose a design with a fabric recipe.' };
    const f = S.fabric(p.recipe.fabricId);
    const qty = sum(Object.values(sizes || {}));
    if (!(qty > 0)) return { ok: false, error: 'Enter how many pieces to make.' };
    if (!(yards > 0)) return { ok: false, error: 'Enter the fabric to issue.' };
    if (!f || f.stock < yards) return { ok: false, error: `Only ${S.fmtYd(f ? f.stock : 0)} of ${S.fabricName(p.recipe.fabricId)} in the warehouse.` };
    const id = S.nextBatchId();
    const b = { id, n: Number(id.slice(3)), date: date || new Date().toISOString(), productId, sizes, qty, fabricId: f.id, yards: r2(yards), rate: f.rate, making: Number(making) || 0, extras: Number(extras) || 0, tailor: tailor || '', status: 'cutting', readyAt: '', account: '', note: note || '' };
    S.fabricOut(f.id, b.yards);
    const l = DB.get('batches.new', []); l.push(b); DB.set('batches.new', l);
    return { ok: true, batch: b };
  };
  S.advanceBatch = (id) => { const b = S.batch(id); if (b && b.status === 'cutting') patchBatch(id, { status: 'stitching' }); };
  /** finished: pieces land in the showroom, the design's unit cost is re-averaged, labour is paid */
  S.finishBatch = (id, { sizes, account }) => {
    const b = S.batch(id);
    if (!b || b.status === 'ready') return false;
    const got = sizes || b.sizes;
    const qty = sum(Object.values(got));
    const list = S.products(); const p = list.find((x) => x.id === b.productId);
    const before = S.stock(b.productId);
    const unit = qty ? Math.round((b.yards * b.rate + (b.making + b.extras) * qty) / qty) : 0;
    if (p) { p.cost = before + qty > 0 ? Math.round(((before * (p.cost || 0)) + qty * unit) / (before + qty)) : unit; S.saveProducts(list); }
    Object.entries(got).forEach(([size, n]) => { if (n > 0) S.adjust(b.productId, S.onlineLoc(), size, n, 'production', { ref: b.id, note: 'From production' }); });
    patchBatch(id, { status: 'ready', sizes: got, qty, readyAt: new Date().toISOString(), account: account || 'cash' });
    return true;
  };
  /** cancel before it is finished: the fabric goes back on the shelf */
  S.cancelBatch = (id) => {
    const b = S.batch(id);
    if (!b || b.status === 'ready') return false;
    S.fabricOut(b.fabricId, -b.yards);
    if (b.seeded) DB.set('batches.del', DB.get('batches.del', []).concat([id]));
    else DB.set('batches.new', DB.get('batches.new', []).filter((x) => x.id !== id));
    return true;
  };
  S.inProduction = () => S.batches().filter((b) => b.status !== 'ready');

  /* ======================================================================
     Couriers & parcels. Every website / social order carries o.ship:
     { courier, tracking, status: pending|transit|delivered|returned,
       fee, codFee, returnFee, cod, collected, bookedAt, doneAt }
     ====================================================================== */
  const EXTRA_COURIERS = { own: 'Own delivery', pickup: 'Showroom pickup' };
  S.couriers = () => Object.entries(S.settings().couriers).map(([id, c]) => Object.assign({ id }, c));
  S.courierName = (id) => (S.settings().couriers[id] || {}).name || EXTRA_COURIERS[id] || 'Not booked';
  S.isMerchant = (id) => !!S.settings().couriers[id];
  S.courierFee = (courier, district) => { const c = S.settings().couriers[courier]; return c ? (district === 'Dhaka' ? c.inside : c.outside) : 0; };
  S.codOf = (o) => sum(S.tenders(o).filter((t) => t.method === 'cod'), (t) => t.amount);
  S.parcels = () => S.orders().filter((o) => o.ship);

  /** hand the parcel to a courier */
  S.bookParcel = (id, courier, tracking) => {
    const o = S.order(id); if (!o || !o.ship) return false;
    const ship = Object.assign({}, o.ship, { courier, status: courier === 'pickup' ? 'pending' : 'transit', fee: S.courierFee(courier, o.customer.district), cod: S.codOf(o), bookedAt: new Date().toISOString(), tracking: tracking || (courier === 'pathao' ? 'PTH' : courier === 'steadfast' ? 'SFC' : 'OWN') + String(Date.now()).slice(-6) });
    S.patchOrder(id, { ship, status: courier === 'pickup' ? 'processing' : 'shipped', notes: (o.notes || []).concat([{ text: `Booked with ${S.courierName(courier)}${ship.tracking ? ' · ' + ship.tracking : ''}.`, date: new Date().toISOString(), by: 'Amnu Admin' }]) });
    return true;
  };
  /** delivered and the courier collected the cash (or the customer picked it up) */
  S.deliverParcel = (id, collected) => {
    const o = S.order(id); if (!o || !o.ship) return false;
    const c = S.settings().couriers[o.ship.courier];
    const got = collected == null ? S.codOf(o) : collected;
    const ship = Object.assign({}, o.ship, { status: 'delivered', collected: got, codFee: c ? Math.round(got * c.codPct / 100) : 0, doneAt: new Date().toISOString() });
    S.patchOrder(id, { ship, status: 'completed', notes: (o.notes || []).concat([{ text: `Delivered by ${S.courierName(o.ship.courier)}. Cash collected ${A.money(got)}.`, date: new Date().toISOString(), by: 'Amnu Admin' }]) });
    return true;
  };
  /** customer refused: the courier brings it back and charges the return fee; stock comes back */
  S.returnParcel = (id) => {
    const o = S.order(id); if (!o || !o.ship) return false;
    const c = S.settings().couriers[o.ship.courier];
    const ship = Object.assign({}, o.ship, { status: 'returned', collected: 0, codFee: 0, returnFee: c ? Math.round((o.ship.fee || 0) * c.returnPct / 100) : 0, doneAt: new Date().toISOString() });
    S.patchOrder(id, { ship, status: 'returned', notes: (o.notes || []).concat([{ text: `Returned by ${S.courierName(o.ship.courier)}. Pieces back in stock.`, date: new Date().toISOString(), by: 'Amnu Admin' }]) });
    return true;
  };

  /** money movements a parcel causes, by courier account */
  const parcelEvents = (o) => {
    const p = o.ship; if (!p || !p.courier || !p.doneAt) return [];
    const out = [];
    const acc = S.isMerchant(p.courier) ? p.courier : 'cash';
    if (p.status === 'delivered') {
      if (p.collected > 0) out.push({ date: p.doneAt, account: acc, dir: 1, amount: p.collected, kind: 'cod', ref: '#' + o.id, orderId: o.id, label: `Cash on delivery #${o.id} · ${S.courierName(p.courier)}` });
      const fees = (p.fee || 0) + (p.codFee || 0);
      if (fees > 0 && acc !== 'cash') out.push({ date: p.doneAt, account: acc, dir: -1, amount: fees, kind: 'courier-fee', ref: '#' + o.id, orderId: o.id, label: `Delivery charge${p.codFee ? ' + COD charge' : ''} #${o.id}` });
    } else if (p.status === 'returned' && acc !== 'cash') {
      const fees = (p.fee || 0) + (p.returnFee || 0);
      if (fees > 0) out.push({ date: p.doneAt, account: acc, dir: -1, amount: fees, kind: 'courier-fee', ref: '#' + o.id, orderId: o.id, label: `Return charge #${o.id}` });
    }
    return out;
  };

  /* payouts: the courier sends your collected cash to the bank (seeded every 3 days + yours) */
  let seedPayouts;
  function genPayouts() {
    const out = [];
    S.couriers().forEach((c) => {
      const ev = S.parcels().flatMap(parcelEvents).filter((e) => e.account === c.id);
      let paid = 0;
      for (let d = 57; d >= 1; d -= 3) {
        const at = dayStart(d) + 15 * 36e5;
        const due = sum(ev.filter((e) => new Date(e.date).getTime() <= at - DAY), (e) => e.dir * e.amount) - paid;
        if (due > 500) { out.push({ id: `PY-${c.id}-${d}`, date: new Date(at).toISOString(), courier: c.id, amount: due, account: 'bank', ref: `${c.name} payout`, seeded: true }); paid += due; }
      }
    });
    return out;
  }
  S.payouts = () => (seedPayouts || (seedPayouts = genPayouts())).concat(DB.get('payouts', [])).sort((a, b) => new Date(b.date) - new Date(a.date));
  S.addPayout = ({ courier, amount, account, ref }) => { const l = DB.get('payouts', []); const row = { id: A.uid(), date: new Date().toISOString(), courier, amount, account, ref: ref || '' }; l.push(row); DB.set('payouts', l); return row; };

  /** what couriers charged in a period (delivery + COD % + returns) */
  S.courierCosts = (from, to) => {
    const ps = S.parcels().filter((o) => o.ship.doneAt && S.isMerchant(o.ship.courier) && within(o.ship.doneAt, from, to));
    const del = ps.filter((o) => o.ship.status === 'delivered'); const ret = ps.filter((o) => o.ship.status === 'returned');
    const delivery = sum(del, (o) => o.ship.fee || 0); const cod = sum(del, (o) => o.ship.codFee || 0); const returns = sum(ret, (o) => (o.ship.fee || 0) + (o.ship.returnFee || 0));
    return { total: delivery + cod + returns, delivery, cod, returns, delivered: del.length, returned: ret.length };
  };
  /** one courier's position right now + over a period */
  S.courierStats = (id, from, to) => {
    const mine = S.parcels().filter((o) => o.ship.courier === id);
    const transit = mine.filter((o) => o.ship.status === 'transit');
    const done = mine.filter((o) => o.ship.doneAt && (from == null || within(o.ship.doneAt, from, to)));
    const delivered = done.filter((o) => o.ship.status === 'delivered'); const returned = done.filter((o) => o.ship.status === 'returned');
    const bal = S.balances()[id] || 0;
    return {
      balance: bal, transit: transit.length, transitCod: sum(transit, (o) => o.ship.cod || 0),
      delivered: delivered.length, collected: sum(delivered, (o) => o.ship.collected || 0), returned: returned.length,
      returnRate: delivered.length + returned.length ? (returned.length / (delivered.length + returned.length)) * 100 : 0,
      fees: sum(delivered, (o) => (o.ship.fee || 0) + (o.ship.codFee || 0)) + sum(returned, (o) => (o.ship.fee || 0) + (o.ship.returnFee || 0)),
      paidOut: sum(S.payouts().filter((p) => p.courier === id && (from == null || within(p.date, from, to))), (p) => p.amount)
    };
  };

  /* ======================================================================
     Ledger contributions: COD, courier charges, payouts, production labour
     ====================================================================== */
  S.ledgerHooks = (S.ledgerHooks || []).concat([
    (out) => S.parcels().forEach((o) => parcelEvents(o).forEach((e) => out.push(e))),
    (out) => S.payouts().forEach((p) => {
      out.push({ date: p.date, account: p.courier, dir: -1, amount: p.amount, kind: 'payout', ref: 'PAY', label: `Payout to ${S.accountName(p.account)}${p.ref ? ' · ' + p.ref : ''}` });
      out.push({ date: p.date, account: p.account, dir: 1, amount: p.amount, kind: 'payout', ref: 'PAY', label: `${S.courierName(p.courier)} payout${p.ref ? ' · ' + p.ref : ''}` });
    }),
    (out) => S.batches().filter((b) => b.status === 'ready' && b.account).forEach((b) => out.push({ date: b.readyAt, account: b.account, dir: -1, amount: (b.making + b.extras) * b.qty, kind: 'production', ref: b.id, label: `Making cost ${b.id} · ${b.tailor || 'tailor'}` }))
  ]);

  /* ======================================================================
     Channels: showroom, website, Facebook, WhatsApp, Instagram, phone
     ====================================================================== */
  S.channelRows = (from, to) => {
    const rows = {};
    const key = (o) => (o.channel === 'social' ? o.source || 'facebook' : S.channelOf(o));
    const label = { store: 'Showroom', online: 'Website', facebook: 'Facebook', whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone call' };
    S.orders().filter((o) => S.isLive(o) && within(o.date, from, to)).forEach((o) => {
      const k = key(o); const row = rows[k] || (rows[k] = { key: k, label: label[k] || k, orders: 0, revenue: 0, pieces: 0 });
      row.orders += 1; row.revenue += Math.max(0, o.subtotal - (o.discount || 0)); row.pieces += sum(o.items, (i) => i.qty);
    });
    return Object.values(rows).sort((a, b) => b.revenue - a.revenue);
  };

  /* new website / social orders get an unbooked parcel (pickup orders are collected at the showroom) */
  const addOrder = S.addOrder;
  S.addOrder = (o) => {
    if (o.channel === 'store' || o.ship) return addOrder(o);
    const cod = sum((o.payments || [{ method: o.payment, amount: o.total }]).filter((t) => t.method === 'cod'), (t) => t.amount);
    return addOrder(Object.assign({}, o, { ship: { courier: o.pickup ? 'pickup' : '', status: 'pending', fee: 0, codFee: 0, cod, collected: 0 } }));
  };
})();
