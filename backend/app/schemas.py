from pydantic import BaseModel
from typing import Optional, List, Generic, TypeVar
from datetime import datetime


T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# User schemas
class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str
    role: Optional[str] = "staff"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    username: Optional[str] = None


# Product schemas
class ProductBase(BaseModel):
    name: str
    sku: str
    stock_qty: int = 0
    description: Optional[str] = ""
    image_url: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductListResponse(PaginatedResponse[ProductResponse]):
    pass


# Order schemas
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
    items: List[OrderItemCreate]


class OrderResponse(BaseModel):
    id: int
    order_number: str
    status: str
    user_id: Optional[int] = None
    created_at: datetime
    items: List[OrderItemResponse] = []
    payments: List[PaymentResponse] = []

    class Config:
        from_attributes = True


class OrderListResponse(PaginatedResponse[OrderResponse]):
    pass


class StatsResponse(BaseModel):
    total_products: int
    available_products: int
    total_orders: int
    pending_orders: int
    approved_orders: int
    rejected_orders: int
    cancelled_orders: int
    total_revenue: float = 0
