import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import asc
from google import genai
from google.genai import types

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

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = "You are a helpful assistant for a website."
MODEL_NAME = "gemini-2.0-flash"


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

        # History: only real users
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

        # Build Gemini conversation contents
        contents = []
        for row in history_rows:
            contents.append(
                types.Content(role="user", parts=[types.Part(text=row.user_message)])
            )
            contents.append(
                types.Content(role="model", parts=[types.Part(text=row.bot_reply)])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part(text=request.message)])
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
            ),
        )
        reply = response.text

        # Save: only real users
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