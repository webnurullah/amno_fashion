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

## How the business flows

```
Fabric (yards / inches)  →  Production  →  Showroom stock  →  Sales  →  Courier  →  Merchant balance  →  Bank
 warehouse, by cloth name    cut + stitch    finished panjabi   showroom,   Pathao /     cash on delivery      withdraw
 bought from suppliers       per design      by size            website,    Steadfast    minus their charges
                                                                Facebook /
                                                                WhatsApp
```

1. **Buy fabric** (*Fabric purchases*): enter the quantity in **yards or inches** (1 yd = 36 in). Receiving it adds
   to *Fabric stock* and re-averages the cost per yard. Unpaid amounts show as supplier dues.
2. **Know what you have** (*Fabric stock*): each cloth by name with yards **and** inches, cost, value, a reorder
   level, how many days it lasts at your recent pace, and which designs can be cut from it (and how many).
3. **One cloth, many designs.** Every design has a **recipe** in the product editor: fabric, yards per piece,
   making/tailoring cost, embroidery/buttons/packing. That gives the cost per piece and profit per design.
4. **Produce** (*Production*): start a batch, pick the design and pieces per size; the fabric is issued from the
   warehouse. When the tailor finishes, mark it ready: the pieces land in **showroom stock**, the design's cost
   is re-averaged, and the making cost is paid from cash or bank. Cancelling a batch returns the fabric.
5. **Sell** three ways, all from the same showroom stock:
   * **Showroom** (*POS*): customer pays at the counter.
   * **Website**: normal checkout.
   * **Facebook / WhatsApp / Instagram / phone** (*Social media order*): take the order by chat, choose
     **customer pays delivery or free delivery**, optionally record a bKash advance, pick the courier.
6. **Deliver** (*Couriers & COD*): book parcels with **Pathao** or **Steadfast** (or your own rider / showroom
   pickup). When delivered, the cash the courier collected lands in that courier's **merchant balance** minus
   their delivery and COD charges. Returned parcels restore stock and cost you the return charge.
7. **Withdraw**: move the merchant balance to your bank. The ledger records every step.

The **dashboard** shows this whole flow on one screen, sales by channel, delivery profit/loss (charged to
customers vs paid to couriers), courier balances and return rates, fabric about to run out, what is in
production, and plain-language insights computed from the numbers. *Reports* adds fabric & production and
couriers tabs.

## One system, three sales channels

Showroom, website and social-media orders share **one orders table** (`channel: 'store' | 'online' | 'social'`)
and **one showroom stock** (per size):

| | Showroom | Website | Social media |
| --- | --- | --- | --- |
| Where it is taken | `admin/pos.html` | `checkout.html` | `admin/order-new.html` |
| Payment | cash, card, bKash, Nagad, on credit | COD, bKash, Nagad, card | bKash advance + cash on delivery |
| Delivery | customer takes it | courier | courier (charged or free delivery) |
| Cash arrives in | cash drawer / bank / wallets | wallets, or courier balance (COD) | wallets, or courier balance (COD) |

Cancelling or returning an order puts the pieces back on the shelf. The storefront also has **Find in store**,
**click & collect**, loyalty points and order tracking that shows the courier and tracking number.

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

Sample setup: **one store** (it also fulfils online orders), twelve fabrics, five suppliers, Pathao and Steadfast merchant accounts, six accounts in total, and staff users
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
