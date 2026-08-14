import os
import base64
import hashlib
import hmac

from datetime import datetime, timedelta

from dotenv import load_dotenv
from jose import jwt


load_dotenv()


SECRET_KEY = os.getenv(
    "SECRET_KEY"
)

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)


def hash_password(password: str) -> str:

    salt = os.urandom(16)

    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=64
    )

    return (
        "scrypt$"
        + base64.b64encode(salt).decode("utf-8")
        + "$"
        + base64.b64encode(password_hash).decode("utf-8")
    )


def verify_password(
    plain_password: str,
    stored_password: str
) -> bool:

    try:

        parts = stored_password.split("$")

        if len(parts) != 3:
            return False

        algorithm = parts[0]

        if algorithm != "scrypt":
            return False

        salt = base64.b64decode(
            parts[1]
        )

        stored_hash = base64.b64decode(
            parts[2]
        )

        new_hash = hashlib.scrypt(
            plain_password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=64
        )

        return hmac.compare_digest(
            new_hash,
            stored_hash
        )

    except Exception:

        return False


def create_access_token(
    data: dict
):

    to_encode = data.copy()

    expire = (
        datetime.utcnow()
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )