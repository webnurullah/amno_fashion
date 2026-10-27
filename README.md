# Amnu Fashion — Panjabi e-commerce HTML template

A complete, dependency-free HTML/CSS/JS template for a Panjabi store: a glassmorphism
**storefront** plus a **WordPress-style admin dashboard**. No build step, no framework.

> **Everything here is sample content.** Product names, prices, reviews, orders, customers,
> phone numbers and the about-us copy are placeholders. The only real value taken from the
> brief is the Facebook page link (`https://www.facebook.com/amnufashionbd/`). Replace the rest
> with the real business details (see [Making it real](#making-it-real)).

## Quick start

```bash
# any static server works
python3 -m http.server 8000      # then open http://localhost:8000
# or simply open index.html in Chromium / Chrome / Edge (file://)
```

* Storefront: `index.html`
* Admin: `admin/login.html` (demo only: any non-empty username and password signs in) or `admin/index.html`

> Opening files straight from disk works in Chromium-based browsers. Firefox gives every
> `file://` page its own storage, so storefront and admin won't share demo data there. Use a
> local server in Firefox/Safari.

## What's included

### Storefront (`/`)

| Page | File |
| --- | --- |
| Home (hero, categories, new arrivals, Eid promo + countdown, trending tabs, reviews, Facebook CTA, newsletter) | `index.html` |
| Shop: category / price / size / colour / stock / sale filters, sort, grid ↔ list, pagination, wishlist view | `shop.html` |
| Product: colour + size pickers, 4 gallery views, size guide, tabs, reviews, related | `product.html` |
| Cart: quantity, coupons, order summary · slide-in mini-cart on every page | `cart.html` |
| Checkout: BD phone validation, 64 districts, inside/outside Dhaka delivery, COD / bKash / Nagad / card | `checkout.html` |
| Order received · Track order (timeline) | `thank-you.html`, `track-order.html` |
| About · Contact (Messenger, phone, email) | `about.html`, `contact.html` |

### Admin (`/admin`) — WordPress-style

| Screen | File |
| --- | --- |
| Dashboard: KPI tiles, sales chart, sparkline stats, recent orders, top products, at-a-glance, stock alerts, quick draft | `index.html` |
| Products: list table with views, bulk actions, filters, sort, **Screen Options**, quick edit, duplicate | `products.html` |
| Product editor: rich-text box, Product-data tabs, Publish box, categories, tags, image + gallery upload, live storefront preview | `product-edit.html` |
| Categories · Orders · Order detail (status, notes, print invoice) · Customers · Coupons | `categories.html`, `orders.html`, `order-view.html`, `customers.html`, `coupons.html` |
| Media library · Pages & Posts · Users · Plugins | `media.html`, `pages.html`, `users.html`, `plugins.html` |
| Appearance → **Customize** with live iframe preview (accent colour, blur, opacity, radius, hero text) | `appearance.html` |
| Analytics (revenue, orders/day, category, status, payment, district, funnel, CSV export) · Settings · Login | `analytics.html`, `settings.html`, `login.html` |

Extras: command palette (`Ctrl/⌘ + K`), collapsible sidebar, light/dark mode, responsive down to
phones, keyboard-accessible charts with a "view as table" fallback.

## How the demo works

Products, orders, coupons, settings and uploads are saved in the browser's `localStorage`
(`amnu.*` keys), so every screen is functional without a server:

* Place an order on the storefront → it appears in **Admin → Orders** and on the dashboard.
* Publish a product in the admin → it shows up in the shop immediately.
* Change **Settings → Shipping** → checkout totals change.
* **Settings → Advanced** exports the data as JSON or resets everything to the sample content.

Sample orders are generated on load (deterministic, relative to today) so the dashboard always
has recent data. Traffic / sessions / funnel stages are **simulated**; purchases and revenue
come from the orders.

## Design system

`assets/css/glass.css` holds the tokens and primitives; `store.css` and `admin.css` build on it.

```css
:root {
  --accent: #e24b25;        /* storefront coral   (Appearance → Customize edits this) */
  --primary: #6250d6;       /* admin violet */
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
* Fonts: Poppins and Hind Siliguri (Bangla) from Google Fonts; system fonts are the fallback.

## Project structure

```
index.html shop.html product.html cart.html checkout.html …   storefront pages
admin/*.html                                                  admin pages
assets/css/  glass.css  store.css  admin.css
assets/js/   core.js         icons, storage, formatting, Panjabi SVG, modal/toast, theme
             data.js         sample data + the Amnu.store API  ← swap for your backend
             store.js        storefront: header/footer/cart/search + page renderers
             charts.js       dependency-free SVG charts
             admin-core.js   admin shell, command palette, WP-style list table
             admin-pages.js  dashboard · products · editor · categories · orders · customers
             admin-pages2.js coupons · media · pages · customize · analytics · users · plugins · settings
```

Header, footer and the admin shell are injected from JavaScript so they are written once. Page
bodies are plain HTML.

## Making it real

1. **Content.** Replace the arrays in `assets/js/data.js` (categories, products, copy), the contact
   details in *Admin → Settings → General*, and the placeholder about-us text in `about.html`.
   Facebook content wasn't available when this was built, so no real photos, prices or
   descriptions were imported.
2. **Backend.** `Amnu.store` (in `data.js`) is the only data layer: every screen calls it. Replace
   its methods with `fetch()` calls to your API, or to the WordPress / WooCommerce REST API.
3. **Authentication.** `admin/login.html` is a demo and does **not** authenticate anyone. Anything in
   `/admin` is publicly reachable until you protect it server-side.
4. **Payments & couriers.** bKash / Nagad show the manual "send money + enter TrxID" flow; card
   payment, courier APIs and SMS are placeholders (see *Plugins*). Integrate real gateways
   server-side. Never trust totals computed in the browser.
5. **As a WordPress theme.** This is an HTML template, not a theme. A typical mapping:
   `index.html → front-page.php`, `shop.html → archive-product.php`,
   `product.html → single-product.php`, `cart.html` / `checkout.html → WooCommerce templates`,
   `assets/` → theme assets. The admin screens are a visual design you can build as a custom
   admin or use as a reference to restyle `wp-admin`.

## Browser support

Current Chrome, Edge, Firefox and Safari. Uses CSS `backdrop-filter`, `color-mix()` and
optional chaining. `prefers-reduced-motion` is respected.
