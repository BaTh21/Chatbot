import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, IconButton, Tooltip, Chip,
  TextField, Button, useTheme
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"; // VS Code Dark Theme
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"; // Light Theme
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
      sx={{ maxWidth: "100%", maxHeight: 240, borderRadius: 2, display: "block", mt: 1 }}
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
      sx={{ mt: 1, bgcolor: "background.default" }}
    />
  );
}

export default function MessageBubble({ 
  role, content, time, attachments, messageId, onEdit, onDelete, isMobile 
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const theme = useTheme();

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

  // Custom renderer for Markdown (to handle code blocks and inline code)
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      
      // If it's an inline code block (like `npm install`)
      if (inline) {
        return (
          <code
            style={{
              backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.palette.action.selected,
              padding: "2px 6px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.85em",
            }}
            {...props}
          >
            {children}
          </code>
        );
      }

      // If it's a full code block
      return (
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              bgcolor: "grey.900",
              px: 2, py: 1,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1px solid #333"
            }}
          >
            <Typography variant="caption" sx={{ color: "grey.400", fontFamily: "monospace" }}>
              {match?.[1] || "code"}
            </Typography>
          </Box>
          <SyntaxHighlighter
            style={theme.palette.mode === "dark" ? vscDarkPlus : oneLight}
            language={match?.[1] || "text"}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "16px",
              fontSize: "0.85rem",
              background: theme.palette.mode === "dark" ? "#1e1e1e" : "#f8f8f8",
            }}
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </Box>
      );
    },
  };

  return (
    <Box 
      sx={{ 
        display: "flex", 
        mb: 3, 
        justifyContent: isUser ? "flex-end" : "flex-start" 
      }}
    >
      <Box 
        sx={{ 
          maxWidth: { xs: "90%", sm: "85%", md: "80%" }, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: isUser ? "flex-end" : "flex-start" 
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: { xs: 2, sm: 2.5 }, 
            py: { xs: 1, sm: 1.5 }, 
            borderRadius: "24px", 
            bgcolor: isUser ? "primary.main" : "background.paper",
            color: isUser ? "primary.contrastText" : "text.primary",
            border: isUser ? "none" : "1px solid",
            borderColor: "divider",
            "& p": { my: 0.5, lineHeight: 1.6, fontSize: { xs: "0.85rem", sm: "0.95rem" } },
            "& ul, & ol": { pl: 2.5, my: 0.5 },
            "& a": { color: isUser ? "inherit" : "primary.main" },
          }}
        >
          {isEditing ? (
            <Box sx={{ minWidth: { xs: 200, sm: 250 } }}>
              <TextField
                multiline
                fullWidth
                size="small"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                sx={{ 
                  bgcolor: "background.default", 
                  borderRadius: "16px",
                  "& .MuiInputBase-input": { color: "text.primary" }
                }}
                autoFocus
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => setIsEditing(false)} sx={{ color: isUser ? "white" : "inherit" }}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" color="secondary" onClick={handleSaveEdit} sx={{ borderRadius: "16px" }}>
                  Save & Resend
                </Button>
              </Box>
            </Box>
          ) : content ? (
            isUser ? (
              <Typography sx={{ whiteSpace: "pre-wrap", fontSize: { xs: "0.85rem", sm: "0.95rem" } }}>{content}</Typography>
            ) : (
              <Box sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, width: "100%" }}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]} 
                  components={MarkdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </Box>
            )
          ) : null}

          {attachments?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}
            </Box>
          )}
        </Paper>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, px: 0.5 }}>
          {time && <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}>{time}</Typography>}
          
          {/* Copy Button (Bot Only) */}
          {!isEditing && !isUser && content && (
            <Tooltip title={copied ? "Copied!" : "Copy reply"}>
              <IconButton size="small" onClick={handleCopy} sx={{ opacity: 0.6, "&:hover": { opacity: 1 }, p: { xs: 0.5, sm: 1 } }}>
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {/* Edit & Delete Buttons (User Only) */}
          {!isEditing && isUser && messageId && (
            <>
              <Tooltip title="Edit message">
                <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ opacity: 0.6, "&:hover": { opacity: 1 }, p: { xs: 0.5, sm: 1 } }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete message">
                <IconButton size="small" onClick={() => onDelete(messageId)} sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "error.main" }, p: { xs: 0.5, sm: 1 } }}>
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