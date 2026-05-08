from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import os
from datetime import datetime

from .database import engine, get_db, Base
from .models import Product, Order, OrderItem, Payment, User
from .schemas import (
    ProductResponse, ProductCreate, ProductListResponse,
    OrderCreate, OrderResponse, OrderListResponse,
    PaymentResponse, Token, UserResponse, UserCreate, StatsResponse, UserLogin
)
from .auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin
)

app = FastAPI(title="Inventory Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def generate_order_number() -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"ORD-{date_str}-{unique_id}"


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/")
async def root():
    return {"message": "Inventory Management System API"}


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    print(f"[login] Attempting login for user: {user_data.username}", flush=True)
    try:
        result = await db.execute(select(User).where(User.username == user_data.username))
        user = result.scalar_one_or_none()
        print(f"[login] User from DB: {user}", flush=True)
    except Exception as e:
        print(f"Database query error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Database error")

    if not user:
        print(f"[login] User not found", flush=True)
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    try:
        if not verify_password(user_data.password, user.hashed_password):
            print(f"[login] Password verification failed", flush=True)
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        print(f"[login] Password verified", flush=True)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password verification error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Authentication error")

    if not user.is_active:
        print(f"[login] User inactive", flush=True)
        raise HTTPException(status_code=400, detail="Inactive user")

    try:
        token_data = {"sub": user.username, "user_id": user.id, "role": user.role}
        print(f"[login] Creating token with data: {token_data}", flush=True)
        access_token = create_access_token(data=token_data)
        print(f"[login] Token created: {access_token[:50]}...", flush=True)
    except Exception as e:
        print(f"Token creation error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Token creation failed")

    try:
        user_response = UserResponse.model_validate(user)
        print(f"[login] User response created: {user_response}", flush=True)
    except Exception as e:
        print(f"Response serialization error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Response serialization failed")

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


# Public registration endpoint - no auth required
@app.post("/api/auth/register", response_model=UserResponse)
async def public_register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered")

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    # Always assign 'staff' role for public registrations
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role="staff"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


# Admin-only registration endpoint
@app.post("/api/admin/users", response_model=UserResponse)
async def admin_register(user_data: UserCreate, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered")

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    role = user_data.role if user_data.role in ["admin", "staff"] else "staff"

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/api/auth/password")
async def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify current password matches
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    # Validate confirm matches new
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")

    # Hash and update password
    current_user.hashed_password = get_password_hash(new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


# ============================================
# PRODUCT ENDPOINTS (Paginated)
# ============================================

@app.get("/api/products", response_model=ProductListResponse)
async def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Product)
    count_query = select(func.count(Product.id))

    if search:
        search_filter = or_(
            Product.name.ilike(f"%{search}%"),
            Product.sku.ilike(f"%{search}%"),
            Product.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    query = query.order_by(Product.id.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    products = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    total_pages = (total + limit - 1) // limit if total > 0 else 1
    page = (skip // limit) + 1

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@app.post("/api/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Product).where(Product.sku == product.sku))
    existing_product = existing.scalar_one_or_none()

    if existing_product:
        existing_product.stock_qty += product.stock_qty
        if product.name:
            existing_product.name = product.name
        if product.description:
            existing_product.description = product.description
        if product.image_url:
            existing_product.image_url = product.image_url
        await db.commit()
        await db.refresh(existing_product)
        return ProductResponse.model_validate(existing_product)

    db_product = Product(**product.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return ProductResponse.model_validate(db_product)


@app.get("/api/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/api/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, product_data: ProductCreate, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    print(f"[update_product] User: {current_user.username}, db type: {type(db)}", flush=True)
    print(f"[update_product] Received product_id={product_id}", flush=True)
    print(f"[update_product] product_data={product_data}", flush=True)

    try:
        result = await db.execute(select(Product).where(Product.id == product_id))
        db_product = result.scalar_one_or_none()
        print(f"[update_product] db_product found: {db_product}", flush=True)

        if not db_product:
            print(f"[update_product] Product not found", flush=True)
            raise HTTPException(status_code=404, detail="Product not found")

        # Update fields
        db_product.name = product_data.name
        db_product.sku = product_data.sku
        db_product.stock_qty = product_data.stock_qty

        # Handle optional fields - convert empty string to None for image_url
        desc = product_data.description
        db_product.description = desc if desc is not None else ""
        img = product_data.image_url
        db_product.image_url = img if (img is not None and img != "") else None

        print(f"[update_product] After field updates, description={db_product.description}, image_url={db_product.image_url}", flush=True)

        # Commit the changes
        await db.commit()
        print(f"[update_product] Commit successful", flush=True)

        # Refresh to get any database-generated values
        await db.refresh(db_product)
        print(f"[update_product] Refresh successful, id={db_product.id}", flush=True)

        # Create response using model_validate
        response_data = {
            "id": db_product.id,
            "name": db_product.name,
            "sku": db_product.sku,
            "stock_qty": db_product.stock_qty,
            "description": db_product.description,
            "image_url": db_product.image_url,
            "created_at": db_product.created_at
        }
        print(f"[update_product] Response data: {response_data}", flush=True)

        response = ProductResponse.model_validate(response_data)
        print(f"[update_product] ProductResponse validated successfully", flush=True)
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"[update_product] EXCEPTION: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Update failed: {type(e).__name__}: {str(e)}")


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalar_one_or_none()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if product has linked order items
    order_items_result = await db.execute(
        select(OrderItem).where(OrderItem.product_id == product_id).limit(1)
    )
    if order_items_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Cannot delete product because it is linked to existing orders")

    await db.delete(db_product)
    await db.commit()

    return {"message": "Product deleted successfully", "id": product_id}


# ============================================
# PRODUCT ENDPOINTS WITH IMAGE UPLOAD (Multipart)
# ============================================

@app.post("/api/products/with-image", response_model=ProductResponse)
async def create_product_with_image(
    name: str = Form(...),
    sku: str = Form(...),
    stock_qty: int = Form(...),
    description: str = Form(""),
    image: UploadFile = File(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Check for existing SKU
    existing = await db.execute(select(Product).where(Product.sku == sku))
    existing_product = existing.scalar_one_or_none()

    if existing_product:
        existing_product.stock_qty += stock_qty
        if name:
            existing_product.name = name
        if description:
            existing_product.description = description
        if image:
            # Save new image
            file_ext = os.path.splitext(image.filename)[1] if image.filename else '.png'
            filename = f"{uuid.uuid4()}{file_ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                content = await image.read()
                f.write(content)
            existing_product.image_url = f"/uploads/{filename}"
        await db.commit()
        await db.refresh(existing_product)
        return ProductResponse.model_validate(existing_product)

    image_url = None
    if image:
        file_ext = os.path.splitext(image.filename)[1] if image.filename else '.png'
        filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            content = await image.read()
            f.write(content)
        image_url = f"/uploads/{filename}"

    db_product = Product(
        name=name,
        sku=sku,
        stock_qty=stock_qty,
        description=description,
        image_url=image_url
    )
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return ProductResponse.model_validate(db_product)


@app.put("/api/products/{product_id}/with-image", response_model=ProductResponse)
async def update_product_with_image(
    product_id: int,
    name: str = Form(...),
    sku: str = Form(...),
    stock_qty: int = Form(...),
    description: str = Form(""),
    image: UploadFile = File(None),
    keep_existing_image: bool = Form(False),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalar_one_or_none()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update fields
    db_product.name = name
    db_product.sku = sku
    db_product.stock_qty = stock_qty
    db_product.description = description if description else ""

    # Handle image
    if image:
        # Save new image
        file_ext = os.path.splitext(image.filename)[1] if image.filename else '.png'
        filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            content = await image.read()
            f.write(content)
        db_product.image_url = f"/uploads/{filename}"
    elif keep_existing_image:
        # Keep existing image (do nothing)
        pass
    else:
        # Remove image
        db_product.image_url = None

    await db.commit()
    await db.refresh(db_product)
    return ProductResponse.model_validate(db_product)


# ============================================
# ORDER ENDPOINTS (User-scoped)
# ============================================

@app.post("/api/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = Order(
        status="Pending Payment",
        order_number=generate_order_number(),
        user_id=current_user.id
    )
    db.add(order)
    await db.flush()

    try:
        for item in order_data.items:
            # Lock the product row to prevent race conditions
            result = await db.execute(
                select(Product).where(Product.id == item.product_id).with_for_update()
            )
            product = result.scalar_one_or_none()

            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            if product.stock_qty < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail="Insufficient stock. The inventory might have been updated by another user."
                )

            order_item = OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity)
            db.add(order_item)
            product.stock_qty -= item.quantity

        await db.commit()
    except HTTPException:
        # Rollback any pending changes and re-raise
        await db.rollback()
        raise
    except Exception:
        # Rollback on any unexpected error
        await db.rollback()
        raise HTTPException(status_code=500, detail="Order creation failed. Please try again.")

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one()
    return order


@app.get("/api/orders", response_model=OrderListResponse)
async def get_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Staff can only see their own orders, admins see all
    query = select(Order)
    count_query = select(func.count(Order.id))

    if current_user.role != "admin":
        query = query.where(Order.user_id == current_user.id)
        count_query = count_query.where(Order.user_id == current_user.id)

    if status_filter:
        query = query.where(Order.status == status_filter)
        count_query = count_query.where(Order.status == status_filter)

    if search:
        search_filter = or_(
            Order.order_number.ilike(f"%{search}%"),
            Order.status.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(
        query.options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    orders = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    total_pages = (total + limit - 1) // limit if total > 0 else 1
    page = (skip // limit) + 1

    return OrderListResponse(
        items=[OrderResponse.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@app.get("/api/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Staff can only view their own orders
    if current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return order


@app.post("/api/orders/{order_id}/cancel")
async def cancel_order(order_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Staff can only cancel their own orders
    if current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status != "Pending Payment":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order.status}'"
        )

    for item in order.items:
        result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = result.scalar_one_or_none()
        if product:
            product.stock_qty += item.quantity

    order.status = "Cancelled"
    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one()
    return order


@app.post("/upload/{order_id}", response_model=PaymentResponse)
async def upload_payment(order_id: int, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Staff can only upload to their own orders
    if current_user.role != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status != "Pending Payment":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot upload payment for order with status '{order.status}'"
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_types = {'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf'}
    content_type = file.content_type

    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: PNG, JPEG, JPG, GIF, PDF"
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1] if file.filename else '.png'
    filename = f"{uuid.uuid4()}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    payment = Payment(order_id=order_id, file_url=f"/uploads/{filename}")
    db.add(payment)
    order.status = "Payment Under Review"
    await db.commit()
    await db.refresh(payment)
    return payment


if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/uploads/{filename}")
async def get_upload(filename: str):
    return {"filename": filename}


# ============================================
# ADMIN ENDPOINTS
# ============================================

@app.post("/api/admin/orders/{order_id}/approve", response_model=OrderResponse)
async def approve_payment(order_id: int, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "Payment Under Review":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve payment for order with status '{order.status}'"
        )

    order.status = "Payment Approved"
    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one()
    return order


@app.post("/api/admin/orders/{order_id}/reject", response_model=OrderResponse)
async def reject_payment(order_id: int, current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "Payment Under Review":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject payment for order with status '{order.status}'"
        )

    order.status = "Payment Rejected"
    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one()
    return order


@app.get("/api/admin/stats", response_model=StatsResponse)
async def get_admin_stats(current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    print(f"[get_admin_stats] User: {current_user.username}", flush=True)
    # Total products (all)
    result = await db.execute(select(func.count(Product.id)))
    total_products = result.scalar()

    # Available products (stock > 0)
    result = await db.execute(select(func.count(Product.id)).where(Product.stock_qty > 0))
    available_products = result.scalar()

    # Total orders
    result = await db.execute(select(func.count(Order.id)))
    total_orders = result.scalar()

    # Pending orders
    result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "Pending Payment")
    )
    pending_orders = result.scalar()

    # Approved orders
    result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "Payment Approved")
    )
    approved_orders = result.scalar()

    # Rejected orders
    result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "Payment Rejected")
    )
    rejected_orders = result.scalar()

    # Cancelled orders
    result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "Cancelled")
    )
    cancelled_orders = result.scalar()

    return StatsResponse(
        total_products=total_products,
        available_products=available_products,
        total_orders=total_orders,
        pending_orders=pending_orders,
        approved_orders=approved_orders,
        rejected_orders=rejected_orders,
        cancelled_orders=cancelled_orders
    )


@app.get("/api/stats/me", response_model=StatsResponse)
async def get_my_stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Available products (stock > 0) - all users see same products
    result = await db.execute(select(func.count(Product.id)).where(Product.stock_qty > 0))
    available_products = result.scalar()

    # My Orders - total count of ALL orders by this user
    result = await db.execute(
        select(func.count(Order.id)).where(Order.user_id == current_user.id)
    )
    total_orders = result.scalar()

    # Pending Payment - orders with status 'Pending Payment' by this user
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.user_id == current_user.id,
            Order.status == "Pending Payment"
        )
    )
    pending_orders = result.scalar()

    # Approved Orders - orders with status 'Payment Approved' by this user
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.user_id == current_user.id,
            Order.status == "Payment Approved"
        )
    )
    approved_orders = result.scalar()

    # Rejected Orders - orders with status 'Payment Rejected' by this user
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.user_id == current_user.id,
            Order.status == "Payment Rejected"
        )
    )
    rejected_orders = result.scalar()

    # Cancelled Orders - orders with status 'Cancelled' by this user
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.user_id == current_user.id,
            Order.status == "Cancelled"
        )
    )
    cancelled_orders = result.scalar()

    return StatsResponse(
        total_products=0,
        available_products=available_products,
        total_orders=total_orders,
        pending_orders=pending_orders,
        approved_orders=approved_orders,
        rejected_orders=rejected_orders,
        cancelled_orders=cancelled_orders
    )


@app.get("/api/admin/users", response_model=List[UserResponse])
async def get_all_users(current_user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]
