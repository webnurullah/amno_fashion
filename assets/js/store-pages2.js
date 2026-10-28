/* ==========================================================================
   Amnu Fashion — storefront pages (2/2)
   login · account · stores · policy · about · contact · track
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const S = A.store;
  const DB = A.DB;
  const Shop = A.shop;
  const { Auth } = Shop;
  const { $, $$, esc, icon, money } = A;
  const settings = Shop.settings;
  const P = Shop.pages;

  const STATUS_TEXT = { completed: ['RECEIVED', 'ok'], processing: ['PROCESSING', 'info'], pending: ['PENDING', 'warn'], 'on-hold': ['ON HOLD', 'warn'], shipped: ['ON THE WAY', 'info'], returned: ['RETURNED', 'err'], cancelled: ['CANCELLED', 'err'], refunded: ['REFUNDED', 'muted'] };
  const statusText = (s) => { const [t, c] = STATUS_TEXT[s] || [String(s).toUpperCase(), 'muted']; return `<b class="st st-${c}">${t}</b>`; };
  const phoneOk = (v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(String(v).replace(/[\s-]/g, ''));
  const digits = (s) => String(s).replace(/\D/g, '').slice(-10);

  /* printable invoice (online order or store receipt) */
  Shop.invoice = (o) => {
    const store = S.channelOf(o) === 'store';
    A.modal({
      title: `Invoice #${o.id}`, wide: true,
      body: `<div class="invoice" id="invoice-print"><div class="row between wrap"><div><b class="inv-brand">${esc(settings.storeName)}</b><div class="xs muted">${esc(store ? (S.location(o.storeId) || {}).address || '' : settings.address)}</div>${settings.bin ? `<div class="xs muted">BIN: ${esc(settings.bin)}</div>` : ''}</div><div class="right"><b>Invoice #${o.id}</b><div class="xs muted">${A.dateTime(o.date)}</div><div class="xs muted">${store ? 'Store purchase · ' + esc(S.locName(o.storeId)) : 'Online purchase'}</div></div></div>
        <hr><p class="small"><b>${esc(o.customer.name)}</b>${o.customer.phone ? ' · ' + esc(o.customer.phone) : ''}${o.customer.address ? `<br><span class="muted">${esc(o.customer.address)}, ${esc(o.customer.district)}</span>` : ''}</p>
        <div class="table-wrap"><table class="gtable"><thead><tr><th>Item</th><th>Size</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="xs muted">${esc(i.color)}</div></td><td>${esc(S.sizeLabel(i.size))}</td><td class="right">${i.qty}</td><td class="right num">${money(i.price)}</td><td class="right num">${money(i.price * i.qty)}</td></tr>`).join('')}</tbody></table></div>
        <div class="inv-tot"><div><span>Sub total</span><span class="num">${money(o.subtotal)}</span></div>${o.discount ? `<div><span>Discount</span><span class="num">− ${money(o.discount)}</span></div>` : ''}${o.vat ? `<div><span>VAT</span><span class="num">${money(o.vat)}</span></div>` : ''}${o.shipping ? `<div><span>Delivery</span><span class="num">${money(o.shipping)}</span></div>` : ''}<div class="g"><span>Total</span><b class="num">${money(o.total)}</b></div>
          ${S.tenders(o).map((t) => `<div class="xs muted"><span>Paid by ${esc(S.payLabel[t.method] || t.method)}</span><span class="num">${money(t.amount)}</span></div>`).join('')}</div>
        <p class="xs muted center" style="margin-top:14px">${esc(settings.receiptFooter)}</p></div>`,
      footer: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" id="print-inv">${icon('printer', 16)} Print</button>`,
      onOpen(el) { $('#print-inv', el).addEventListener('click', () => { document.body.classList.add('print-invoice'); window.print(); document.body.classList.remove('print-invoice'); }); }
    });
  };

  /* ======================================================================
     Login / register
     ====================================================================== */
  P.login = () => {
    const next = A.qs.get('next') || 'account.html';
    if (Auth.user() && !A.qs.get('force')) { location.replace(next); return; }
    let mode = location.hash === '#register' ? 'register' : 'login';
    const root = $('#auth-card');
    const paint = (errs = {}, vals = {}) => {
      const f = (name, label, type, ph, extra = '') => `<div class="field ${errs[name] ? 'err' : ''}"><input id="l-${name}" name="${name}" type="${type}" placeholder="${ph}" value="${esc(vals[name] || '')}" aria-label="${label}" ${extra}><span class="msg">${esc(errs[name] || '')}</span></div>`;
      root.innerHTML = `<h1>${mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h1>
        <p class="small">${mode === 'login' ? 'New user? <a class="blue" href="#register" data-mode="register">Create an account</a>' : 'Already have an account? <a class="blue" href="#login" data-mode="login">Sign in</a>'}</p>
        <form id="auth-form" class="col" novalidate>
          ${mode === 'register' ? f('name', 'Full name', 'text', 'Full name', 'autocomplete="name"') : ''}
          ${f('id', 'Phone number or email', 'text', mode === 'login' ? 'Phone number or email' : 'Mobile number (01XXXXXXXXX)', 'autocomplete="username"')}
          ${mode === 'register' ? f('email', 'Email', 'email', 'Email (optional)', 'autocomplete="email"') : ''}
          <div class="field ${errs.pass ? 'err' : ''}"><div class="pass-wrap"><input id="l-pass" name="pass" type="password" placeholder="Password" aria-label="Password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"><button class="pass-toggle" id="toggle-pass" type="button" aria-label="Show password" aria-pressed="false">${icon('eye', 18)}</button></div><span class="msg">${esc(errs.pass || '')}</span></div>
          ${mode === 'login' ? '<a class="small u" style="align-self:flex-end" href="#" data-forgot>Forgot password?</a>' : ''}
          <button class="btn btn-primary btn-lg btn-block" type="submit">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <div class="or"><span>OR</span></div>
        <button class="btn btn-outline btn-block" data-social="Google"><span class="gl">G</span> Sign in with Google</button>
        <button class="btn btn-outline btn-block" data-social="Facebook">${icon('facebook', 18)} Sign in with Facebook</button>
        <p class="xs muted center" style="margin-top:14px"><b>Demo sign-in.</b> There is no real authentication in this template: any phone/email and a password of 4+ characters signs in, and your profile is stored in this browser only.</p>`;
    };
    paint();
    root.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]'); if (m) { e.preventDefault(); mode = m.dataset.mode; history.replaceState && (() => { try { history.replaceState(null, '', '#' + mode); } catch (er) { /* file:// */ } })(); paint(); return; }
      if (e.target.closest('[data-forgot]')) { e.preventDefault(); A.toast('Demo: connect password reset to your backend'); return; }
      const so = e.target.closest('[data-social]'); if (so) { A.toast(`Demo: connect ${so.dataset.social} sign-in (OAuth) in your backend`); return; }
      const tp = e.target.closest('#toggle-pass'); if (tp) { const i = $('#l-pass'); i.type = i.type === 'password' ? 'text' : 'password'; tp.setAttribute('aria-pressed', i.type === 'text'); }
    });
    root.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target.elements; const vals = { name: (f.name || {}).value || '', id: f.id.value.trim(), email: (f.email || {}).value || '' };
      const errs = {};
      const id = vals.id; const isEmail = id.includes('@');
      if (!id) errs.id = 'Enter your phone number or email.'; else if (!isEmail && !phoneOk(id)) errs.id = 'Enter a valid mobile number (01XXXXXXXXX) or email.';
      if (mode === 'register' && vals.name.trim().length < 2) errs.name = 'Please enter your name.';
      if (mode === 'register' && isEmail) errs.id = 'Use your mobile number here. It links your store and online orders.';
      if (vals.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vals.email)) errs.email = 'That email does not look right.';
      if (f.pass.value.length < 4) errs.pass = 'Password must be at least 4 characters.';
      if (Object.keys(errs).length) { paint(errs, vals); return; }
      const known = S.customers().find((c) => (isEmail ? (c.email || '').toLowerCase() === id.toLowerCase() : digits(c.phone) === digits(id)));
      const user = known
        ? { name: known.name, phone: known.phone, email: known.email || '', addresses: [{ id: A.uid(), label: known.district, name: known.name, phone: known.phone, email: known.email || '', address: known.address, district: known.district, default: true }] }
        : { name: mode === 'register' ? vals.name.trim() : (isEmail ? id.split('@')[0] : 'Valued customer'), phone: isEmail ? '' : id.replace(/[\s]/g, ''), email: isEmail ? id : vals.email, addresses: [] };
      Auth.login(user);
      A.toast(`Welcome${known || mode === 'register' ? ', ' + user.name.split(' ')[0] : ''}!`);
      setTimeout(() => { location.href = next; }, 350);
    });
  };

  /* ======================================================================
     Account
     ====================================================================== */
  P.account = () => {
    if (!Auth.user()) { location.replace('login.html?next=account.html'); return; }
    const TABS = [['profile', 'Profile'], ['orders', 'Order History'], ['addresses', 'Addresses'], ['loyalty', 'Loyalty Points']];
    let tab = TABS.some((t) => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'profile';
    let sub = 'online';
    const body = $('#acc-body');
    const user = () => Auth.user();

    const head = () => {
      $('#acc-welcome').innerHTML = `Welcome Back,<br>${esc(user().name)} <button class="u small" data-signout type="button">Sign Out</button>`;
      $('#acc-tabs').innerHTML = TABS.map(([k, l]) => `<button class="pill ${tab === k ? 'on' : ''}" data-tab="${k}" type="button">${l}</button>`).join('');
    };
    const views = {
      profile() {
        const u = user();
        return `<section class="card-p glass"><div class="row between"><h2>Personal Details</h2><button class="u small" data-edit-profile type="button">Edit</button></div>
          <p>Name: ${esc(u.name)}</p><p>Email: ${esc(u.email || '—')}</p><p>Mobile: ${esc(u.phone || '—')}${u.phone ? '' : ' <span class="muted xs">(add your mobile to see your store and online orders)</span>'}</p></section>`;
      },
      orders() {
        const u = user();
        const mine = u.phone ? S.orders().filter((o) => digits(o.customer.phone) === digits(u.phone)).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
        const list = mine.filter((o) => (sub === 'store') === (S.channelOf(o) === 'store'));
        const nOnline = mine.filter((o) => S.channelOf(o) !== 'store').length;
        return `<section class="card-p glass tabbed"><div class="subtabs"><button class="${sub === 'online' ? 'on' : ''}" data-sub="online" type="button">Online Purchases <span class="xs muted">(${nOnline})</span></button><button class="${sub === 'store' ? 'on' : ''}" data-sub="store" type="button">Store Purchases <span class="xs muted">(${mine.length - nOnline})</span></button></div>
          ${list.length ? `<div class="table-wrap"><table class="otable"><thead><tr><th>Order ID</th><th>Order Date</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead><tbody>${list.slice(0, 30).map((o) => `<tr><td>${S.channelOf(o) === 'store' ? 'ST' : 'SO'}${o.id}</td><td>${A.date(o.date)}</td><td class="num">${money(o.total)}</td><td>${statusText(o.status)}</td><td><button class="u" data-invoice="${o.id}" type="button">View</button></td></tr>`).join('')}</tbody></table></div>`
            : `<div class="empty-in">${icon('receipt', 34)}<p class="muted">${u.phone ? 'No ' + (sub === 'store' ? 'store' : 'online') + ' purchases yet.' : 'Add your mobile number to see your orders.'}</p></div>`}
          <p class="xs muted" style="padding:0 20px 16px">Buy in a showroom? Give the cashier your mobile number and the purchase appears here, with loyalty points.</p></section>`;
      },
      addresses() {
        const list = user().addresses || [];
        return `<div class="row between" style="margin-bottom:14px"><h2 class="h2s">Saved Addresses</h2><button class="u" data-addr-new type="button">Add New Address</button></div>
          ${list.length ? `<div class="addr-grid">${list.map((a) => `<article class="addr-card static glass"><div class="row between"><b>${esc(a.label || a.district)}</b>${a.default ? '<span class="tag-default">Default Address</span>' : ''}</div><p>${esc(a.name)}</p><p class="muted small">${esc(a.address)}, ${esc(a.district)}</p><p class="muted small">Phone: ${esc(a.phone)}</p><p class="small"><button class="u" data-addr-edit="${a.id}" type="button">Edit</button> <span class="sep">|</span> <button class="u" data-addr-del="${a.id}" type="button">Delete</button></p></article>`).join('')}</div>` : '<div class="empty-in glass card-p">No saved addresses yet.</div>'}`;
      },
      loyalty() {
        const u = user(); const pt = S.points(u.phone); const cfg = settings.loyalty;
        return `<section class="card-p glass"><div class="loy"><div><span class="xs muted">Available points</span><b class="bigp">${pt.balance}</b><span class="muted small">worth ${money(pt.value)}</span></div><div class="muted small" style="max-width:36ch">Earn 1 point for every ${money(cfg.earnPer)} you spend, online or in store. 1 point = ${money(cfg.pointValue)}. Redeem from ${cfg.minRedeem} points at checkout or at the counter.</div></div></section>
          <section class="card-p glass tabbed" style="margin-top:16px"><h3 class="sub">Points history</h3>${pt.history.length ? `<div class="table-wrap"><table class="otable"><tbody>${pt.history.slice(0, 20).map((h) => `<tr><td>${A.date(h.date)}</td><td>${esc(h.label)}</td><td class="num ${h.points > 0 ? 'ok' : 'err'}">${h.points > 0 ? '+' : ''}${h.points}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-in"><p class="muted">No points yet. Your first order earns some.</p></div>'}</section>`;
      }
    };
    const addrModal = (id) => {
      const list = user().addresses || []; const a = id ? list.find((x) => x.id === id) : null;
      const m = A.modal({
        title: a ? 'Edit address' : 'Add new address',
        body: `<form id="af" class="form-grid" novalidate><div class="field"><label>Label</label><input name="label" value="${esc(a ? a.label : '')}" placeholder="Home, Office…"></div><div class="field"><label>Full name *</label><input name="name" value="${esc(a ? a.name : user().name)}"><span class="msg">Enter a name.</span></div>
          <div class="field"><label>Mobile *</label><input name="phone" type="tel" value="${esc(a ? a.phone : user().phone || '')}"><span class="msg">Enter a valid mobile number.</span></div><div class="field"><label>District *</label><select name="district"><option value="">Select…</option>${S.districts.map((d) => `<option ${a && a.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="msg">Choose a district.</span></div>
          <div class="field full"><label>Address *</label><textarea name="address" rows="2">${esc(a ? a.address : '')}</textarea><span class="msg">Enter the full address.</span></div><label class="check full"><input type="checkbox" name="def" ${!a || a.default ? 'checked' : ''}> Make this my default address</label></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save address</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const f = $('#af', m.el).elements;
        const bad = { name: f.name.value.trim().length < 2, phone: !phoneOk(f.phone.value), district: !f.district.value, address: f.address.value.trim().length < 8 };
        Object.keys(bad).forEach((k) => f[k].closest('.field').classList.toggle('err', bad[k]));
        if (Object.values(bad).some(Boolean)) return;
        let l = (user().addresses || []).slice();
        const rec = { id: a ? a.id : A.uid(), label: f.label.value.trim() || f.district.value, name: f.name.value.trim(), phone: f.phone.value.trim(), email: a ? a.email : '', address: f.address.value.trim(), district: f.district.value, default: f.def.checked };
        if (rec.default) l = l.map((x) => Object.assign(x, { default: false }));
        if (a) l[l.findIndex((x) => x.id === a.id)] = rec; else l.push(rec);
        if (!l.some((x) => x.default)) l[0].default = true;
        Auth.save({ addresses: l }); m.close(); paint(); A.toast('Address saved');
      });
    };
    const profileModal = () => {
      const u = user();
      const m = A.modal({
        title: 'Edit personal details',
        body: `<form id="pf" class="col" novalidate><div class="field"><label>Name *</label><input name="name" value="${esc(u.name)}"><span class="msg">Enter your name.</span></div><div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email || '')}"><span class="msg">Enter a valid email.</span></div><div class="field"><label>Mobile</label><input name="phone" type="tel" value="${esc(u.phone || '')}" placeholder="01XXXXXXXXX"><span class="msg">Enter a valid mobile number.</span></div></form>`,
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>'
      });
      m.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save]')) return;
        const f = $('#pf', m.el).elements;
        const bad = { name: f.name.value.trim().length < 2, email: !!f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value), phone: !!f.phone.value && !phoneOk(f.phone.value) };
        Object.keys(bad).forEach((k) => f[k].closest('.field').classList.toggle('err', bad[k]));
        if (Object.values(bad).some(Boolean)) return;
        Auth.save({ name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() }); m.close(); paint(); A.toast('Profile updated');
      });
    };
    const paint = () => { head(); body.innerHTML = views[tab](); };
    document.addEventListener('click', (e) => {
      const t = e.target;
      const tb = t.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; try { history.replaceState(null, '', '#' + tab); } catch (er) { /* file:// */ } paint(); return; }
      const sb = t.closest('[data-sub]'); if (sb) { sub = sb.dataset.sub; paint(); return; }
      if (t.closest('[data-edit-profile]')) { profileModal(); return; }
      if (t.closest('[data-addr-new]')) { addrModal(null); return; }
      const ae = t.closest('[data-addr-edit]'); if (ae) { addrModal(ae.dataset.addrEdit); return; }
      const ad = t.closest('[data-addr-del]'); if (ad) { Auth.save({ addresses: (user().addresses || []).filter((a) => a.id !== ad.dataset.addrDel) }); paint(); A.toast('Address deleted'); return; }
      const iv = t.closest('[data-invoice]'); if (iv) { const o = S.order(iv.dataset.invoice); if (o) Shop.invoice(o); }
    });
    paint();
  };

  /* ======================================================================
     Store locations
     ====================================================================== */
  P.stores = () => {
    const rooms = S.showrooms();
    const fri = new Date().getDay() === 5;
    $('#store-list').innerHTML = rooms.map((l, i) => {
      const closed = fri && /Sat\s*–\s*Thu/.test(l.hours);
      return `<article class="store-big glass" data-i="${i}"><div class="store-head"><span class="store-ico">${icon('store', 24)}</span><div class="grow"><h2>${esc(l.name)}</h2><span class="badge ${closed ? 'b-err' : 'b-ok'}">${closed ? 'Closed today' : 'Open today'}</span></div></div>
        <p>${icon('pin', 16)} ${esc(l.address)}</p><p>${icon('clock', 16)} ${esc(l.hours)}</p><p>${icon('phone', 16)} <a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(l.phone)}</a></p>
        <div class="row gap-8 wrap"><a class="btn btn-primary" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.name + ' ' + l.address)}">${icon('mapnav', 16)} Get directions</a><a class="btn btn-outline" href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">Call</a></div></article>`;
    }).join('') || '<p class="muted">No showrooms listed yet.</p>';
    $('#map-pins').innerHTML = rooms.map((l, i) => `<span class="pin" style="left:${28 + i * 34}%;top:${34 + (i % 2) * 26}%" title="${esc(l.name)}">${icon('pin', 22)}<b>${esc(l.name.split(' ')[0])}</b></span>`).join('');
  };

  /* ======================================================================
     Policies
     ====================================================================== */
  const POLICIES = {
    shipping: ['Shipping Policy', ['Delivery inside Dhaka takes 1–2 working days and 3–5 working days elsewhere in Bangladesh.', 'Delivery charges are shown at checkout and depend on your location and order value. Orders above the free-delivery threshold ship free.', 'You can also pick your order up from any showroom at no charge.']],
    terms: ['Terms and Conditions', ['By placing an order you agree to provide accurate delivery information and to pay for the items you receive.', 'Prices and stock can change without notice. If an item sells out after you order, we will contact you for an alternative or a refund.', 'We may cancel orders that appear fraudulent or that we cannot fulfil.']],
    privacy: ['Privacy Policy', ['We collect the details you give us (name, phone, address, email) to process orders, provide support and run our loyalty programme.', 'We do not sell your personal information. Payment details for cards are handled by our payment partner.', 'You can ask us to correct or delete your information at any time.']],
    payment: ['Payment Policy', ['We accept Cash on Delivery, bKash, Nagad and cards. Digital payments may qualify for a discount shown at checkout.', 'For bKash and Nagad, send money to the number shown at checkout and enter the transaction ID. Orders are confirmed after verification.', 'Loyalty points can be combined with any other payment method.']],
    exchange: ['Exchange & Refund', ['Wrong size? Exchange within 7 days of delivery. Items must be unworn, unwashed and have their tags.', 'Exchange online by contacting us, or visit any showroom with your invoice.', 'Refunds are issued to the original payment method after the returned item passes inspection.']],
    size: ['Size Guide', ['Measure a panjabi that fits you well, lay it flat and compare it with the chart below. Between sizes? Choose the larger one for a relaxed fit.', 'TABLE']],
    loyalty: ['Loyalty Program', ['Earn 1 point for every ৳100 you spend online or in a showroom (give the cashier your mobile number).', 'Each point is worth ৳1 and can be redeemed from 100 points at checkout or at the counter.', 'Points from cancelled or refunded orders are removed.']]
  };
  P.policy = () => {
    const key = POLICIES[A.qs.get('p')] ? A.qs.get('p') : 'shipping';
    const [title, paras] = POLICIES[key];
    document.title = `${title} — ${settings.storeName}`;
    $('#policy-nav').innerHTML = Object.entries(POLICIES).map(([k, v]) => `<a href="policy.html?p=${k}" class="${k === key ? 'on' : ''}">${v[0]}</a>`).join('');
    $('#policy-body').innerHTML = `<h1>${esc(title)}</h1>` + paras.map((t) => (t === 'TABLE' ? `<div class="table-wrap"><table class="gtable"><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Sleeve</th></tr></thead><tbody><tr><td>S / 38</td><td>38"</td><td>39"</td><td>23.5"</td></tr><tr><td>M / 40</td><td>40"</td><td>40"</td><td>24"</td></tr><tr><td>L / 42</td><td>42"</td><td>41"</td><td>24.5"</td></tr><tr><td>XL / 44</td><td>44"</td><td>42"</td><td>25"</td></tr><tr><td>XXL / 46</td><td>46"</td><td>43"</td><td>25.5"</td></tr></tbody></table></div>` : `<p>${esc(t)}</p>`)).join('') + '<p class="xs muted" style="margin-top:22px">Template text. Replace it with your own policy before going live.</p>';
  };

  /* ======================================================================
     About + contact + track
     ====================================================================== */
  P.about = () => {
    const pub = S.published();
    $('#about-art').innerHTML = [pub.find((p) => p.id === 1), pub.find((p) => p.id === 4), pub.find((p) => p.id === 2)].filter(Boolean).map((p, i) => `<div class="tile-pj p${i}">${S.thumb(p)}</div>`).join('');
    const rated = pub.filter((p) => p.rating);
    const avg = (rated.reduce((n, p) => n + p.rating, 0) / rated.length).toFixed(1);
    $('#about-stats').innerHTML = [[pub.length, 'Panjabi designs'], [S.showrooms().length, S.showrooms().length === 1 ? 'Store' : 'Stores'], [avg + '★', 'Average rating (sample)'], ['64', 'Districts delivered']].map(([n, l]) => `<div><b>${n}</b><span class="muted small">${l}</span></div>`).join('');
  };
  P.contact = () => {
    $('#cc-msgr').href = settings.messenger;
    $('#cc-phone').href = 'tel:' + settings.phone.replace(/[^\d+]/g, '');
    $('#cc-mail').href = 'mailto:' + settings.email;
  };
  P.track = () => {
    const steps = [['Order placed', 'We received your order'], ['Confirmed', 'Our team verified your order'], ['Packed & shipped', 'Your parcel is on its way'], ['Delivered', 'Enjoy your panjabi!']];
    const stage = { pending: 0, 'on-hold': 0, processing: 1, shipped: 2, completed: 3 };
    const show = (id, phone) => {
      const out = $('#track-result');
      const o = S.order(String(id).replace(/[^\d]/g, ''));
      if (!o || !o.customer.phone || digits(o.customer.phone) !== digits(phone)) { out.innerHTML = `<div class="empty glass pad"><h3>We couldn't find that order</h3><p class="muted small">Check the order number and the mobile number you used at checkout.</p></div>`; return; }
      const dead = !S.isLive(o);
      const at = stage[o.status] ?? 0;
      out.innerHTML = `<div class="glass pad track-card"><div class="row between wrap"><div><span class="xs muted">Order</span><h2>#${o.id}</h2></div>${statusText(o.status)}</div>
        <p class="muted small">Placed on ${A.dateTime(o.date)} · ${esc(S.payLabel[o.payment])} · ${money(o.total)}${o.pickup ? ' · Pick up at ' + esc(S.locName(o.pickup)) : ''}${o.ship && o.ship.courier && S.isMerchant(o.ship.courier) ? ` · ${esc(S.courierName(o.ship.courier))}${o.ship.tracking ? ' <span class="mono">' + esc(o.ship.tracking) + '</span>' : ''}` : ''}</p>
        ${dead ? `<div class="pay-note glass-soft"><b>This order was ${esc(S.statusLabel(o.status).toLowerCase())}.</b> Contact us if you have any questions.</div>` : `<ol class="timeline">${steps.map(([t, s], i) => `<li class="${i <= at ? 'done' : ''} ${i === at ? 'now' : ''}"><span class="tl-dot">${i <= at ? icon('check', 14) : ''}</span><div><b>${t}</b><span class="xs muted" style="display:block">${s}</span></div></li>`).join('')}</ol>`}
        <hr>${o.items.map((i) => `<div class="sum-row"><span>${esc(i.name)} <span class="muted xs">· ${esc(S.sizeLabel(i.size))} × ${i.qty}</span></span><b class="num">${money(i.price * i.qty)}</b></div>`).join('')}</div>`;
    };
    $('#track-form').addEventListener('submit', (e) => { e.preventDefault(); show($('#t-id').value, $('#t-phone').value); });
    if (A.qs.get('order')) {
      $('#t-id').value = A.qs.get('order');
      const o = S.order(A.qs.get('order'));
      if (o && o.customer.phone) { $('#t-phone').value = o.customer.phone; show(o.id, o.customer.phone); }
    }
  };

  /* ======================================================================
     boot
     ====================================================================== */
  const page = document.body.dataset.page;
  Shop.mount(page);
  if (P[page]) P[page]();
  A.hydrate();
})();
