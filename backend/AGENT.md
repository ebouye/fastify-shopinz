# Shopiz - Agent Instruction Prompt

## Role

You are a Senior Software Engineer and Architect acting as a coding agent for the Shopiz project.

---

## Project Overview

Shopiz is an E-commerce platform built with **Fastify (Node.js)** and **ReactJS**. It serves customers (buyers) and administrators. It features product browsing, a persistent shopping cart (supporting guests), a complex checkout with address management, order tracking, and an admin dashboard for product/order management.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Fastify (Node.js) |
| Frontend | ReactJS |
| Database | PostgreSQL (Relational) |
| Auth | JWT (Access Token + Refresh Token) |

---

## Validated Requirements & Business Logic

**Strictly adhere to the following clarified logic. Do not deviate from these rules.**

### 1. Authentication & Authorization

- **Strategy:** JWT (JSON Web Tokens). Implement Access Token + Refresh Token logic.
- **Roles:** `USER` and `ADMIN`.
- **Guest Checkout:**
  - Guests can purchase without logging in.
  - **Strategy:** Use a **Hybrid Cart System**. Generate a `session_token` (UUID) for guests stored in a cookie/database.
  - **Migration:** When a guest logs in or registers, the system must merge the guest's cart (identified by `session_token`) with the logged-in user's cart (identified by `user_id`).

### 2. Product Pricing

**Terminology & Logic:**

| Field | Description |
|-------|-------------|
| `cost_price` | The price the shop pays the supplier (Internal) |
| `selling_price` | The price displayed on the website for the customer (External/Retail) |

- **Calculation:** The checkout process calculates totals using the `selling_price`.

**Slug:**
- Automatically generated from the product name (e.g., "Super Shoe" → `super-shoe`).
- Must be **Unique** (enforced in DB).
- Admin must be able to edit the slug manually.

### 3. Cart Persistence

- Carts must be stored in the **Database**, not just in browser local storage.
- Supports "Resume Cart" feature and cross-device usage.

### 4. Checkout & Order Management

**Address:**
- Users can have multiple addresses (One-to-Many relationship).
- Users select one at checkout.

**Order Status Workflow:**
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                ↓
        CANCELLED or REFUNDED
```

**Admin "Report/Issue" Logic:**

When an admin reports an issue:

| Payment Status | Action |
|----------------|--------|
| `PAID` | Trigger **Refund Workflow** → Update status to `REFUNDED` + payment reversal logic |
| `UNPAID` | Trigger **Cancellation Workflow** → Update status to `CANCELLED` |

In both cases, an **email notification** must be sent to the customer explaining the specific issue.

### 5. Reviews

- **Constraint:** A user can only submit a review if the related Order Status is `DELIVERED`.
- **Moderation:** Reviews are not public until an Administrator approves them.

### 6. Image Handling

- **Storage:** Use Local File System (`/public/uploads`).
- **Display:** Admin can upload multiple images but must select one as the "Display First" image.
- **Serving:** Use `@fastify/static` plugin.

**Folder Structure:**
```
/public
  /uploads
    /products    # Product images
```

> **Note:** Local storage is ephemeral in cloud environments; this is acceptable for the current MVP phase. Plan migration to S3 or persistent volume for production.

### 7. Admin Features

- **Order Filtering:** Admin can filter orders by: Date, Status, and Total Price.
- **User Management:** Admin can view all users and Ban/Block users.

### 8. Email Notifications

**Triggers:**
- Order confirmed (successful validation)
- Order issue reported (Cancellation or Refund)

---

## Architectural Strategies

### A. Hybrid Cart System (Guest Checkout)

| User Type | Cart Identifier | Storage |
|-----------|-----------------|---------|
| Guest | `cart_id` (UUID) | Browser cookie + Database |
| Logged-in | `user_id` | Database |

**Migration Flow:**
1. Guest adds items to cart (linked to `cart_id`)
2. Guest logs in or registers
3. System merges `cart_id` items into `user_id` cart
4. System deletes guest `cart_id` record

### B. Refund/Cancellation Logic

```
Admin selects issue (e.g., "Out of Stock")
         ↓
    Check Payment Status
         ↓
    ┌────┴────┐
    │         │
  PAID      UNPAID
    │         │
    ↓         ↓
REFUNDED  CANCELLED
(+ Stripe)  (+ Email)
(+ Email)
```

---

## Key Constraints

1. **Never** store carts only in localStorage
2. **Always** check payment status before refund/cancel actions
3. **Always** enforce unique slug constraint at DB level
4. **Only** allow reviews for `DELIVERED` orders
5. **Always** require admin approval for reviews before public display
