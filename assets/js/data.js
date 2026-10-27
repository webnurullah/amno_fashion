/* ==========================================================================
   Amnu Fashion — sample data + store API
   Everything here is DEMO content.  Replace the seed arrays, or swap the
   Amnu.store methods for fetch() calls to your backend / WordPress REST API.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.Amnu;
  const DAY = 864e5;
  const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

  /* deterministic PRNG so seeded orders are identical on every load */
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- settings ---------- */
  const DEFAULT_SETTINGS = {
    storeName: 'Amnu Fashion',
    tagline: 'Premium Panjabi collection for every occasion',
    email: 'hello@example.com',
    phone: '+880 1700-000000',
    address: 'House 00, Road 00, Dhaka, Bangladesh',
    facebook: 'https://www.facebook.com/amnufashionbd/',
    messenger: 'https://m.me/amnufashionbd',
    currency: 'BDT',
    shipping: { dhaka: 70, outside: 130, freeOver: 5000 },
    payments: { cod: true, bkash: true, nagad: true, card: false },
    bkashNumber: '01700-000000',
    nagadNumber: '01700-000001',
    lowStock: 5,
    heroTitle: 'Choose Your Best Panjabi',
    heroSub: "They're all so nice",
    announcement: 'Free delivery on orders over ৳5,000  ·  Cash on Delivery available all over Bangladesh'
  };

  const DISTRICTS = ['Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapainawabganj', 'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokathi', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'];

  const SIZES_MEN = ['M', 'L', 'XL', 'XXL'];
  const SIZES_KIDS = ['2Y', '4Y', '6Y', '8Y', '10Y'];

  /* ---------- categories ---------- */
  const SEED_CATEGORIES = [
    { id: 1, slug: 'eid', name: 'Eid Collection', desc: 'Festive panjabis for Eid and celebrations' },
    { id: 2, slug: 'wedding', name: 'Wedding & Groom', desc: 'Statement pieces for the big day' },
    { id: 3, slug: 'embroidered', name: 'Embroidered', desc: 'Hand-finished chest and placket work' },
    { id: 4, slug: 'cotton', name: 'Casual Cotton', desc: 'Everyday comfort, breathable cotton' },
    { id: 5, slug: 'silk', name: 'Silk & Jamdani', desc: 'Silk-touch and jamdani woven fabrics' },
    { id: 6, slug: 'kids', name: 'Kids Panjabi', desc: 'Little ones, big occasions' },
    { id: 7, slug: 'sets', name: 'Panjabi Sets', desc: 'Panjabi + pajama ready sets' }
  ];

  /* ---------- products ---------- */
  const COLOR_SETS = {
    navy: [['Royal Navy', '#1f2a5c'], ['Maroon', '#6d1f3a'], ['Forest', '#14573f']],
    ivory: [['Ivory', '#efe5cf'], ['Sky', '#cfe0f3'], ['Mint', '#cfe9dd']],
    green: [['Emerald', '#0f6b4f'], ['Ink Blue', '#223a6b']],
    maroon: [['Maroon', '#7a1f33'], ['Midnight', '#1d1f3a'], ['Bottle Green', '#14573f']],
    sky: [['Sky Blue', '#7fb2e5'], ['Powder Pink', '#f0c6d0'], ['Sage', '#a9c2a4']],
    grey: [['Charcoal', '#3a3d4a'], ['Navy', '#26335f'], ['Olive', '#5c6b3a']],
    mint: [['Mint', '#a8dcc8'], ['Lilac', '#cdbdf0'], ['Peach', '#f6c9b4']],
    mustard: [['Mustard', '#e0a82e'], ['Terracotta', '#c4623a'], ['Teal', '#1c7a86']],
    black: [['Black', '#17171c'], ['Navy', '#1b2344'], ['Brown', '#4a3226']],
    beige: [['Beige', '#cdb89a'], ['Stone', '#b8b4aa'], ['White', '#f3f1ec']],
    peach: [['Peach', '#f2a98c'], ['Rose', '#e08aa3']],
    wine: [['Wine', '#5a1730'], ['Black', '#17171c']],
    kblue: [['Royal Blue', '#2f5fd0'], ['Green', '#1f8a5b'], ['Orange', '#e8833a']],
    cream: [['Cream', '#f1e4c8'], ['White', '#f6f6f2']],
    olive: [['Olive', '#6b7a3a'], ['Khaki', '#b5a57a']],
    pearl: [['Pearl White', '#f4f4f1'], ['Sand', '#e6dccb']],
    teal: [['Teal', '#0f7c86'], ['Plum', '#6a2c70']],
    rust: [['Rust', '#b4542a'], ['Mustard', '#d7a02e']],
    sand: [['Sand', '#d8c4a3'], ['Grey', '#9a9aa5']]
  };

  const FABRIC_COPY = {
    embroidered: 'beautifully embroidered with fine placket and chest detailing',
    jacquard: 'richly woven with a subtle jacquard motif',
    stripe: 'finished with a refined tonal pintuck texture',
    plain: 'cut in a clean, classic silhouette'
  };

  function mkProduct(id, name, cats, price, sale, set, style, fabric, o) {
    const colors = COLOR_SETS[set].map((c) => ({ name: c[0], hex: c[1] }));
    const kids = cats.includes('kids');
    return Object.assign({
      id, slug: A.slug(name), name, cats, price, sale: sale || null, cost: Math.round(price * 0.56),
      sku: 'AMN-' + String(1000 + id), stock: 20, status: 'publish', badge: '', featured: false,
      rating: 4.7, reviews: 40, sold: 60, created: daysAgo(id * 6),
      color: colors[0].hex, colorName: colors[0].name, colors, style, fabric,
      sizes: kids ? SIZES_KIDS : SIZES_MEN,
      short: `A ${style === 'plain' ? 'clean, classic' : style === 'embroidered' ? 'beautifully embroidered' : style === 'jacquard' ? 'richly woven jacquard' : 'subtly textured'} panjabi in ${fabric}. Soft on the skin, structured in drape.`,
      long: `<p>Tailored from ${fabric}, this panjabi is ${FABRIC_COPY[style]}. A mandarin collar, concealed side slits and a tailored placket give it a modern yet traditional look that works from Friday prayers to wedding evenings.</p><ul><li>Fabric: ${fabric}</li><li>Fit: regular, mandarin collar, full sleeves</li><li>Placket: hand-set buttons</li><li>Care: gentle machine wash, cool iron on reverse</li></ul>`,
      tags: [style, kids ? 'kids' : 'men', fabric.split(' ')[0]],
      weight: kids ? 0.3 : 0.5, image: '', gallery: []
    }, o || {});
  }

  const SEED_PRODUCTS = [
    mkProduct(1, 'Royal Navy Jacquard Panjabi', ['wedding', 'eid'], 4850, 0, 'navy', 'jacquard', 'premium jacquard cotton', { badge: 'Best Seller', featured: true, stock: 24, rating: 4.9, reviews: 128, sold: 312 }),
    mkProduct(2, 'Ivory Gold Embroidered Panjabi', ['eid', 'embroidered'], 5200, 4490, 'ivory', 'embroidered', 'soft cotton-silk blend', { badge: 'Sale', featured: true, stock: 12, rating: 4.8, reviews: 96, sold: 188 }),
    mkProduct(3, 'Emerald Silk Panjabi', ['silk'], 3950, 0, 'green', 'plain', 'silk-touch fabric', { badge: 'New', stock: 18, rating: 4.7, reviews: 41, sold: 74 }),
    mkProduct(4, 'Maroon Zari Wedding Panjabi', ['wedding', 'embroidered'], 6450, 0, 'maroon', 'embroidered', 'zari-worked raw silk', { featured: true, stock: 8, rating: 4.9, reviews: 74, sold: 121 }),
    mkProduct(5, 'Sky Blue Cotton Casual Panjabi', ['cotton'], 1950, 0, 'sky', 'plain', '100% combed cotton', { stock: 40, rating: 4.6, reviews: 210, sold: 540 }),
    mkProduct(6, 'Charcoal Pintuck Panjabi', ['cotton'], 2350, 0, 'grey', 'stripe', 'cotton twill', { stock: 30, rating: 4.7, reviews: 88, sold: 203 }),
    mkProduct(7, 'Mint Chikankari Panjabi', ['embroidered', 'eid'], 3650, 0, 'mint', 'embroidered', 'cotton voile', { badge: 'New', stock: 15, rating: 4.8, reviews: 52, sold: 97 }),
    mkProduct(8, 'Mustard Eid Special Panjabi', ['eid'], 2990, 2490, 'mustard', 'plain', 'cotton slub', { badge: 'Sale', stock: 22, rating: 4.6, reviews: 63, sold: 168 }),
    mkProduct(9, 'Black Premium Cotton Panjabi', ['cotton', 'eid'], 2650, 0, 'black', 'plain', 'premium cotton', { badge: 'Best Seller', featured: true, stock: 36, rating: 4.8, reviews: 187, sold: 466 }),
    mkProduct(10, 'Beige Linen Panjabi', ['cotton'], 2250, 0, 'beige', 'stripe', 'linen blend', { stock: 3, rating: 4.5, reviews: 29, sold: 85 }),
    mkProduct(11, 'Peach Jamdani Panjabi', ['silk'], 4250, 0, 'peach', 'jacquard', 'jamdani-woven cotton', { badge: 'New', stock: 10, rating: 4.9, reviews: 33, sold: 58 }),
    mkProduct(12, 'Wine Velvet Groom Panjabi', ['wedding'], 7950, 6990, 'wine', 'embroidered', 'velvet', { featured: true, badge: 'Sale', stock: 5, rating: 5, reviews: 21, sold: 39 }),
    mkProduct(13, 'Kids Royal Blue Panjabi Set', ['kids', 'sets'], 1650, 0, 'kblue', 'plain', 'soft cotton', { stock: 28, rating: 4.8, reviews: 57, sold: 144 }),
    mkProduct(14, 'Kids Cream Eid Panjabi', ['kids', 'eid'], 1450, 0, 'cream', 'embroidered', 'cotton voile', { stock: 0, rating: 4.7, reviews: 44, sold: 130 }),
    mkProduct(15, 'Olive Green Casual Panjabi', ['cotton'], 2150, 0, 'olive', 'plain', 'washed cotton', { stock: 26, rating: 4.5, reviews: 36, sold: 92 }),
    mkProduct(16, 'Pearl White Panjabi & Pajama Set', ['sets', 'eid'], 3250, 0, 'pearl', 'plain', 'cotton-linen blend', { badge: 'Set', stock: 20, rating: 4.8, reviews: 71, sold: 156 }),
    mkProduct(17, 'Teal Embroidered Festive Panjabi', ['embroidered'], 3850, 0, 'teal', 'embroidered', 'cotton-silk blend', { stock: 14, rating: 4.7, reviews: 26, sold: 49 }),
    mkProduct(18, 'Rust Orange Linen Panjabi', ['cotton'], 2450, 0, 'rust', 'stripe', 'linen blend', { badge: 'New', stock: 19, rating: 4.6, reviews: 18, sold: 33 }),
    mkProduct(19, 'Sand Dune Jacquard Panjabi', ['wedding'], 4650, 0, 'sand', 'jacquard', 'jacquard cotton', { status: 'draft', stock: 12, rating: 0, reviews: 0, sold: 0 })
  ];

  /* ---------- people, orders ---------- */
  const SEED_NAMES = ['Tanvir Ahmed', 'Sabbir Hossain', 'Rafiul Karim', 'Imran Chowdhury', 'Mahin Rahman', 'Nafis Sarker', 'Arif Hasan', 'Shihab Uddin', 'Fahim Islam', 'Rakib Mia', 'Tahmid Khan', 'Zubayer Alam', 'Nayeem Biswas', 'Raihan Talukder', 'Sakib Mondal', 'Mehedi Hasan', 'Asif Iqbal', 'Jubayer Ali', 'Rony Das', 'Sourav Paul', 'Hasib Reza', 'Ayman Sadik', 'Farhan Kabir', 'Mamun Sheikh', 'Yeasin Arafat', 'Sadman Rahat', 'Minhaz Hridoy', 'Ishtiak Noor', 'Tamim Hridoy', 'Omar Faruk'];
  const SEED_DISTRICTS = ['Dhaka', 'Dhaka', 'Dhaka', 'Dhaka', 'Dhaka', 'Chattogram', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Cumilla', 'Gazipur', 'Narayanganj', 'Mymensingh', 'Rangpur', 'Barishal', 'Bogura', 'Cox\'s Bazar'];
  const STREETS = ['House 12, Road 5', 'Flat 4B, Block C', 'Plot 27, Sector 7', 'House 8, Lane 3', 'Flat 6A, Road 11', 'House 33, Avenue 2'];
  const SEED_CUSTOMERS = SEED_NAMES.map((name, i) => ({
    name,
    phone: '01700-0000' + String(i + 10).padStart(2, '0'),
    email: A.slug(name).replace(/-/g, '.') + '@example.com',
    district: SEED_DISTRICTS[i % SEED_DISTRICTS.length],
    address: STREETS[i % STREETS.length]
  }));

  const PAY_KEYS = ['cod', 'cod', 'cod', 'bkash', 'bkash', 'nagad', 'card'];
  const PAY_LABEL = { cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad', card: 'Card' };

  function shippingFor(district, subtotal, settings) {
    const s = (settings || A.store.settings()).shipping;
    if (subtotal >= s.freeOver) return 0;
    return district === 'Dhaka' ? s.dhaka : s.outside;
  }

  function genOrders() {
    const r = rng(2027);
    const days = 60;
    const list = [];
    const now = Date.now();
    const t0 = new Date(now).setHours(0, 0, 0, 0);
    for (let d = days - 1; d >= 0; d--) {
      const growth = 1 + ((days - d) / days) * 0.8;
      const count = Math.round((3 + r() * 1.8) * growth);
      for (let k = 0; k < count; k++) {
        const cust = SEED_CUSTOMERS[Math.floor(Math.pow(r(), 1.15) * SEED_CUSTOMERS.length)];
        const lines = 1 + Math.floor(r() * r() * 3);
        const items = [];
        for (let l = 0; l < lines; l++) {
          const p = SEED_PRODUCTS[Math.floor(r() * 18)];
          const size = p.sizes[Math.floor(r() * p.sizes.length)];
          const price = p.sale || p.price;
          if (!items.some((x) => x.pid === p.id)) items.push({ pid: p.id, name: p.name, price, cost: p.cost, qty: 1 + (r() > 0.82 ? 1 : 0), size, color: p.colorName, hex: p.color, style: p.style });
        }
        const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const shipping = shippingFor(cust.district, subtotal, DEFAULT_SETTINGS);
        const useCoupon = r() > 0.82 && subtotal >= 2000;
        const discount = useCoupon ? 200 : 0;
        /* calendar-day based; today's orders are spread over the hours so far */
        const ts = d === 0 ? Math.min(now, t0 + r() * Math.max(now - t0, 1)) : t0 - d * DAY + r() * DAY;
        const age = (now - ts) / DAY;
        const roll = r();
        let status;
        if (age > 6) status = roll < 0.84 ? 'completed' : roll < 0.92 ? 'cancelled' : roll < 0.96 ? 'refunded' : 'completed';
        else if (age > 2) status = roll < 0.55 ? 'completed' : roll < 0.9 ? 'processing' : 'on-hold';
        else status = roll < 0.25 ? 'pending' : roll < 0.8 ? 'processing' : 'on-hold';
        const payment = PAY_KEYS[Math.floor(r() * PAY_KEYS.length)];
        list.push({
          date: new Date(ts).toISOString(),
          status, customer: cust, items, subtotal, shipping, discount, coupon: useCoupon ? 'EID200' : '',
          total: subtotal + shipping - discount, payment, payRef: payment === 'cod' ? '' : 'TX' + Math.floor(r() * 9e7 + 1e7), note: '', notes: []
        });
      }
    }
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    list.forEach((o, i) => { o.id = 1001 + i; });
    return list;
  }

  /* ---------- misc seeds ---------- */
  const SEED_COUPONS = [
    { code: 'WELCOME10', type: 'percent', value: 10, min: 1500, limit: 500, used: 142, expires: '2027-12-31', status: 'active', desc: '10% off for first-time customers' },
    { code: 'EID200', type: 'fixed', value: 200, min: 2000, limit: 300, used: 87, expires: '2027-06-30', status: 'active', desc: '৳200 off Eid orders' },
    { code: 'AMNU15', type: 'percent', value: 15, min: 4000, limit: 100, used: 23, expires: '2027-03-31', status: 'active', desc: '15% off premium orders' },
    { code: 'FREESHIP', type: 'shipping', value: 0, min: 2500, limit: 200, used: 61, expires: '2027-09-30', status: 'active', desc: 'Free delivery' },
    { code: 'FLASH20', type: 'percent', value: 20, min: 3000, limit: 50, used: 50, expires: '2026-08-15', status: 'expired', desc: 'Flash sale (ended)' }
  ];

  const SEED_PAGES = [
    { id: 1, type: 'page', title: 'Home', slug: '/', author: 'Amnu Admin', status: 'publish', date: daysAgo(120), file: 'index.html' },
    { id: 2, type: 'page', title: 'Shop', slug: '/shop', author: 'Amnu Admin', status: 'publish', date: daysAgo(120), file: 'shop.html' },
    { id: 3, type: 'page', title: 'About Us', slug: '/about', author: 'Amnu Admin', status: 'publish', date: daysAgo(110), file: 'about.html' },
    { id: 4, type: 'page', title: 'Contact', slug: '/contact', author: 'Amnu Admin', status: 'publish', date: daysAgo(110), file: 'contact.html' },
    { id: 5, type: 'page', title: 'Track Your Order', slug: '/track-order', author: 'Amnu Admin', status: 'publish', date: daysAgo(100), file: 'track-order.html' },
    { id: 6, type: 'page', title: 'Return & Exchange Policy', slug: '/returns', author: 'Shop Manager', status: 'publish', date: daysAgo(90) },
    { id: 7, type: 'page', title: 'Privacy Policy', slug: '/privacy', author: 'Shop Manager', status: 'draft', date: daysAgo(30) },
    { id: 8, type: 'post', title: 'Eid Panjabi Style Guide: What to Wear This Season', slug: '/blog/eid-style-guide', author: 'Content Editor', status: 'publish', date: daysAgo(14), cat: 'Style Guide' },
    { id: 9, type: 'post', title: 'How to Measure Your Panjabi Size at Home', slug: '/blog/measure-size', author: 'Content Editor', status: 'publish', date: daysAgo(32), cat: 'Guides' },
    { id: 10, type: 'post', title: 'Cotton vs Silk: Choosing the Right Fabric', slug: '/blog/cotton-vs-silk', author: 'Content Editor', status: 'publish', date: daysAgo(58), cat: 'Guides' },
    { id: 11, type: 'post', title: 'Wedding Season Lookbook (Draft)', slug: '/blog/wedding-lookbook', author: 'Amnu Admin', status: 'draft', date: daysAgo(3), cat: 'Lookbook' }
  ];

  const SEED_USERS = [
    { id: 1, name: 'Amnu Admin', username: 'admin', email: 'admin@example.com', role: 'Administrator', date: daysAgo(400), posts: 6 },
    { id: 2, name: 'Shop Manager', username: 'manager', email: 'manager@example.com', role: 'Shop Manager', date: daysAgo(300), posts: 2 },
    { id: 3, name: 'Content Editor', username: 'editor', email: 'editor@example.com', role: 'Editor', date: daysAgo(210), posts: 3 },
    { id: 4, name: 'Support Agent', username: 'support', email: 'support@example.com', role: 'Customer Support', date: daysAgo(90), posts: 0 }
  ];

  const SEED_PLUGINS = [
    { id: 'bkash', name: 'bKash Payment Gateway', desc: 'Accept bKash payments with automatic transaction ID verification.', cat: 'Payments', icon: 'wallet', active: true },
    { id: 'nagad', name: 'Nagad Payment Gateway', desc: 'Merchant checkout for Nagad wallet payments.', cat: 'Payments', icon: 'wallet', active: true },
    { id: 'sslcommerz', name: 'SSLCommerz Cards', desc: 'Visa, MasterCard, DBBL and internet banking via SSLCommerz.', cat: 'Payments', icon: 'card', active: false },
    { id: 'pathao', name: 'Pathao Courier', desc: 'Create parcels and track deliveries without leaving the order screen.', cat: 'Shipping', icon: 'truck', active: true },
    { id: 'steadfast', name: 'Steadfast Courier', desc: 'Push orders to Steadfast and sync delivery status.', cat: 'Shipping', icon: 'truck', active: false },
    { id: 'fbpixel', name: 'Facebook Pixel & Conversions API', desc: 'Track purchases and build lookalike audiences from your Facebook page.', cat: 'Marketing', icon: 'facebook', active: true },
    { id: 'ga4', name: 'Google Analytics 4', desc: 'Enhanced e-commerce reporting for your storefront.', cat: 'Analytics', icon: 'chart', active: false },
    { id: 'seo', name: 'Amnu SEO Pack', desc: 'Titles, meta descriptions, sitemaps and product schema.', cat: 'SEO', icon: 'search', active: true },
    { id: 'whatsapp', name: 'WhatsApp & Messenger Chat', desc: 'Floating chat button with pre-filled product messages.', cat: 'Support', icon: 'message', active: true },
    { id: 'sms', name: 'Bulk SMS Notifications', desc: 'Order confirmation and delivery SMS in Bangla and English.', cat: 'Support', icon: 'phone', active: false }
  ];

  const REVIEW_TEXT = [
    'Fabric quality is excellent and the fitting is perfect. Got so many compliments on Eid!',
    'Colour looks exactly like the photos. Delivery was quick and packaging was neat.',
    'Very comfortable for long hours. The stitching and placket finishing are really clean.',
    'Good value for the price. Will definitely order again for the wedding season.',
    'The size guide was accurate, M fits me perfectly. Highly recommended.',
    'Soft fabric, does not wrinkle much. Exactly what I wanted for Friday prayers.'
  ];

  /* ---------- store API ---------- */
  const DB = A.DB;
  const store = (A.store = {});

  store.districts = DISTRICTS;
  store.payLabel = PAY_LABEL;
  store.statuses = [
    ['pending', 'Pending payment', 'b-warn'], ['processing', 'Processing', 'b-info'], ['on-hold', 'On hold', 'b-accent'],
    ['completed', 'Completed', 'b-ok'], ['cancelled', 'Cancelled', 'b-err'], ['refunded', 'Refunded', '']
  ];
  store.statusLabel = (s) => (store.statuses.find((x) => x[0] === s) || [s, s])[1];
  store.statusBadge = (s) => `<span class="badge ${(store.statuses.find((x) => x[0] === s) || [])[2] || ''}">${A.esc(store.statusLabel(s))}</span>`;

  store.settings = () => Object.assign({}, DEFAULT_SETTINGS, DB.get('settings', {}), { shipping: Object.assign({}, DEFAULT_SETTINGS.shipping, (DB.get('settings', {}) || {}).shipping), payments: Object.assign({}, DEFAULT_SETTINGS.payments, (DB.get('settings', {}) || {}).payments) });
  store.saveSettings = (patch) => DB.set('settings', Object.assign({}, DB.get('settings', {}), patch));
  store.look = () => DB.get('look', null);
  store.shipping = shippingFor;

  /* categories (counts are derived) */
  store.categories = () => DB.get('categories', null) || (DB.set('categories', SEED_CATEGORIES), SEED_CATEGORIES.slice());
  store.saveCategories = (list) => DB.set('categories', list);
  store.categoryCount = (slug) => store.products().filter((p) => p.status === 'publish' && p.cats.includes(slug)).length;

  /* products */
  store.products = () => DB.get('products', null) || (DB.set('products', SEED_PRODUCTS), SEED_PRODUCTS.map((p) => Object.assign({}, p)));
  store.published = () => store.products().filter((p) => p.status === 'publish');
  store.saveProducts = (list) => DB.set('products', list);
  store.product = (key) => store.products().find((p) => String(p.id) === String(key) || p.slug === key);
  store.upsertProduct = (p) => {
    const list = store.products();
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = p; else list.unshift(p);
    return store.saveProducts(list);
  };
  store.nextProductId = () => store.products().reduce((m, p) => Math.max(m, p.id), 0) + 1;
  store.deleteProducts = (ids) => store.saveProducts(store.products().filter((p) => !ids.includes(p.id)));
  store.price = (p) => p.sale || p.price;
  store.stockState = (p) => (p.stock <= 0 ? 'out' : p.stock <= store.settings().lowStock ? 'low' : 'in');
  store.thumb = (p, view, hex, style) => {
    if (p.image && !view) return `<img class="pj" src="${A.esc(p.image)}" alt="${A.esc(p.name)}" loading="lazy">`;
    if (p.image && view && view !== 'front') return A.panjabi(hex || p.color, style || p.style, view);
    if (p.image) return `<img class="pj" src="${A.esc(p.image)}" alt="${A.esc(p.name)}">`;
    return A.panjabi(hex || p.color, style || p.style, view || 'front');
  };
  store.reviews = (p) => {
    const r = rng(p.id * 97);
    return Array.from({ length: Math.min(4, Math.max(2, Math.round(p.reviews / 30))) }, (_, i) => ({
      name: SEED_NAMES[Math.floor(r() * SEED_NAMES.length)], rating: r() > 0.25 ? 5 : 4,
      text: REVIEW_TEXT[Math.floor(r() * REVIEW_TEXT.length)], date: daysAgo(4 + i * 9 + Math.floor(r() * 5))
    }));
  };

  /* wishlist */
  store.wishlist = () => DB.get('wishlist', []);
  store.toggleWish = (id) => {
    const w = store.wishlist();
    const i = w.indexOf(id);
    if (i >= 0) w.splice(i, 1); else w.push(id);
    DB.set('wishlist', w);
    return i < 0;
  };

  /* orders = generated seed + new (checkout) + patches (admin edits) − deleted */
  let seedOrders;
  store.orders = () => {
    seedOrders = seedOrders || genOrders();
    const patch = DB.get('orders.patch', {});
    const del = DB.get('orders.del', []);
    return seedOrders.concat(DB.get('orders.new', []))
      .filter((o) => !del.includes(o.id))
      .map((o) => (patch[o.id] ? Object.assign({}, o, patch[o.id]) : o));
  };
  store.order = (id) => store.orders().find((o) => String(o.id) === String(id));
  store.addOrder = (o) => {
    seedOrders = seedOrders || genOrders();
    const fresh = DB.get('orders.new', []);
    const id = 1001 + seedOrders.length + fresh.length;
    const order = Object.assign({ id, date: new Date().toISOString(), status: 'pending', notes: [] }, o);
    fresh.push(order);
    DB.set('orders.new', fresh);
    /* reduce stock */
    const list = store.products();
    order.items.forEach((it) => { const p = list.find((x) => x.id === it.pid); if (p) { p.stock = Math.max(0, p.stock - it.qty); p.sold = (p.sold || 0) + it.qty; } });
    store.saveProducts(list);
    return order;
  };
  store.patchOrder = (id, patch) => { const all = DB.get('orders.patch', {}); all[id] = Object.assign({}, all[id], patch); return DB.set('orders.patch', all); };
  store.deleteOrders = (ids) => DB.set('orders.del', DB.get('orders.del', []).concat(ids));

  store.customers = () => {
    const map = new Map();
    store.orders().forEach((o) => {
      const key = o.customer.phone;
      const c = map.get(key) || Object.assign({}, o.customer, { orders: 0, spent: 0, first: o.date, last: o.date });
      c.orders += 1;
      if (o.status !== 'cancelled' && o.status !== 'refunded') c.spent += o.total;
      if (new Date(o.date) > new Date(c.last)) c.last = o.date;
      if (new Date(o.date) < new Date(c.first)) c.first = o.date;
      map.set(key, c);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  };

  /* coupons */
  store.coupons = () => DB.get('coupons', null) || (DB.set('coupons', SEED_COUPONS), SEED_COUPONS.map((c) => Object.assign({}, c)));
  store.saveCoupons = (l) => DB.set('coupons', l);
  store.findCoupon = (code) => store.coupons().find((c) => c.code.toLowerCase() === String(code).trim().toLowerCase());
  /** returns {ok, discount, freeShip, error} */
  store.applyCoupon = (code, subtotal) => {
    const c = store.findCoupon(code);
    if (!c) return { ok: false, error: 'That coupon code does not exist.' };
    if (c.status !== 'active' || new Date(c.expires) < new Date()) return { ok: false, error: 'This coupon has expired.' };
    if (c.limit && c.used >= c.limit) return { ok: false, error: 'This coupon has reached its usage limit.' };
    if (subtotal < c.min) return { ok: false, error: `Spend ${A.money(c.min)} or more to use ${c.code}.` };
    if (c.type === 'percent') return { ok: true, coupon: c, discount: Math.round(subtotal * c.value / 100) };
    if (c.type === 'fixed') return { ok: true, coupon: c, discount: Math.min(c.value, subtotal) };
    return { ok: true, coupon: c, discount: 0, freeShip: true };
  };

  /* pages, users, plugins, media */
  store.pages = () => DB.get('pages', null) || (DB.set('pages', SEED_PAGES), SEED_PAGES.map((p) => Object.assign({}, p)));
  store.savePages = (l) => DB.set('pages', l);
  store.users = () => DB.get('users', null) || (DB.set('users', SEED_USERS), SEED_USERS.map((u) => Object.assign({}, u)));
  store.saveUsers = (l) => DB.set('users', l);
  store.plugins = () => DB.get('plugins', null) || (DB.set('plugins', SEED_PLUGINS), SEED_PLUGINS.map((p) => Object.assign({}, p)));
  store.savePlugins = (l) => DB.set('plugins', l);
  store.media = () => DB.get('media', []);
  store.saveMedia = (l) => DB.set('media', l);

  store.seedProducts = SEED_PRODUCTS;
})();
