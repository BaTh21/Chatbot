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
from backend.models import ChatMessage, User
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

# Groq is OpenAI-compatible
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

SYSTEM_PROMPT = "You are a helpful assistant for a website."
MODEL_NAME = "openai/gpt-oss-120b"


class ChatRequest(BaseModel):
    message: str
    session_id: str


@app.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        is_real_user = current_user is not None and not current_user.is_guest

        # History: only for registered users
        if is_real_user:
            history_rows = (
                db.query(ChatMessage)
                .filter(ChatMessage.user_id == current_user.id)
                .order_by(asc(ChatMessage.created_at))
                .limit(20)
                .all()
            )
        else:
            history_rows = []

        # Build OpenAI-style messages
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for row in history_rows:
            messages.append({"role": "user", "content": row.user_message})
            messages.append({"role": "assistant", "content": row.bot_reply})
        messages.append({"role": "user", "content": request.message})

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
        )
        reply = response.choices[0].message.content

        # Save: only for registered users
        if is_real_user:
            log = ChatMessage(
                user_id=current_user.id,
                session_id=request.session_id,
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
            "is_guest": not is_real_user,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")