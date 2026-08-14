from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import RegisterRequest
from schemas import LoginRequest
from schemas import TokenResponse

from security import hash_password
from security import verify_password
from security import create_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == request.email
    ).first()

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )


    existing_username = db.query(User).filter(
        User.username == request.username
    ).first()

    if existing_username:

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )


    user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(
            request.password
        ),
        role="user"
    )


    db.add(user)

    db.commit()

    db.refresh(user)


    return {
        "message": "User registered successfully",
        "user_id": user.id
    }


@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.email == request.email
    ).first()


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    if not verify_password(
        request.password,
        user.hashed_password
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    })


    return {
        "access_token": token,
        "token_type": "bearer"
    }