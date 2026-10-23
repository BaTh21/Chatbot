import os
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import asc
from typing import Optional

from backend.database import get_db
from backend.models import ChatMessage, User
from backend.auth import get_current_user_optional
from backend.auth_routes import router as auth_router

load_dotenv()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)

client = OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)
SYSTEM_PROMPT = "You are a helpful assistant."

class ChatRequest(BaseModel):
    message: str
    session_id: str  # Guest relies on this to isolate conversations

@app.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional) # Optional auth
):
    try:
        query = db.query(ChatMessage)
        if current_user and not current_user.is_guest:
            # Logged-in user: read by user_id
            query = query.filter(ChatMessage.user_id == current_user.id)
        else:
            # Guest: read by session_id (maintain original logic)
            query = query.filter(ChatMessage.session_id == request.session_id)
        
        history_rows = query.order_by(asc(ChatMessage.created_at)).limit(20).all()

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for row in history_rows:
            messages.append({"role": "user", "content": row.user_message})
            messages.append({"role": "assistant", "content": row.bot_reply})
        messages.append({"role": "user", "content": request.message})

        response = client.chat.completions.create(model="gemini-3.8-flash", messages=messages)
        reply = response.choices[0].message.content

        log = ChatMessage(
            user_id=current_user.id if (current_user and not current_user.is_guest) else None,
            session_id=request.session_id,
            user_message=request.message,
            bot_reply=reply,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return {"reply": reply, "id": log.id, "session_id": request.session_id, "is_guest": not bool(current_user and not current_user.is_guest)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))