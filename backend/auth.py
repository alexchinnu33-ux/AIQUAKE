import os

from dotenv import load_dotenv

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from pydantic import BaseModel, EmailStr

from sqlalchemy.orm import Session

from database import get_db
from models import User

from security import (
    hash_password,
    verify_password,
    create_access_token
)


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY is not set in .env"
    )


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class LoginRequest(BaseModel):

    email: EmailStr

    password: str


class RegisterRequest(BaseModel):

    username: str

    email: EmailStr

    password: str


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ============================================================
# LOGIN
# ============================================================

@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # FIND USER
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    # --------------------------------------------------------
    # VERIFY PASSWORD
    # --------------------------------------------------------

    password_valid = verify_password(
        request.password,
        user.hashed_password
    )


    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    # --------------------------------------------------------
    # CREATE JWT
    # --------------------------------------------------------

    token = create_access_token({

        "sub": str(user.id),

        "user_id": user.id,

        "email": user.email,

        "username": user.username,

        "role": user.role

    })


    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {

        "access_token": token,

        "token_type": "bearer",

        "user": {

            "id": user.id,

            "username": user.username,

            "email": user.email,

            "role": user.role

        }

    }


# ============================================================
# REGISTER
# ============================================================

@router.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # CHECK EMAIL
    # --------------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )


    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )


    # --------------------------------------------------------
    # CHECK USERNAME
    # --------------------------------------------------------

    existing_username = (
        db.query(User)
        .filter(
            User.username == request.username
        )
        .first()
    )


    if existing_username:

        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )


    # --------------------------------------------------------
    # CREATE USER
    # --------------------------------------------------------

    new_user = User(

        username=request.username,

        email=request.email,

        hashed_password=hash_password(
            request.password
        ),

        role="user"

    )


    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {

        "message": "Registration successful",

        "user": {

            "id": new_user.id,

            "username": new_user.username,

            "email": new_user.email

        }

    }