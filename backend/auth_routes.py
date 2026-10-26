import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.auth import get_password_hash, verify_google_token, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str

class GoogleToken(BaseModel):
    credential: str

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
    
    # 1. Check if user exists
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
        
    # 2. Check if they are a Google user
    if user.hashed_password.startswith("google_oauth_"):
        raise HTTPException(
            status_code=400, 
            detail="This account was created with Google. Please use the 'Continue with Google' button."
        )

    # 3. Check if they are a Guest
    if user.is_guest:
        raise HTTPException(status_code=401, detail="Guest accounts cannot log in.")

    # 4. Normal password verification
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "is_guest": False}

@router.post("/google")
def google_login(data: GoogleToken, db: Session = Depends(get_db)):
    user_info = verify_google_token(data.credential)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    user = db.query(User).filter(User.username == user_info["email"]).first()
    
    if not user:
        # Create new user with Google data
        user = User(
            username=user_info["email"], 
            hashed_password="google_oauth_" + str(uuid.uuid4()),
            is_guest=False,
            name=user_info.get("name"),         
            picture=user_info.get("picture")   
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update name/picture if they changed on Google
        user.name = user_info.get("name")
        user.picture = user_info.get("picture")
        db.commit()

    token = create_access_token(data={"sub": str(user.id)})
    
    # Return user data alongside the token
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "is_guest": False,
        "user": {
            "name": user.name,
            "email": user.username,
            "picture": user.picture
        }
    }