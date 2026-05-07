# System Requirement
## Lightweight Order & Inventory Management System

---

## 1. Overview

This system is a lightweight web-based portal designed for sales representatives and counter staff to:

- View product stock levels
- Create customer orders
- Upload payment receipts

The system will be developed within 3–4 days using AI-assisted tools.

---

## 2. Objectives

- Provide real-time stock visibility
- Enable quick and simple order placement
- Allow users to upload payment proof
- Ensure data consistency and prevent stock errors

---

## 3. Target Users

- Sales Representatives
- Counter Staff

---

## 4. System Features

### 4.1 Stock Balance

- Display list of products
- Show current stock quantity
- (Optional) Search products

---

### 4.2 Order Placement

- Add products to cart
- Input quantity
- Validate stock availability
- Create order with unique Order ID
- Default order status: `Pending Payment`

---

### 4.3 Payment Upload

- Upload payment receipt (image)
- Link receipt to an order
- Update order status to: `Payment Under Review`

---

## 5. Tech Stack

- Frontend: Vite + TypeScript + React / Vue
- Backend: Python (FastAPI, async)
- Database: PostgreSQL
- Development: AI-assisted tools (e.g., ChatGPT, Claude)

---

## 6. Database Requirements

### Tables:

- **products**
  - id
  - name
  - sku
  - stock_qty

- **orders**
  - id
  - status
  - created_at

- **order_items**
  - id
  - order_id
  - product_id
  - quantity

- **payments**
  - id
  - order_id
  - file_url
  - uploaded_at

---

## 7. API Endpoints (Basic)

- `GET /products` → Get stock list
- `POST /orders` → Create order
- `GET /orders/{id}` → Get order details
- `POST /upload` → Upload payment receipt

---

## 8. Business Rules

- Cannot place order if stock is insufficient
- Each order must have a unique ID
- Payment upload is only allowed for existing orders
- Stock should be updated consistently (avoid overselling)

---

## 9. Non-Functional Requirements

- Response time < 2 seconds
- Simple and user-friendly UI
- Basic validation for inputs and file uploads
- Support concurrent requests (async backend)

---

## 10. Limitations

- No online payment integration
- No advanced reporting
- Minimal user authentication (if any)

---

## 11. Development Notes

- AI tools must be used during development
- Document how AI assists in:
  - Code generation
  - Debugging
  - Design decisions