import os
import shutil

from dotenv import load_dotenv

from fastapi import APIRouter
from fastapi import Depends
from fastapi import UploadFile
from fastapi import File
from fastapi import HTTPException

from fastapi.security import HTTPBearer

from jose import jwt, JWTError

from sqlalchemy.orm import Session

from database import get_db
from models import User, PredictionHistory

from model import predict_image


# ---------------------------------------
# ENVIRONMENT VARIABLES
# ---------------------------------------

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)


# ---------------------------------------
# AUTHENTICATION
# ---------------------------------------

security = HTTPBearer()


def get_current_user(
    credentials=Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# ---------------------------------------
# ROUTER
# ---------------------------------------

router = APIRouter()


# ---------------------------------------
# UPLOAD FOLDER
# ---------------------------------------

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# =======================================
# PREDICT
# =======================================

@router.post("/predict")
async def predict(

    file: UploadFile = File(...),

    current_user=Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )

):

    # -----------------------------------
    # GET USER FROM JWT
    # -----------------------------------

    user_id = None

    # Try user ID from JWT
    if current_user.get("user_id"):

        try:

            user_id = int(
                current_user.get("user_id")
            )

        except ValueError:

            user_id = None


    # Try "sub" from JWT
    if user_id is None and current_user.get("sub"):

        try:

            user_id = int(
                current_user.get("sub")
            )

        except ValueError:

            user_id = None


    # -----------------------------------
    # Try email from JWT
    # -----------------------------------

    if user_id is None:

        email = current_user.get(
            "email"
        )

        if email:

            user = (
                db.query(User)
                .filter(
                    User.email == email
                )
                .first()
            )

            if user:

                user_id = user.id


    # -----------------------------------
    # USER NOT FOUND
    # -----------------------------------

    if user_id is None:

        raise HTTPException(
            status_code=401,
            detail="Unable to identify logged-in user"
        )


    # -----------------------------------
    # CHECK USER EXISTS
    # -----------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )


    # -----------------------------------
    # SAVE UPLOADED IMAGE
    # -----------------------------------

    file_path = os.path.join(
        UPLOAD_FOLDER,
        file.filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    # -----------------------------------
    # RUN AI MODEL
    # -----------------------------------

    result = predict_image(
        file_path
    )


    # -----------------------------------
    # GET PREDICTION
    # -----------------------------------

    prediction = result.get(
        "prediction"
    )

    confidence = result.get(
        "confidence"
    )


    if prediction is None:

        raise HTTPException(
            status_code=500,
            detail="AI model did not return a prediction"
        )


    if confidence is None:

        raise HTTPException(
            status_code=500,
            detail="AI model did not return confidence"
        )


    # -----------------------------------
    # SAVE PREDICTION HISTORY
    # -----------------------------------

    history = PredictionHistory(

        user_id=user.id,

        prediction=prediction,

        confidence=float(
            confidence
        ),

        image_name=file.filename
    )


    db.add(history)

    db.commit()

    db.refresh(history)


    # -----------------------------------
    # RETURN RESULT
    # -----------------------------------

    return {

        "prediction": prediction,

        "confidence": float(
            confidence
        ),

        "history_id": history.id

    }


# =======================================
# GET PREDICTION HISTORY
# =======================================

@router.get("/history")
def get_prediction_history(

    current_user=Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )

):

    # -----------------------------------
    # FIND USER
    # -----------------------------------

    user_id = None


    if current_user.get("user_id"):

        try:

            user_id = int(
                current_user.get("user_id")
            )

        except ValueError:

            user_id = None


    if user_id is None and current_user.get("sub"):

        try:

            user_id = int(
                current_user.get("sub")
            )

        except ValueError:

            user_id = None


    if user_id is None:

        email = current_user.get(
            "email"
        )

        if email:

            user = (
                db.query(User)
                .filter(
                    User.email == email
                )
                .first()
            )

            if user:

                user_id = user.id


    if user_id is None:

        raise HTTPException(
            status_code=401,
            detail="Unable to identify logged-in user"
        )


    # -----------------------------------
    # GET HISTORY
    # -----------------------------------

    history = (
        db.query(
            PredictionHistory
        )
        .filter(
            PredictionHistory.user_id == user_id
        )
        .order_by(
            PredictionHistory.created_at.desc()
        )
        .all()
    )


    # -----------------------------------
    # RETURN HISTORY
    # -----------------------------------

    return [

        {
            "id": item.id,

            "prediction": item.prediction,

            "confidence": item.confidence,

            "image_name": item.image_name,

            "created_at": item.created_at

        }

        for item in history

    ]