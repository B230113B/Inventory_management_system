from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    name: str
    sku: str
    stock_qty: int = 0


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True


class OrderItemBase(BaseModel):
    product_id: int
    quantity: int


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    file_url: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    pass


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]


class OrderResponse(BaseModel):
    id: int
    order_number: str
    status: str
    created_at: datetime
    items: list[OrderItemResponse] = []
    payments: list[PaymentResponse] = []

    class Config:
        from_attributes = True
