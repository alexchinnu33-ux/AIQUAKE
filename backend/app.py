from fastapi import FastAPI

from routes import router

from earthquake_routes import (
    router as earthquake_router
)


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="GROUNDTRUTH AIQuake",
    description=(
        "AI earthquake damage assessment "
        "and emergency intelligence platform"
    ),
    version="1.0.0"
)


# ============================================================
# EXISTING ROUTES
# ============================================================

app.include_router(
    router
)


# ============================================================
# EARTHQUAKE ROUTES
# ============================================================

app.include_router(
    earthquake_router
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name":
            "GROUNDTRUTH AIQuake",

        "status":
            "online",

        "message":
            "Emergency intelligence API is running"
    }