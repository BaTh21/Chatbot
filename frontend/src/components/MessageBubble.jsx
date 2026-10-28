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
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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
      } catch { }
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
    } catch { }
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

  // Custom renderer for Markdown
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");

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

      return (
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              bgcolor: "grey.900", px: 2, py: 1,
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
              margin: 0, padding: "16px",
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

    // --- FIXED TABLE STYLING ---
    table({ node, ...props }) {
      return (
        <Box sx={{ overflowX: "auto", my: 2, maxWidth: "100%", pb: 1 }}>
          <table 
            style={{ 
              borderCollapse: "collapse", 
              width: "100%", 
              fontSize: "0.95rem", 
              minWidth: "600px",
              tableLayout: "auto" // Fixes column sizing
            }} 
            {...props} 
          />
        </Box>
      );
    },
    th({ node, ...props }) {
      return (
        <th 
          style={{ 
            border: "1px solid", 
            borderColor: theme.palette.divider, 
            padding: "12px 16px", 
            backgroundColor: theme.palette.action.hover, 
            textAlign: "left",
            verticalAlign: "top", // Forces header to stay at top
            fontWeight: 600,
            fontSize: "1rem",
            whiteSpace: "nowrap" 
          }} 
          {...props} 
        />
      );
    },
    td({ node, ...props }) {
      return (
        <td 
          style={{ 
            border: "1px solid", 
            borderColor: theme.palette.divider, 
            padding: "12px 16px", 
            verticalAlign: "top", // Forces numbers 10 and 11 to stay perfectly aligned next to their text
            lineHeight: "1.6",
            fontSize: "0.95rem",
            wordBreak: "break-word" 
          }} 
          {...props} 
        />
      );
    },

    // Prevents invisible blank lines inside table cells
    br({ node, ...props }) {
      return <br style={{ display: "block", content: '""', margin: 0, lineHeight: 0 }} {...props} />;
    },

    ol({ node, ...props }) {
      return <ol style={{ paddingLeft: "24px", margin: "8px 0", listStyleType: "decimal", fontSize: "0.95rem" }} {...props} />;
    },
    ul({ node, ...props }) {
      return <ul style={{ paddingLeft: "24px", margin: "8px 0", listStyleType: "disc", fontSize: "0.95rem" }} {...props} />;
    },
    h1({ node, ...props }) {
      return <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 700 }} {...props} />;
    },
    h2({ node, ...props }) {
      return <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 700 }} {...props} />;
    },
    h3({ node, ...props }) {
      return <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }} {...props} />;
    },
    blockquote({ node, ...props }) {
      return (
        <Box
          component="blockquote"
          sx={{
            borderLeft: "4px solid",
            borderColor: "primary.main",
            pl: 2, my: 1,
            color: "text.secondary",
            fontStyle: "italic",
            fontSize: "0.95rem"
          }}
          {...props}
        />
      );
    }
  };

  return (
    <Box sx={{ display: "flex", mb: 3, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <Box
        sx={{
          maxWidth: { xs: "95%", sm: "85%", md: "80%" },
          display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start"
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: { xs: 2, sm: 2.5 }, py: { xs: 1, sm: 1.5 }, borderRadius: "24px",
            bgcolor: isUser ? "primary.main" : "background.paper",
            color: isUser ? "primary.contrastText" : "text.primary",
            border: isUser ? "none" : "1px solid", borderColor: "divider",
            "& p": { my: 0.5, lineHeight: 1.6, fontSize: { xs: "0.85rem", sm: "0.95rem" } },
            "& a": { color: isUser ? "inherit" : "primary.main" },
            wordBreak: "break-word",
          }}
        >
          {isEditing ? (
            <Box sx={{ minWidth: { xs: 200, sm: 250 } }}>
              <TextField
                multiline fullWidth size="small" value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                sx={{ bgcolor: "background.default", borderRadius: "16px", "& .MuiInputBase-input": { color: "text.primary" } }}
                autoFocus
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => setIsEditing(false)} sx={{ color: isUser ? "white" : "inherit" }}>Cancel</Button>
                <Button size="small" variant="contained" color="secondary" onClick={handleSaveEdit} sx={{ borderRadius: "16px" }}>Save & Resend</Button>
              </Box>
            </Box>
          ) : content ? (
            isUser ? (
              <Typography sx={{ whiteSpace: "pre-wrap", fontSize: { xs: "0.85rem", sm: "0.95rem" } }}>{content}</Typography>
            ) : (
              <Box sx={{ fontSize: { xs: "0.9rem", sm: "1rem" }, width: "100%" }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={MarkdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </Box>
            )
          ) : null}

          {attachments?.length > 0 && (
            <Box sx={{ mt: 1 }}>{attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}</Box>
          )}
        </Paper>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, px: 0.5 }}>
          {time && <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}>{time}</Typography>}

          {!isEditing && !isUser && content && (
            <Tooltip title={copied ? "Copied!" : "Copy reply"}>
              <IconButton size="small" onClick={handleCopy} sx={{ opacity: 0.6, "&:hover": { opacity: 1 }, p: { xs: 0.5, sm: 1 } }}>
                {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

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