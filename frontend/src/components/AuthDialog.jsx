import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Alert, Typography, Divider, CircularProgress
} from "@mui/material";
import { GoogleLogin } from '@react-oauth/google';
import { googleLogin, guestLogin } from "../api";

export default function AuthDialog({ open, onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setError("");
    setLoading(false);
    onClose();
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setLoading(true);
    try {
      await googleLogin(credentialResponse.credential);
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await guestLogin();
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err.message || "Guest login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: "center", pb: 1, pt: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Welcome to AI Chat
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Sign in to save your conversations
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ pb: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* Google Login */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Login Failed")}
            theme="outline"
            shape="pill"
            text="continue_with"
            size="large"
          />
        </Box>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary">OR</Typography>
        </Divider>

        {/* Guest Login */}
        <Button
          fullWidth
          variant="outlined"
          size="large"
          onClick={handleGuestLogin}
          disabled={loading}
          sx={{ borderRadius: 2, py: 1.5 }}
        >
          {loading ? <CircularProgress size={24} /> : "Continue as Guest"}
        </Button>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Guest accounts do not save history.
        </Typography>
      </DialogActions>
    </Dialog>
  );
}