from datetime import datetime

from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from database import Base


class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    username = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    email = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )

    hashed_password = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        default="user",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


class PredictionHistory(Base):

    __tablename__ = "prediction_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    prediction = Column(
        String(50),
        nullable=False
    )

    confidence = Column(
        Float,
        nullable=False
    )

    image_name = Column(
        String(255),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )