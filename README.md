# Amnu Fashion — Panjabi store: online shop + store counter + finance, one HTML template

A complete, dependency-free HTML/CSS/JS template for a Panjabi brand that sells **online and in its
own store** and wants both managed from one place:

* a glassmorphism **storefront** (neutral black / grey / red palette, laid out like a modern
  fashion e-commerce site);
* a **WordPress-style admin** with a **POS register**, per-size **inventory**, **purchasing**,
  daily **cash close**, and **finance & revenue** screens (P&L, expenses, accounts, reports).

No build step, no framework.

> **Everything here is sample content.** Product names, prices, reviews, orders, customers,
> phone numbers, store address and the about-us copy are placeholders. The only real value
> taken from the brief is the Facebook page link (`https://www.facebook.com/amnufashionbd/`).
> Replace the rest with the real business details (see [Making it real](#making-it-real)).

## Quick start

```bash
# any static server works
python3 -m http.server 8000      # then open http://localhost:8000
# or simply open index.html in Chromium / Chrome / Edge (file://)
```

* Storefront: `index.html`
* Admin: `admin/login.html` (demo only: any non-empty username and password signs in) or `admin/index.html`
* Store counter: `admin/pos.html`

> Opening files straight from disk works in Chromium-based browsers. Firefox gives every
> `file://` page its own storage, so storefront and admin won't share demo data there. Use a
> local server in Firefox/Safari.

## One system, two channels

Online orders and store sales live in **one orders table** (`channel: 'online' | 'store'`) and draw
from **one inventory**, so the numbers always agree:

| | Online | Store (POS) |
| --- | --- | --- |
| Where it's sold | `checkout.html` | `admin/pos.html` |
| Stock leaves | the store's stock (one single-store setup) | the same store stock |
| Stock granularity | per size | per size |
| Payment tenders | COD, bKash, Nagad, card | cash, card, bKash, Nagad, on credit (due), split across several |
| Money lands in | bank / wallets (COD settles into the bank) | cash drawer, bank, wallets |
| Customer record | by phone number | optional phone number; walk-ins allowed |
| Loyalty points | earn and redeem | earn and redeem |

What this gives you on the storefront side: **Find in store** (live stock in the store), **click &
collect** at checkout (deducts from the store's stock), and a **Store Purchases** list in the customer's
account next to their online orders. Points earned at the counter appear in the same account.

## What's included

### Storefront (`/`)

| Page | File |
| --- | --- |
| Home: hero tiles, category circles, new arrivals, offers, trending, reviews | `index.html` |
| Category landing · Shop (filters, sort, grid, pagination) | `category.html`, `shop.html` |
| Product: colour + size pickers, per-size stock, Find in store, size guide, reviews, related | `product.html` |
| Shopping bag (select items, coupon, summary) · slide-in bag on every page | `bag.html` |
| Checkout: address book, delivery method (home / courier / store pickup), COD or digital payment (bKash / Nagad / card), pay-online discount, loyalty points, VAT line when enabled | `checkout.html` |
| Order received · Track order | `thank-you.html`, `track-order.html` |
| Log in / register · My account (profile, order history split Online vs Store, addresses, loyalty points) | `login.html`, `account.html` |
| Store locations · Policies (shipping, terms, privacy, payment, exchange, size guide, loyalty) · About · Contact | `stores.html`, `policy.html`, `about.html`, `contact.html` |

### Admin (`/admin`)

| Area | Screens |
| --- | --- |
| **Sales** | Orders (online + store, filter by channel / payment, split tenders, restock on cancel) · Order detail (receipt, invoice, notes) · **POS register** · Customers (points, dues, online vs store spend, collect due) · Coupons · **Loyalty points** |
| **Catalog** | Products · Product editor (cost price, opening stock by size) · Categories · **Inventory** (stock by size, adjust, movement history, low-stock) · Media · Pages & Posts |
| **Purchasing** | **Suppliers** · **Purchase orders** (order, receive into stock, pay in part or full, what you owe) |
| **Finance** | **Finance overview** (revenue online vs store, gross profit, expenses, net profit, cash position) · **Expenses** · **Accounts & ledger** (cash, bank, bKash, Nagad; transfers; other income) · **Day close** (count the drawer, variance, deposit, Z-report) · **Reports** (sales, P&L, expenses, stock value, VAT, dues; CSV + print) · Analytics (channel filter) |
| **Site** | Appearance → Customize (live preview) · Plugins · Users (Cashier / Accountant roles) · Settings (Store & POS: VAT, BIN, receipt footer, pay-online discount) |

Extras: command palette (`Ctrl/⌘ + K`), collapsible sidebar, light/dark mode, WordPress-style list
tables (views, bulk actions, filters, sort, Screen Options), responsive down to phones,
keyboard-accessible charts with a "view as table" fallback.

### Typical day at the store

1. **Open** `pos.html`, pick the cashier. The drawer starts with yesterday's float.
2. **Sell**: tap a product (or type a SKU such as `AMN-1004-M` and press Enter), pick colour + size, add a
   customer's mobile number for points, apply a discount or redeem points, then **Pay**. Split the
   payment across cash / card / bKash / Nagad, or put part of it on credit. The receipt prints from the
   browser. **Hold** a bill to serve someone else first.
3. **Spend**: record cash paid out (tea, courier, repairs) under *Expenses*, paid from *Cash in hand*.
4. **Close**: in *Day close* count notes by denomination. The system shows expected cash (float + cash
   sales − cash expenses) against what you counted, the variance, and how much to deposit to the bank.
   Submitting locks the day and posts a **Z-report**.
5. **Owner view**: *Finance overview* shows online and store revenue side by side, profit and loss,
   and where the money is (cash, bank, wallets, owed by customers, owed to suppliers, stock at cost).

### How the money is counted

* **Revenue** = item subtotal − discounts (delivery charges and VAT are excluded). **Gross profit** =
  revenue − cost of goods sold (each product's unit cost × quantity). **Net profit** = gross profit +
  delivery charges collected − operating expenses.
* Cancelled and refunded orders are excluded and their pieces return to stock.
* Online prepaid orders count as cash received once they are *processing*; COD counts once *completed*
  (and is assumed to settle into the bank). Wallet receipts are settled to the bank weekly in the
  sample data.
* Customer dues (credit sales) and supplier balances are tracked as receivables / payables.
* Loyalty: 1 point per ৳100 spent, 1 point = ৳1, redeem from 100 points (all editable in
  *Loyalty points*). VAT defaults to **0 %** (off); set a rate in *Settings → Store & POS*.

## How the demo works

Products, orders, inventory, expenses, purchase orders, day closes, settings and uploads are saved
in the browser's `localStorage` (`amnu.*` keys), so every screen is functional without a server:

* Place an order on the storefront → it appears in **Admin → Orders**, reduces stock and moves money.
* Ring up a sale on the **POS** → it shows in Orders (channel *Store*), the customer's account,
  Day close, the ledger and the dashboard.
* Receive a **purchase order** → stock rises and the supplier balance updates.
* **Settings → Advanced** exports the data as JSON or resets everything to the sample content.

Sample data (about 60 days: online orders, store sales, expenses, purchases, day closes) is generated
deterministically relative to today, so dashboards and reports always have recent numbers. Traffic,
sessions and funnel stages are **simulated**; revenue and profit come from the orders.

Sample setup: **one store** (it also fulfils online orders), four suppliers, four accounts, and staff users
including a cashier and an accountant. There is deliberately no multi-branch feature.

**Brand:** your logo and the tagline *The Style You Love!* are in `assets/img/` and appear in the storefront
header and footer, the admin sidebar and login, the favicon and printed receipts. The admin uses a black +
gold palette taken from the logo.

## Design system

`assets/css/glass.css` holds the tokens and primitives; `store.css` and `admin.css` build on it.

```css
:root {
  --accent: #121216;        /* storefront accent: black (Appearance → Customize edits this) */
  --primary: #946a14;       /* admin gold (from the logo) */
  --glass-a: .4;            /* panel opacity */
  --blur: 22px;             /* backdrop blur */
  --r-lg: 24px;             /* corner radius */
}
```

* Surfaces use `backdrop-filter` with a solid fallback where it isn't supported.
* Dark mode is a real second theme (`[data-theme=dark]`), not an inversion.
* Product pictures are SVG illustrations generated from each product's colour + style
  (`Amnu.panjabi()` in `core.js`), so the template looks complete with no image assets.
  Uploading a photo in the admin replaces the illustration automatically.
* Charts follow one-axis, thin-mark rules with a colour-blind-safe blue / orange pair for online vs store.
* Fonts: Poppins, Manrope and Hind Siliguri (Bangla) from Google Fonts; system fonts are the fallback.

## Project structure

```
index.html shop.html product.html bag.html checkout.html …   storefront pages
admin/*.html                                                 admin pages
assets/css/  glass.css  store.css  admin.css
assets/js/   core.js          icons, storage, formatting, Panjabi SVG, modal/toast, theme
             data.js          sample data + the Amnu.store API  ← swap for your backend
             ops.js           store operations layer: store, per-size inventory, accounts +
                              ledger, expenses, suppliers / purchases, day close, loyalty, P&L
             store-core.js    storefront shell: header, footer, bag, search, auth
             store-pages.js   home · category · shop · product · bag · checkout · thank-you
             store-pages2.js  login · account · stores · policy · about · contact · track
             charts.js        dependency-free SVG charts (area, columns, stacked, bars)
             admin-core.js    admin shell, command palette, WP-style list table
             admin-pages.js   dashboard · products · editor · categories · orders · customers
             admin-pages2.js  coupons · media · pages · customize · analytics · users · plugins · settings
             admin-ops.js     POS · inventory · suppliers · purchases · day close · receipts
             admin-fin.js     finance overview · expenses · accounts · reports · loyalty
```

Header, footer and the admin shell are injected from JavaScript so they are written once. Page
bodies are plain HTML. Script order matters (classic scripts, no modules): `core` → `data` → `ops` →
the page scripts.

## Making it real

1. **Content.** Replace the arrays in `assets/js/data.js` (categories, products, copy), the
   store details / suppliers / accounts in `assets/js/ops.js`, the contact details in
   *Admin → Settings → General*, and the placeholder about-us text in `about.html`. Facebook content
   wasn't available when this was built, so no real photos, prices or descriptions were imported.
2. **Backend.** `Amnu.store` (in `data.js` and `ops.js`) is the only data layer: every screen calls it.
   Replace its methods with `fetch()` calls to your API. The money logic (ledger, P&L, stock moves)
   must run **server-side** in production: never trust totals computed in the browser.
3. **Authentication & roles.** `admin/login.html` is a demo and does **not** authenticate anyone, and
   the Cashier / Accountant roles are labels only. Anything in `/admin` is publicly reachable until you
   protect it server-side; a real system should limit cashiers to the POS and day close.
4. **Payments, receipts & hardware.** bKash / Nagad show the manual "send money + enter TrxID" flow;
   card payment, courier APIs and SMS are placeholders. Receipts print through the browser; for a
   thermal printer or barcode scanner, use a browser-print setup or a vendor SDK (a keyboard-style
   scanner already works in the POS search box).
5. **Tax.** VAT is a simple percentage on the order. Confirm rates, invoicing and BIN rules with your
   accountant before relying on the VAT report.
6. **As a WordPress / WooCommerce theme.** This is an HTML template, not a theme. A typical mapping:
   `index.html → front-page.php`, `shop.html → archive-product.php`,
   `product.html → single-product.php`, `bag.html` / `checkout.html → WooCommerce templates`,
   `assets/` → theme assets. The admin screens are a visual design you can build as a custom
   admin or use as a reference to restyle `wp-admin`.

## Browser support

Current Chrome, Edge, Firefox and Safari. Uses CSS `backdrop-filter`, `color-mix()` and
optional chaining. `prefers-reduced-motion` is respected.
