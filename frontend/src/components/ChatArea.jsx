import React, { useEffect, useRef, useState } from "react";
import {
  Box, TextField, IconButton, Typography, CircularProgress, Chip, Paper,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import MessageBubble from "./MessageBubble";
import WelcomeScreen from "./WelcomeScreen";

export default function ChatArea({
  messages, loading, onSend, onStop, headerTitle, isGuest,
}) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100vh", minWidth: 0 }}>
      <Box
        sx={{
          px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider",
          display: "flex", alignItems: "center", gap: 1, bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
          {headerTitle || "New chat"}
        </Typography>
        <Chip
          size="small"
          label={isGuest ? "Guest" : "Signed in"}
          color={isGuest ? "default" : "primary"}
          variant="outlined"
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: "auto", px: 3, py: 3 }}>
        {messages.length === 0 && !loading ? (
          <WelcomeScreen onSelect={(p) => onSend(p)} />
        ) : (
          <Box sx={{ maxWidth: 820, mx: "auto" }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} time={m.time} />
            ))}
            {loading && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 6, mt: 1 }}>
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

      <Box sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper", p: 2 }}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          elevation={0}
          sx={{
            maxWidth: 820, mx: "auto", display: "flex", gap: 1, alignItems: "flex-end",
            border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1,
            "&:focus-within": { borderColor: "primary.main" },
          }}
        >
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
            <IconButton onClick={onStop} color="error">
              <StopIcon />
            </IconButton>
          ) : (
            <IconButton type="submit" color="primary" disabled={!input.trim()}>
              <SendIcon />
            </IconButton>
          )}
        </Paper>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
          AI can make mistakes. Verify important information.
        </Typography>
      </Box>
    </Box>
  );
}