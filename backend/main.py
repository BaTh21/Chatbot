import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import asc

from backend.database import get_db
from backend.models import ChatMessage, User, Folder
from backend.auth import get_current_user_optional
from backend.auth_routes import router as auth_router

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

SYSTEM_PROMPT = "You are a helpful assistant for a website."
MODEL_NAME = "openai/gpt-oss-120b"


class ChatRequest(BaseModel):
    message: str
    session_id: str
    conversation_id: str
    folder_id: Optional[int] = None


class HistoryItem(BaseModel):
    id: int
    conversation_id: str
    session_id: str
    folder_id: Optional[int]
    user_message: str
    bot_reply: str
    created_at: str


class FolderCreate(BaseModel):
    name: str


class FolderOut(BaseModel):
    id: int
    name: str
    created_at: str


@app.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        is_real_user = current_user is not None and not current_user.is_guest
        conversation_id = request.conversation_id

        if is_real_user:
            history_rows = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.user_id == current_user.id,
                    ChatMessage.conversation_id == conversation_id,
                )
                .order_by(asc(ChatMessage.created_at))
                .limit(20)
                .all()
            )
        else:
            history_rows = []

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for row in history_rows:
            messages.append({"role": "user", "content": row.user_message})
            messages.append({"role": "assistant", "content": row.bot_reply})
        messages.append({"role": "user", "content": request.message})

        response = client.chat.completions.create(model=MODEL_NAME, messages=messages)
        reply = response.choices[0].message.content

        if is_real_user:
            log = ChatMessage(
                user_id=current_user.id,
                session_id=request.session_id,
                conversation_id=conversation_id,
                folder_id=request.folder_id,
                user_message=request.message,
                bot_reply=reply,
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            message_id = log.id
        else:
            message_id = None

        return {
            "reply": reply,
            "id": message_id,
            "session_id": request.session_id,
            "conversation_id": conversation_id,
            "folder_id": request.folder_id,
            "is_guest": not is_real_user,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@app.get("/history", response_model=list[HistoryItem])
def get_history(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required to load history")

    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(asc(ChatMessage.created_at))
        .all()
    )
    return [
        HistoryItem(
            id=r.id,
            conversation_id=r.conversation_id,
            session_id=r.session_id,
            folder_id=r.folder_id,
            user_message=r.user_message,
            bot_reply=r.bot_reply,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@app.delete("/history/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    existing = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .first()
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your conversation")

    deleted = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.user_id == current_user.id,
            ChatMessage.conversation_id == conversation_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted, "conversation_id": conversation_id}


@app.patch("/history/{conversation_id}/folder")
def move_conversation(
    conversation_id: str,
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    if folder_id is not None:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
        if folder is None:
            raise HTTPException(status_code=404, detail="Folder not found")

    updated = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.user_id == current_user.id,
            ChatMessage.conversation_id == conversation_id,
        )
        .update({ChatMessage.folder_id: folder_id})
    )
    db.commit()
    if updated == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"updated": updated, "conversation_id": conversation_id, "folder_id": folder_id}


@app.get("/folders", response_model=list[FolderOut])
def list_folders(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    rows = (
        db.query(Folder)
        .filter(Folder.user_id == current_user.id)
        .order_by(Folder.name.asc())
        .all()
    )
    return [FolderOut(id=f.id, name=f.name, created_at=f.created_at.isoformat()) for f in rows]


@app.post("/folders", response_model=FolderOut)
def create_folder(
    data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Folder name required")

    exists = (
        db.query(Folder)
        .filter(Folder.user_id == current_user.id, Folder.name == name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Folder already exists")

    folder = Folder(user_id=current_user.id, name=name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return FolderOut(id=folder.id, name=folder.name, created_at=folder.created_at.isoformat())


@app.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")

    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.folder_id == folder_id,
    ).update({ChatMessage.folder_id: None})

    db.delete(folder)
    db.commit()
    return {"deleted": folder_id}