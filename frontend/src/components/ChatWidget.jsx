import React, { useEffect, useRef, useState } from "react";
import {
  Box, Fab, Paper, Typography, TextField, IconButton,
  CircularProgress, Chip, Divider, Button,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MessageBubble from "./MessageBubble";
import AuthDialog from "./AuthDialog";
import { isLoggedIn, logout, sendChatMessage } from "../api";

function generateSessionId() {
  let sid = localStorage.getItem("chat_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sid);
  }
  return sid;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sessionId = useRef(generateSessionId());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setMessages([
      { role: "assistant", content: "You have been logged out. Chatting as guest." },
    ]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const text = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendChatMessage(text, sessionId.current);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      if (err.status === 401) {
        setLoggedIn(false);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1200 }}>
        {open && (
          <Paper
            elevation={12}
            sx={{
              width: 380,
              height: 560,
              mb: 2,
              display: "flex",
              flexDirection: "column",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
                AI Assistant
              </Typography>
              <Chip
                size="small"
                label={loggedIn ? "User" : "Guest"}
                sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
              />
              {loggedIn ? (
                <IconButton size="small" sx={{ color: "white" }} onClick={handleLogout} title="Logout">
                  <LogoutIcon fontSize="small" />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  sx={{ color: "white" }}
                  onClick={() => setAuthOpen(true)}
                  title="Login"
                >
                  <LoginIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" sx={{ color: "white" }} onClick={() => setOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Divider />

            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2, bgcolor: "grey.50" }}>
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} />
              ))}
              {loading && (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">Thinking...</Typography>
                </Box>
              )}
              <div ref={endRef} />
            </Box>

            {/* Input */}
            <Box
              component="form"
              onSubmit={sendMessage}
              sx={{
                p: 1.5,
                bgcolor: "background.paper",
                borderTop: "1px solid",
                borderColor: "divider",
                display: "flex",
                gap: 1,
                alignItems: "flex-end",
              }}
            >
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={4}
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                disabled={loading}
              />
              <IconButton
                type="submit"
                color="primary"
                disabled={!input.trim() || loading}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Paper>
        )}

        <Fab color="primary" onClick={() => setOpen((v) => !v)}>
          {open ? <CloseIcon /> : <ChatIcon />}
        </Fab>
      </Box>

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setLoggedIn(true)}
      />
    </>
  );
}