import React from "react";
import { Box, Typography, Grid, Paper } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CodeIcon from "@mui/icons-material/Code";
import TranslateIcon from "@mui/icons-material/Translate";
import LightbulbIcon from "@mui/icons-material/Lightbulb";

const suggestions = [
  { icon: <CodeIcon />, title: "Write code", prompt: "Write a Python function that reverses a string." },
  { icon: <TranslateIcon />, title: "Translate", prompt: "Translate 'Hello, how are you?' into Khmer." },
  { icon: <LightbulbIcon />, title: "Explain", prompt: "Explain how JWT authentication works in simple terms." },
  { icon: <AutoAwesomeIcon />, title: "Create", prompt: "Write a short product description for a chatbot SaaS." },
];

export default function WelcomeScreen({ onSelect }) {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto", textAlign: "center", py: 6, px: 2 }}>
      <Box
        sx={{
          width: 64, height: 64, borderRadius: 3, bgcolor: "primary.main",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "white", mb: 3,
        }}
      >
        <AutoAwesomeIcon fontSize="large" />
      </Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        How can I help you today?
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Ask a question, get code, or explore ideas with your AI assistant.
      </Typography>

      <Grid container spacing={2}>
        {suggestions.map((s, i) => (
          <Grid xs={12} sm={6} key={i}>
            <Paper
              variant="outlined"
              sx={{
                p: 2, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                "&:hover": { borderColor: "primary.main", bgcolor: "primary.50", transform: "translateY(-2px)" },
              }}
              onClick={() => onSelect(s.prompt)}
            >
              <Box sx={{ color: "primary.main", mb: 1 }}>{s.icon}</Box>
              <Typography variant="subtitle2" fontWeight={600}>{s.title}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{s.prompt}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}