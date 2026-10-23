import React from "react";
import { Box, Typography, Container, Button } from "@mui/material";
import ChatWidget from "./components/ChatWidget";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Typography variant="h3" fontWeight={700} gutterBottom>
          Welcome to ChatBot
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This is your demo site. Click the chat button in the bottom-right corner
          to start a conversation. Log in to save your chat history.
        </Typography>
        <Button variant="contained" href="http://localhost:8000/docs" target="_blank">
          Open API Docs
        </Button>
      </Container>

      <ChatWidget />
    </Box>
  );
}