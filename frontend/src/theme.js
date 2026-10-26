import { createTheme } from "@mui/material/styles";

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    ...(mode === "light"
      ? {
          primary: { main: "#4f46e5" },
          secondary: { main: "#0ea5e9" },
          background: { default: "#f8fafc", paper: "#ffffff" },
          text: { primary: "#0f172a", secondary: "#64748b" },
          divider: "#e2e8f0",
        }
      : {
          primary: { main: "#818cf8" }, // Lighter indigo for dark mode
          secondary: { main: "#38bdf8" },
          background: { default: "#0f172a", paper: "#1e293b" },
          text: { primary: "#f8fafc", secondary: "#94a3b8" },
          divider: "#334155",
        }),
  },
  typography: {
    fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});

export const getTheme = (mode) => createTheme(getDesignTokens(mode));