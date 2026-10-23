import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb" },
    secondary: { main: "#1d4ed8" },
    background: { default: "#f3f4f6", paper: "#ffffff" },
  },
  typography: {
    fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
});

export default theme;