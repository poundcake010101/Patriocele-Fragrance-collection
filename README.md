# Patriocele Fragrance Collection

A full-stack e-commerce web application for a luxury fragrance brand, built with vanilla HTML/CSS/JavaScript and Supabase as the backend.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Supabase Setup](#supabase-setup)
- [Database Schema](#database-schema)
- [Pages & Scripts](#pages--scripts)
- [Admin Dashboard](#admin-dashboard)
- [Screenshots](#screenshots)
- [Known Issues & TODOs](#known-issues--todos)
- [License](#license)

---

## Overview

Patriocele Fragrance Collection is a luxury e-commerce platform that allows customers to browse, filter, and purchase premium fragrances. It includes a full customer-facing storefront, a shopping cart, order management, a user profile system, and a feature-rich admin dashboard with real-time analytics and Excel reporting.

---

## Features

### Customer-Facing
- Browse featured and full fragrance catalogues
- Product detail modal with image gallery, size variants, fragrance notes, and occasion tags
- Add to cart with size selection and quantity management
- Checkout with PayFast payment integration
- Order tracking and history
- User profile management (personal info, saved addresses, security, notification preferences)

### Admin Dashboard
- Real-time KPI cards (revenue, orders, users, products)
- Product management — add, edit, activate/deactivate products
- Order management — status updates and date/status filtering
- User management — view users and toggle admin roles
- Sales analytics:
  - 30-day sales trend chart
  - Order status distribution (doughnut chart)
  - Top 5 products by units sold
  - 7-day revenue forecast (linear regression)
  - Prescriptive insights (restock alerts, cancellation rate, best-seller promo advice)
- One-click Excel report export (Orders, Products, Users, Analytics Summary)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + Auth) |
| Charts | [Chart.js 4](https://www.chartjs.org/) |
| Excel Export | [SheetJS (xlsx)](https://sheetjs.com/) |
| Payment | [PayFast](https://www.payfast.co.za/) |
| Fonts | Google Fonts — Cormorant Garamond, Jost |

---

## Project Structure

```
patriocele/
├── index.html              # Home page with featured products
├── products.html           # Full product catalogue with filters
├── cart.html               # Shopping cart
├── checkout.html           # Checkout with PayFast
├── order-confirmed.html    # Post-payment confirmation
├── orders.html             # Customer order history
├── profile.html            # User profile & settings
├── login.html              # Login page
├── signup.html             # Registration page
├── admin.html              # Admin dashboard
│
├── css/
│   └── styles.css          # Global design system (all pages)
│
└── js/
    ├── config.js           # Supabase URL & anon key
    ├── auth.js             # Auth state, cart count, nav rendering
    ├── home.js             # Featured products + shared ProductDetailModal
    ├── products.js         # Product catalogue, filters, detail modal
    ├── cart.js             # Cart CRUD and totals
    ├── checkout.js         # Shipping form + PayFast redirect
    ├── orders.js           # Customer orders list
    ├── profile.js          # Profile tabs, address modal
    └── admin.js            # Admin dashboard, analytics, Excel export
```

---

## Getting Started

### Prerequisites
- A [Supabase](https://supabase.com) project (free tier works)
- A static file server or just open files locally in a browser (some features require a server due to CORS)

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/patriocele-fragrance.git
   cd patriocele-fragrance
   ```

2. **Configure Supabase**

   Open `js/config.js` and replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'https://your-project-id.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';

   window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

3. **Serve the project**

   Using VS Code Live Server, or any local server:
   ```bash
   npx serve .
   ```
   Then open `http://localhost:3000` in your browser.

---

## Supabase Setup

### Authentication

Enable **Email/Password** authentication in your Supabase project under **Authentication → Providers**.

### Row Level Security (RLS)

Enable RLS on all tables. At minimum you need the following policies:

| Table | Policy |
|---|---|
| `users` | Users can read/update their own row; admins can read all |
| `products` | Public read for active products; admin write |
| `cart_items` | Users can CRUD their own cart items |
| `orders` | Users can read their own orders; admin can read/update all |
| `order_items` | Users can read their own order items |

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | References `auth.users` |
| `email` | text | |
| `full_name` | text | |
| `is_admin` | boolean | Default `false` |
| `created_at` | timestamptz | |

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 | Primary key |
| `name` | text | |
| `description` | text | |
| `price` | numeric | Base price |
| `size_variants` | jsonb | e.g. `{"30ml": 299, "50ml": 499, "100ml": 799}` |
| `stock_quantity` | int4 | |
| `images` | text[] | Array of image URLs |
| `fragrance_notes` | jsonb | e.g. `{"top": ["Bergamot"], "middle": ["Rose"], "base": ["Oud"]}` |
| `occasion` | text[] | e.g. `["evening", "formal"]` |
| `intensity` | text | EDT / EDP / Parfum |
| `brand_id` | int8 | FK → brands |
| `category_id` | int8 | FK → categories |
| `is_active` | boolean | Default `true` |
| `created_at` | timestamptz | |

### `brands`
| Column | Type |
|---|---|
| `id` | int8 |
| `name` | text |

### `categories`
| Column | Type |
|---|---|
| `id` | int8 |
| `name` | text |

### `cart_items`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 | Primary key |
| `user_id` | uuid | FK → users |
| `product_id` | int8 | FK → products |
| `quantity` | int4 | |
| `size_variant` | text | e.g. `"50ml"` |

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 | Primary key |
| `user_id` | uuid | FK → users |
| `total_amount` | numeric | |
| `status` | text | pending / confirmed / shipped / delivered / cancelled |
| `payment_status` | text | pending / paid / failed |
| `created_at` | timestamptz | |

### `order_items`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 | Primary key |
| `order_id` | int8 | FK → orders |
| `product_id` | int8 | FK → products |
| `quantity` | int4 | |
| `size_variant` | text | |
| `created_at` | timestamptz | |

---

## Pages & Scripts

### `home.js`
Loads up to 8 active products for the featured section on the home page. Also defines `window.ProductDetailModal` — a shared modal object used by both `home.js` and `products.js` to show the product detail view (image gallery, size picker, add to cart).

### `products.js`
Handles the full catalogue page — loads categories, brands, and products from Supabase, renders filterable product cards, and hooks into `ProductDetailModal` for detail views. Supports URL parameter `?product=ID` to open a specific product's modal on load.

### `admin.js`
The admin dashboard is tab-based (Dashboard, Products, Orders, Users, Analytics). Analytics loads Chart.js and SheetJS dynamically from CDN only when the Analytics tab is opened. The sales forecast uses a simple linear regression over the last 14 days of paid orders.

---

## Admin Dashboard

To access the admin dashboard:

1. Sign up for an account via `/signup.html`
2. In Supabase, go to your `users` table and manually set `is_admin = true` for that user's row
3. Log in — the **Admin Panel** link will appear in the navbar
4. Navigate to `/admin.html`

---

## Known Issues & TODOs

- [ ] PayFast webhook handler not yet implemented — order status must be updated manually after payment
- [ ] Product detail page (`product-detail.html`) does not exist as a standalone page; details are shown via modal only
- [ ] No email notifications for order status updates
- [ ] Mobile navbar not yet collapsed into a hamburger menu
- [ ] No image upload support — product images must be hosted externally and added via URL

---

## License

This project is for educational and portfolio purposes.  
© 2025 Siyabonga Mnguni — All rights reserved.
