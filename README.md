# Inventory Management System

A robust, full-stack enterprise inventory and order management portal designed for seamless stock tracking, order processing, and role-based access control.

## Key Features

* **Role-Based Access Control (RBAC):** * **Admin:** Full access to product catalog management, global order reviewing, and system-wide analytics.
  * **Staff:** Restricted portal for placing orders, uploading payment receipts, and viewing personal transaction history.
* **Real-Time Dashboard Analytics:** Dynamic statistics calculating lifetime order volumes, pending payments, and real-time available stock filtered by user roles.
* **Concurrency & Overselling Protection:** Backend pessimistic validation combined with frontend graceful error handling ensures stock integrity when multiple staff members place orders simultaneously.
* **Advanced Media Handling:** Integrated local static file serving for uploading and previewing high-resolution product images and payment receipts via lightboxes.
* **Optimized UX/UI:** Responsive design with pagination, dynamic search filtering, and global toast notifications for seamless operational flow.

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** FastAPI, Python
* **Database:** PostgreSQL / SQLAlchemy
* **Authentication:** JWT (JSON Web Tokens) with secure local storage

## How to Run Locally

### 1. Backend Setup (FastAPI)
Navigate to the backend directory, install dependencies, and run the server:
```bash
# Start the Uvicorn server (runs on port 8000)
python3 -m uvicorn app.main:app --reload --port 8000

2. Frontend Setup (React/Vite)
Navigate to the frontend directory, install dependencies, and start the development server:
npm install
npm run dev