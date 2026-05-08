"""
Database seed script - Run this once to populate the database with initial data.
Passwords: admin123 for admin, staff123 for staff accounts
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from app.database import Base
from app.models import User, Product

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/inventory_db"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_database():
    engine = create_async_engine(DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        # Drop all tables and recreate (fresh start)
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully")

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Create users
        admin_user = User(
            username="admin",
            email="admin@inventory.local",
            hashed_password=pwd_context.hash("admin123"),
            role="admin",
            is_active=True
        )
        staff_user_1 = User(
            username="john.staff",
            email="john@inventory.local",
            hashed_password=pwd_context.hash("staff123"),
            role="staff",
            is_active=True
        )
        staff_user_2 = User(
            username="jane.staff",
            email="jane@inventory.local",
            hashed_password=pwd_context.hash("staff123"),
            role="staff",
            is_active=True
        )

        session.add(admin_user)
        session.add(staff_user_1)
        session.add(staff_user_2)

        # Create sample products
        products = [
            Product(
                name="Premium Widget A",
                sku="SKU-WIDGET-001",
                stock_qty=100,
                description="High-quality widget for industrial use. Built with premium materials for durability and performance.",
                image_url="https://picsum.photos/seed/widget1/200"
            ),
            Product(
                name="Standard Widget B",
                sku="SKU-WIDGET-002",
                stock_qty=75,
                description="Reliable standard widget for everyday tasks. Perfect for general-purpose applications.",
                image_url="https://picsum.photos/seed/widget2/200"
            ),
            Product(
                name="Deluxe Gadget X",
                sku="SKU-GADGET-001",
                stock_qty=50,
                description="Premium gadget with advanced features. Includes digital display and multiple modes.",
                image_url="https://picsum.photos/seed/gadget1/200"
            ),
            Product(
                name="Basic Tool Set",
                sku="SKU-TOOL-001",
                stock_qty=200,
                description="Essential tool set for maintenance. Includes all basic tools needed for everyday repairs.",
                image_url="https://picsum.photos/seed/tool1/200"
            ),
            Product(
                name="Sensor Module C",
                sku="SKU-SENSOR-001",
                stock_qty=30,
                description="High-precision sensor for monitoring. Ideal for environmental and industrial sensing applications.",
                image_url="https://picsum.photos/seed/sensor1/200"
            ),
            Product(
                name="Power Supply Unit",
                sku="SKU-POWER-001",
                stock_qty=45,
                description="Universal power supply unit. Supports multiple voltage outputs for various devices.",
                image_url="https://picsum.photos/seed/power1/200"
            ),
            Product(
                name="LED Display Panel",
                sku="SKU-LED-001",
                stock_qty=60,
                description="Full-color LED display panel. Perfect for signage and information displays.",
                image_url="https://picsum.photos/seed/led1/200"
            ),
            Product(
                name="Thermal Printer",
                sku="SKU-PRINT-001",
                stock_qty=25,
                description="High-speed thermal printer. Prints receipts, labels, and tickets at 300mm/s.",
                image_url="https://picsum.photos/seed/print1/200"
            ),
            Product(
                name="USB Hub 7-Port",
                sku="SKU-USB-001",
                stock_qty=80,
                description="7-port USB hub with individual power switches. Supports USB 3.0 for high-speed data transfer.",
                image_url="https://picsum.photos/seed/usb1/200"
            ),
            Product(
                name="Wireless Mouse",
                sku="SKU-MOUSE-001",
                stock_qty=120,
                description="Ergonomic wireless mouse with adjustable DPI. Long battery life with auto-sleep mode.",
                image_url="https://picsum.photos/seed/mouse1/200"
            ),
            Product(
                name="Mechanical Keyboard",
                sku="SKU-KEYB-001",
                stock_qty=40,
                description="RGB mechanical keyboard with blue switches. Programmable keys and customizable lighting.",
                image_url="https://picsum.photos/seed/keyb1/200"
            ),
            Product(
                name="Webcam HD 1080p",
                sku="SKU-CAM-001",
                stock_qty=55,
                description="Full HD webcam with built-in microphone. Auto-focus and noise cancellation.",
                image_url="https://picsum.photos/seed/cam1/200"
            ),
        ]

        for product in products:
            session.add(product)

        await session.commit()
        print("Seed data inserted successfully")
        print("\nTest Credentials:")
        print("  Admin: admin / admin123")
        print("  Staff: john.staff / staff123")
        print("  Staff: jane.staff / staff123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_database())
