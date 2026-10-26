import os
import base64
import uuid
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import asc
import io
from pypdf import PdfReader

from backend.database import get_db
from backend.models import Attachment, ChatMessage, User, Folder
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
# Groq's vision model
MODEL_NAME = "qwen/qwen3.8-27b" 

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE = {"image/png", "image/jpeg", "image/gif", "image/webp"}


class ChatRequest(BaseModel):
    message: str
    session_id: str
    conversation_id: str
    folder_id: Optional[int] = None

class ChatUpdate(BaseModel):
    message: str

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
    
class FolderRename(BaseModel):
    name: str

class FolderOut(BaseModel):
    id: int
    name: str
    created_at: str
    

class AttachmentOut(BaseModel):
    id: int
    filename: str
    content_type: str
    size: int
    url: str
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

        # 1. Get text history
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

        # 2. Check for attachments (Images or PDFs)
        image_base64 = None
        image_mime = None
        pdf_text = ""

        if is_real_user:
            # Get the latest attachment
            att = (
                db.query(Attachment)
                .filter(
                    Attachment.user_id == current_user.id,
                    Attachment.conversation_id == conversation_id,
                )
                .order_by(Attachment.created_at.desc())
                .first()
            )
            
            if att and Path(att.stored_path).exists():
                # If it's an image
                if att.content_type.startswith("image/"):
                    with open(att.stored_path, "rb") as f:
                        image_base64 = base64.b64encode(f.read()).decode("utf-8")
                        image_mime = att.content_type
                
                # If it's a PDF
                elif att.content_type == "application/pdf":
                    try:
                        reader = PdfReader(att.stored_path)
                        extracted = []
                        # Read up to 10 pages to avoid token limits
                        for page in reader.pages[:10]: 
                            text = page.extract_text()
                            if text:
                                extracted.append(text)
                        pdf_text = "\n".join(extracted)
                    except Exception as e:
                        print(f"Failed to read PDF: {e}")

        # 3. Build messages
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for row in history_rows:
            messages.append({"role": "user", "content": row.user_message})
            messages.append({"role": "assistant", "content": row.bot_reply})
        
        # 4. Add current message (with image or PDF context)
        if image_base64:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": request.message or "Describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{image_base64}"}}
                ]
            })
        elif pdf_text:
            # Inject the PDF text directly into the prompt
            prompt_with_pdf = (
                f"Here is the text extracted from the attached PDF document:\n\n"
                f"--- START PDF ---\n{pdf_text}\n--- END PDF ---\n\n"
                f"User question: {request.message}\n\n"
                f"Please answer the question based on the PDF text provided above."
            )
            messages.append({"role": "user", "content": prompt_with_pdf})
        else:
            messages.append({"role": "user", "content": request.message})

        # 5. Call AI
        response = client.chat.completions.create(model=MODEL_NAME, messages=messages)
        reply = response.choices[0].message.content

        # 6. Save to DB
        if is_real_user:
            log = ChatMessage(
                user_id=current_user.id,
                session_id=request.session_id,
                conversation_id=conversation_id,
                folder_id=request.folder_id,
                user_message=request.message or "[attachment]",
                bot_reply=reply,
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            message_id = log.id

            # NEW: Link the latest unlinked attachment to this new message
            unlinked_att = (
                db.query(Attachment)
                .filter(
                    Attachment.conversation_id == conversation_id,
                    Attachment.message_id == None,
                )
                .order_by(Attachment.created_at.desc())
                .first()
            )
            if unlinked_att:
                unlinked_att.message_id = message_id
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
    
@app.delete("/history/message/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")

    # 1. Find all attachments linked to this message
    attachments = (
        db.query(Attachment)
        .filter(
            Attachment.user_id == current_user.id,
            Attachment.message_id == message_id,
        )
        .all()
    )

    # 2. Delete physical files from disk
    for att in attachments:
        if Path(att.stored_path).exists():
            try:
                os.remove(att.stored_path)
            except Exception as e:
                print(f"Failed to delete file {att.stored_path}: {e}")

    # 3. Delete the message (this cascades and deletes the attachment rows in the DB)
    db.delete(msg)
    db.commit()
    
    return {"deleted": message_id}

@app.patch("/history/message/{message_id}")
def update_message(
    message_id: int,
    data: ChatUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")

    # 1. Update the user message text in DB
    msg.user_message = data.message
    db.commit()

    # 2. Fetch history for context
    history_rows = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.user_id == current_user.id,
            ChatMessage.conversation_id == msg.conversation_id,
        )
        .order_by(asc(ChatMessage.created_at))
        .all()
    )

    # 3. Build messages for AI
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for row in history_rows:
        if row.id == msg.id and not row.bot_reply:
            continue
        messages.append({"role": "user", "content": row.user_message})
        if row.bot_reply:
            messages.append({"role": "assistant", "content": row.bot_reply})
    
    messages.append({"role": "user", "content": data.message})

    # 4. Get new AI reply
    response = client.chat.completions.create(model=MODEL_NAME, messages=messages)
    reply = response.choices[0].message.content

    # 5. Update the DB with the new AI reply
    msg.bot_reply = reply
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "user_message": msg.user_message,
        "bot_reply": msg.bot_reply,
    }
    
    
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

    attachments = (
        db.query(Attachment)
        .filter(
            Attachment.user_id == current_user.id,
            Attachment.conversation_id == conversation_id,
        )
        .all()
    )
    for att in attachments:
        if Path(att.stored_path).exists():
            os.remove(att.stored_path)

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

