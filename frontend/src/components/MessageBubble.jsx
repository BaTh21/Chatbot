import React, { useState, useEffect } from "react";
import {
  Box, Avatar, Typography, Paper, IconButton, Tooltip, Chip,
  TextField, Button
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { attachmentUrl, getToken } from "../api";

function AuthedImage({ id, alt }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(attachmentUrl(id), {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!src) return <Chip size="small" label="Loading image…" sx={{ mt: 1 }} />;
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 2, display: "block", mt: 1 }}
    />
  );
}

function AttachmentChip({ a }) {
  const isImage = a.content_type.startsWith("image/");

  const handleDownload = async () => {
    try {
      const res = await fetch(attachmentUrl(a.id), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  if (isImage) {
    return <AuthedImage id={a.id} alt={a.filename} />;
  }

  return (
    <Chip
      size="small"
      label={a.filename}
      onClick={handleDownload}
      onDelete={handleDownload}
      deleteIcon={<DownloadIcon fontSize="small" />}
      sx={{ mt: 1, bgcolor: "background.paper" }}
    />
  );
}

export default function MessageBubble({ 
  role, content, time, attachments, messageId, onEdit, onDelete 
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);

  // Keep edit value in sync if content changes externally
  useEffect(() => {
    setEditValue(content);
  }, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== content) {
      onEdit(messageId, editValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexDirection: isUser ? "row-reverse" : "row" }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: isUser ? "grey.400" : "primary.main", flexShrink: 0 }}>
        {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
      </Avatar>

      <Box sx={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <Paper
          elevation={0}
          sx={{
            px: 2, py: 1.5, borderRadius: 3,
            borderTopRightRadius: isUser ? 0.5 : 3,
            borderTopLeftRadius: isUser ? 3 : 0.5,
            bgcolor: isUser ? "primary.main" : "grey.50",
            color: isUser ? "primary.contrastText" : "text.primary",
            border: isUser ? "none" : "1px solid",
            borderColor: "divider",
            "& p": { my: 0.5, lineHeight: 1.6 },
            "& ul, & ol": { pl: 2.5, my: 0.5 },
            "& pre": { bgcolor: "grey.900", color: "grey.100", p: 1.5, borderRadius: 2, overflowX: "auto", my: 1, fontSize: "0.85rem" },
            "& code": { bgcolor: isUser ? "rgba(255,255,255,0.2)" : "grey.200", px: 0.5, py: 0.2, borderRadius: 0.5 },
            "& pre code": { bgcolor: "transparent", p: 0 },
            "& a": { color: isUser ? "inherit" : "primary.main" },
          }}
        >
          {isEditing ? (
            <Box sx={{ minWidth: 250 }}>
              <TextField
                multiline
                fullWidth
                size="small"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                sx={{ 
                  bgcolor: "background.paper", 
                  borderRadius: 1,
                  "& .MuiInputBase-input": { color: "text.primary" }
                }}
                autoFocus
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => setIsEditing(false)} sx={{ color: isUser ? "white" : "inherit" }}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" color="secondary" onClick={handleSaveEdit}>
                  Save & Resend
                </Button>
              </Box>
            </Box>
          ) : content ? (
            isUser ? (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{content}</Typography>
            ) : (
              <Box sx={{ fontSize: "0.9rem" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </Box>
            )
          ) : null}

          {attachments?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}
            </Box>
          )}
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, px: 0.5 }}>
          {time && <Typography variant="caption" color="text.secondary">{time}</Typography>}
          
          {/* Copy Button (Bot Only) */}
          {!isEditing && !isUser && content && (
            <Tooltip title={copied ? "Copied!" : "Copy reply"}>
              <IconButton size="small" onClick={handleCopy} sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {/* Edit & Delete Buttons (User Only) */}
          {!isEditing && isUser && messageId && (
            <>
              <Tooltip title="Edit message">
                <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete message">
                <IconButton size="small" onClick={() => onDelete(messageId)} sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "error.main" } }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}