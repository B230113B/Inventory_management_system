from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import os
from datetime import datetime

from .database import engine, get_db, Base
from .models import Product, Order, OrderItem, Payment
from .schemas import (
    ProductResponse, ProductCreate,
    OrderCreate, OrderResponse,
    PaymentResponse
)

app = FastAPI(title="Inventory Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/products", response_model=List[ProductResponse])
async def get_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product))
    products = result.scalars().all()
    return products


@app.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, db: AsyncSession = Depends(get_db)):
    # Check if product with same SKU exists
    existing = await db.execute(select(Product).where(Product.sku == product.sku))
    existing_product = existing.scalar_one_or_none()

    if existing_product:
        # Upsert: increment stock instead of error
        existing_product.stock_qty += product.stock_qty
        # Update name if provided
        if product.name:
            existing_product.name = product.name
        await db.commit()
        await db.refresh(existing_product)
        return existing_product

    # Create new product
    db_product = Product(**product.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, product_data: ProductCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalar_one_or_none()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update all fields
    db_product.name = product_data.name
    db_product.sku = product_data.sku
    db_product.stock_qty = product_data.stock_qty

    await db.commit()
    await db.refresh(db_product)
    return db_product


@app.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalar_one_or_none()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(db_product)
    await db.commit()

    return {"message": "Product deleted successfully", "id": product_id}


@app.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, db: AsyncSession = Depends(get_db)):
    order = Order(status="Pending Payment", order_number=generate_order_number())
    db.add(order)
    await db.flush()

    for item in order_data.items:
        result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = result.scalar_one_or_none()

        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        if product.stock_qty < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}. Available: {product.stock_qty}"
            )

        order_item = OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity)
        db.add(order_item)

        product.stock_qty -= item.quantity

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


@app.get("/orders", response_model=List[OrderResponse])
async def get_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    orders = result.scalars().all()
    return orders


@app.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.payments)
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return order


@app.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "Pending Payment":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order.status}'. Only 'Pending Payment' orders can be cancelled."
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
async def upload_payment(order_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

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


@app.post("/payments/{order_id}/approve")
async def approve_payment(order_id: int, db: AsyncSession = Depends(get_db)):
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


@app.post("/payments/{order_id}/reject")
async def reject_payment(order_id: int, db: AsyncSession = Depends(get_db)):
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
