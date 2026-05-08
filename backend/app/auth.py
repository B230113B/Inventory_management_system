from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_db
from .models import User

SECRET_KEY = "your-secret-key-change-in-production-09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    print(f"[get_current_user] Token received: {token[:50] if token else 'None'}...")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"[get_current_user] Decoded payload: {payload}")
        username: str = payload.get("sub")
        if username is None:
            print(f"[get_current_user] No 'sub' in payload")
            raise credentials_exception
    except JWTError as e:
        print(f"[get_current_user] JWTError: {e}")
        raise credentials_exception

    print(f"[get_current_user] Looking up user: {username}")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    print(f"[get_current_user] User found: {user}")

    if user is None:
        print(f"[get_current_user] User not found")
        raise credentials_exception
    if not user.is_active:
        print(f"[get_current_user] User inactive")
        raise HTTPException(status_code=400, detail="Inactive user")
    print(f"[get_current_user] Returning user: {user.username}, role: {user.role}")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    print(f"[require_admin] Checking admin for user: {current_user.username}, role: {current_user.role}")
    if current_user.role != "admin":
        print(f"[require_admin] Access denied - not admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    print(f"[require_admin] Access granted")
    return current_user
