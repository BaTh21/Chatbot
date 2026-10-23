import React from "react";
import { Box, Paper, Typography, Avatar } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";

export default function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: 1,
        mb: 1.5,
      }}
    >
      {!isUser && (
        <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
          <SmartToyIcon fontSize="small" />
        </Avatar>
      )}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          maxWidth: "75%",
          borderRadius: 2,
          borderTopLeftRadius: isUser ? 16 : 4,
          borderTopRightRadius: isUser ? 4 : 16,
          bgcolor: isUser ? "primary.main" : "grey.100",
          color: isUser ? "primary.contrastText" : "text.primary",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <Typography variant="body2">{content}</Typography>
      </Paper>
      {isUser && (
        <Avatar sx={{ bgcolor: "grey.400", width: 32, height: 32 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      )}
    </Box>
  );
}