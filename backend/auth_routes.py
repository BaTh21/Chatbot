import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.auth import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


@router.post("/guest")
def create_guest(db: Session = Depends(get_db)):
    guest_name = f"guest_{uuid.uuid4().hex[:8]}"
    guest_user = User(username=guest_name, hashed_password="", is_guest=True)
    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)
    token = create_access_token(data={"sub": str(guest_user.id)})
    return {"access_token": token, "token_type": "bearer", "is_guest": True}


@router.post("/register")
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        is_guest=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "user_id": user.id}


@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        username = body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

    if not username or not password:
        raise HTTPException(status_code=422, detail="username and password are required")

    user = db.query(User).filter(User.username == username).first()
    if not user or user.is_guest or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "is_guest": False}