@app.patch("/folders/{folder_id}", response_model=FolderOut)
def rename_folder(
    folder_id: int,
    data: FolderRename,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")

    new_name = data.name.strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="Folder name required")

    # Check if another folder with the same name already exists
    exists = (
        db.query(Folder)
        .filter(Folder.user_id == current_user.id, Folder.name == new_name, Folder.id != folder_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Folder with this name already exists")

    folder.name = new_name
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


@app.post("/attachments", response_model=AttachmentOut)
async def upload_attachment(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    content_type = file.content_type or "application/octet-stream"
    if content_type.startswith("image/") and content_type not in ALLOWED_IMAGE:
        raise HTTPException(status_code=415, detail="Unsupported image type")

    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = UPLOAD_DIR / stored_name
    with open(stored_path, "wb") as f:
        f.write(contents)

    att = Attachment(
        user_id=current_user.id,
        conversation_id=conversation_id,
        filename=file.filename or stored_name,
        content_type=content_type,
        size=len(contents),
        stored_path=str(stored_path),
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    return AttachmentOut(
        id=att.id,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        url=f"/attachments/{att.id}",
        created_at=att.created_at.isoformat(),
    )


@app.get("/attachments/{attachment_id}")
def get_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if att.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your attachment")

    if not Path(att.stored_path).exists():
        raise HTTPException(status_code=404, detail="File missing on disk")

    return FileResponse(
        path=att.stored_path,
        media_type=att.content_type,
        filename=att.filename,
    )


@app.get("/attachments", response_model=list[AttachmentOut])
def list_attachments(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    rows = (
        db.query(Attachment)
        .filter(
            Attachment.user_id == current_user.id,
            Attachment.conversation_id == conversation_id,
        )
        .order_by(Attachment.created_at.asc())
        .all()
    )
    return [
        AttachmentOut(
            id=a.id,
            filename=a.filename,
            content_type=a.content_type,
            size=a.size,
            url=f"/attachments/{a.id}",
            created_at=a.created_at.isoformat(),
        )
        for a in rows
    ]


@app.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if current_user is None or current_user.is_guest:
        raise HTTPException(status_code=401, detail="Login required")

    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if att.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your attachment")

    if Path(att.stored_path).exists():
        os.remove(att.stored_path)

    db.delete(att)
    db.commit()
    return {"deleted": attachment_id}