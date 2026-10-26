import React, { useEffect, useRef, useState } from "react";
import {
  Box, TextField, IconButton, Typography, CircularProgress, Chip, Paper,
  Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebar";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import MessageBubble from "./MessageBubble";
import WelcomeScreen from "./WelcomeScreen";

export default function ChatArea({
  messages, loading, onSend, onStop, headerTitle, isGuest,
  pendingFiles, onAddFiles, onRemoveFile, isUploading,
  onEditMessage, onDeleteMessage,
  sidebarOpen, onToggleSidebar, isMobile,
}) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((!input.trim() && pendingFiles.length === 0) || loading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddFiles(files);
    e.target.value = "";
  };

  return (
    <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100vh", minWidth: 0 }}>
      {/* Responsive Header */}
      <Box
        sx={{
          px: { xs: 1.5, sm: 2, md: 3 }, 
          py: { xs: 1.5, sm: 2 }, 
          borderBottom: "1px solid", borderColor: "divider",
          display: "flex", alignItems: "center", gap: 1, bgcolor: "background.paper",
        }}
      >
        <Tooltip title={sidebarOpen ? "Close sidebar" : "Open sidebar"}>
          <IconButton onClick={onToggleSidebar} sx={{ mr: { xs: 0, sm: 1 } }}>
            {sidebarOpen ? <CloseFullscreenIcon /> : <ViewSidebarIcon />}
          </IconButton>
        </Tooltip>

        <Typography variant="h6" sx={{ flexGrow: 1, fontSize: { xs: "1rem", sm: "1.25rem" } }} noWrap>
          {headerTitle || "New chat"}
        </Typography>
        <Chip
          size="small"
          label={isGuest ? "Guest" : "Signed in"}
          color={isGuest ? "default" : "primary"}
          variant="outlined"
          sx={{ display: { xs: "none", sm: "flex" } }} // Hide chip on very small screens
        />
      </Box>

      {/* Messages Area */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        {messages.length === 0 && !loading ? (
          <WelcomeScreen onSelect={(p) => onSend(p)} />
        ) : (
          <Box sx={{ maxWidth: 820, mx: "auto", width: "100%" }}>
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                time={m.time}
                attachments={m.attachments}
                messageId={m.id}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                isMobile={isMobile}
              />
            ))}
            {loading && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 2, mt: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Assistant is typing…
                </Typography>
              </Box>
            )}
            <div ref={endRef} />
          </Box>
        )}
      </Box>

      {/* Composer Area */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper", p: { xs: 1.5, sm: 2 } }}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={{
            maxWidth: 820, mx: "auto", display: "flex", gap: 1, alignItems: "flex-end",
            border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1,
            bgcolor: "background.default",
            "&:focus-within": { borderColor: "primary.main", bgcolor: "background.paper" },
          }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleFilePick}
            disabled={isGuest}
            accept="image/*,application/pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx"
          />
          <Tooltip title={isGuest ? "Login to attach files" : "Attach file"}>
            <span>
              <IconButton
                onClick={() => fileRef.current?.click()}
                disabled={isGuest || loading || isUploading}
                size={isMobile ? "small" : "medium"}
              >
                {isUploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
              </IconButton>
            </span>
          </Tooltip>

          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={6}
            placeholder="Message AI assistant…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            variant="standard"
            slotProps={{ input: { disableUnderline: true } }}
            sx={{ px: 1, py: 0.5 }}
          />
          {loading ? (
            <IconButton onClick={onStop} color="error" size={isMobile ? "small" : "medium"}>
              <StopIcon />
            </IconButton>
          ) : (
            <IconButton
              type="submit"
              color="primary"
              disabled={(!input.trim() && pendingFiles.length === 0) || isUploading}
              size={isMobile ? "small" : "medium"}
            >
              <SendIcon />
            </IconButton>
          )}
        </Paper>

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <Box sx={{ maxWidth: 820, mx: "auto", mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {pendingFiles.map((f, i) => (
              <Chip
                key={i}
                label={f.name}
                onDelete={() => onRemoveFile(i)}
                deleteIcon={<CloseIcon />}
                size="small"
                sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
              />
            ))}
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1, fontSize: { xs: "0.7rem", sm: "0.75rem" } }}>
          AI can make mistakes. Verify important information.
        </Typography>
      </Box>
    </Box>
  );
}