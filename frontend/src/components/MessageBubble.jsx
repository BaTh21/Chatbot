import React from "react";
import { Box, Avatar, Typography, Paper } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageBubble({ role, content, time }) {
  const isUser = role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        mb: 3,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: isUser ? "grey.400" : "primary.main",
          flexShrink: 0,
        }}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
      </Avatar>

      <Box
        sx={{
          maxWidth: "75%",
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 3,
            borderTopRightRadius: isUser ? 0.5 : 3,
            borderTopLeftRadius: isUser ? 3 : 0.5,
            bgcolor: isUser ? "primary.main" : "grey.50",
            color: isUser ? "primary.contrastText" : "text.primary",
            border: isUser ? "none" : "1px solid",
            borderColor: "divider",
            "& p": { my: 0.5, lineHeight: 1.6 },
            "& ul, & ol": { pl: 2.5, my: 0.5 },
            "& pre": {
              bgcolor: "grey.900",
              color: "grey.100",
              p: 1.5,
              borderRadius: 2,
              overflowX: "auto",
              my: 1,
              fontSize: "0.85rem",
            },
            "& code": {
              bgcolor: isUser ? "rgba(255,255,255,0.2)" : "grey.200",
              px: 0.5,
              py: 0.2,
              borderRadius: 0.5,
            },
            "& pre code": { bgcolor: "transparent", p: 0 },
            "& a": { color: isUser ? "inherit" : "primary.main" },
          }}
        >
          {isUser ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {content}
            </Typography>
          ) : (
            <Box sx={{ fontSize: "0.9rem" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </Box>
          )}
        </Paper>

        {time && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, px: 0.5 }}>
            {time}
          </Typography>
        )}
      </Box>
    </Box>
  );
}