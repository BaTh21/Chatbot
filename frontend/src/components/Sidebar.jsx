import React, { useState } from "react";
import {
  Box, Typography, Button, List, ListItemButton, ListItemText,
  IconButton, Divider, Avatar, Menu, MenuItem, CircularProgress,
  Collapse, TextField, Tooltip, Dialog, DialogTitle, DialogContent, 
  DialogActions, DialogContentText
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import { getUserProfile } from "../api";

function ConversationItem({ c, activeId, onSelect, onDelete, deletingId, folders, onMoveToFolder }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  return (
    <ListItemButton
      selected={c.id === activeId}
      onClick={() => onSelect(c.id)}
      sx={{ 
        mx: 1, borderRadius: 1, mb: 0.5, 
        "&.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } } 
      }}
    >
      <ChatBubbleOutlineOutlined fontSize="small" sx={{ mr: 1, color: c.id === activeId ? "inherit" : "text.secondary" }} />
      <ListItemText
        primary={c.title || "New conversation"}
        slotProps={{ primary: { variant: "body2", noWrap: true } }}
      />
      <Tooltip title="Move to folder">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
          sx={{ opacity: 0.5, "&:hover": { opacity: 1 }, color: "inherit" }}
        >
          <FolderOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <IconButton
        size="small"
        disabled={deletingId === c.id}
        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
        sx={{ opacity: 0.5, "&:hover": { opacity: 1, color: "error.main" }, color: "inherit" }}
      >
        {deletingId === c.id ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineOutlined fontSize="small" />}
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { onMoveToFolder(c.id, null); setMenuAnchor(null); }}>
          No folder
        </MenuItem>
        {folders.map((f) => (
          <MenuItem key={f.id} onClick={() => { onMoveToFolder(c.id, f.id); setMenuAnchor(null); }}>
            {f.name}
          </MenuItem>
        ))}
      </Menu>
    </ListItemButton>
  );
}

export default function Sidebar({
  conversations, folders, folderByConv, activeId, onSelect, onNew, onDelete,
  onCreateFolder, onDeleteFolder, onMoveToFolder, onRenameFolder,
  loggedIn, onLogin, onLogout,
  themeMode, onThemeChange,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [collapsed, setCollapsed] = useState({});
  
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); 

  // Get the Google Profile data
  const profile = getUserProfile();

  const handleDeleteClick = (type, id, title) => {
    setConfirmDelete({ type, id, title });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);

    if (type === "conversation") {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    } else if (type === "folder") {
      await onDeleteFolder(id);
    }
  };

  const submitFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    await onCreateFolder(name);
    setFolderName("");
    setCreatingFolder(false);
  };

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!name || !renamingFolder) return;
    await onRenameFolder(renamingFolder, name);
    setRenamingFolder(null);
  };

  const grouped = { root: [] };
  folders.forEach((f) => (grouped[f.id] = []));
  conversations.forEach((c) => {
    const fid = folderByConv[c.id] ?? null;
    if (fid != null && grouped[fid]) grouped[fid].push(c);
    else grouped.root.push(c);
  });

  const toggle = (id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Box
      sx={{
        width: 280, 
        bgcolor: "background.paper", 
        borderRight: "1px solid",
        borderColor: "divider", 
        display: "flex", 
        flexDirection: "column", 
        height: "100vh",
      }}
    >
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1.5, bgcolor: "primary.main",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}
        >
          <SmartToyIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" fontWeight={700}>AI Chat</Typography>
      </Box>

      <Box sx={{ px: 2, pb: 1, display: "flex", gap: 1 }}>
        <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => onNew(null)} sx={{ justifyContent: "flex-start" }}>
          New chat
        </Button>
        <Tooltip title="New folder">
          <IconButton onClick={() => setCreatingFolder((v) => !v)}>
            <CreateNewFolderOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={creatingFolder}>
        <Box sx={{ px: 2, pb: 1, display: "flex", gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitFolder(); }}
          />
          <Button variant="contained" size="small" onClick={submitFolder}>Add</Button>
        </Box>
      </Collapse>

      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: "auto", py: 1 }}>
        {folders.map((f) => (
          <Box key={f.id}>
            <Box
              sx={{
                display: "flex", alignItems: "center", px: 2, py: 0.5,
                cursor: "pointer", "&:hover": { bgcolor: "action.hover" },
              }}
              onClick={() => toggle(f.id)}
            >
              {collapsed[f.id] ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
              <FolderOutlinedIcon fontSize="small" sx={{ mx: 1, color: "text.secondary" }} />
              <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                {f.name}
              </Typography>
              
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFolder(f.id);
                  setRenameValue(f.name);
                }}
                title="Rename folder"
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick("folder", f.id, f.name);
                }}
                title="Delete folder"
                sx={{ "&:hover": { color: "error.main" } }}
              >
                <DeleteOutlineOutlined fontSize="small" />
              </IconButton>
            </Box>
            <Collapse in={!collapsed[f.id]}>
              <List dense disablePadding>
                {grouped[f.id]?.length ? (
                  grouped[f.id].map((c) => (
                    <ConversationItem
                      key={c.id}
                      c={c}
                      activeId={activeId}
                      onSelect={onSelect}
                      onDelete={(id) => handleDeleteClick("conversation", id, c.title)}
                      deletingId={deletingId}
                      folders={folders}
                      onMoveToFolder={onMoveToFolder}
                    />
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 6, display: "block", py: 0.5 }}>
                    Empty
                  </Typography>
                )}
              </List>
            </Collapse>
          </Box>
        ))}

        <Divider sx={{ my: 1 }} />

        <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
          Conversations
        </Typography>
        <List dense disablePadding>
          {grouped.root.length ? (
            grouped.root.map((c) => (
              <ConversationItem
                key={c.id}
                c={c}
                activeId={activeId}
                onSelect={onSelect}
                onDelete={(id) => handleDeleteClick("conversation", id, c.title)}
                deletingId={deletingId}
                folders={folders}
                onMoveToFolder={onMoveToFolder}
              />
            ))
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: "block", py: 1 }}>
              No conversations yet
            </Typography>
          )}
        </List>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", flexGrow: 1, overflow: "hidden" }}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            {/* Display Google Profile Picture or Generic Letter */}
            <Avatar 
              src={profile?.picture || ""} 
              sx={{ width: 36, height: 36, bgcolor: "primary.main" }}
            >
              {profile?.name ? profile.name[0].toUpperCase() : (loggedIn ? "U" : "G")}
            </Avatar>
            
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {/* Display Real Name or Guest */}
                {profile?.name || (loggedIn ? "User" : "Guest")}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {loggedIn ? (profile?.email || "History saved") : "No history saved"}
              </Typography>
            </Box>
          </Box>
          
          <Tooltip title="Change Theme">
            <IconButton onClick={(e) => setThemeAnchorEl(e.currentTarget)}>
              {themeMode === "light" && <Brightness7Icon />}
              {themeMode === "dark" && <Brightness4Icon />}
              {themeMode === "system" && <SettingsBrightnessIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {loggedIn ? (
            <MenuItem onClick={() => { setAnchorEl(null); onLogout(); }}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          ) : (
            <MenuItem onClick={() => { setAnchorEl(null); onLogin(); }}>
              <LoginIcon fontSize="small" sx={{ mr: 1 }} /> Login / Register
            </MenuItem>
          )}
        </Menu>

        <Menu
          anchorEl={themeAnchorEl}
          open={Boolean(themeAnchorEl)}
          onClose={() => setThemeAnchorEl(null)}
        >
          <MenuItem onClick={() => { onThemeChange("light"); setThemeAnchorEl(null); }} selected={themeMode === "light"}>
            <Brightness7Icon fontSize="small" sx={{ mr: 1 }} /> Light
          </MenuItem>
          <MenuItem onClick={() => { onThemeChange("dark"); setThemeAnchorEl(null); }} selected={themeMode === "dark"}>
            <Brightness4Icon fontSize="small" sx={{ mr: 1 }} /> Dark
          </MenuItem>
          <MenuItem onClick={() => { onThemeChange("system"); setThemeAnchorEl(null); }} selected={themeMode === "system"}>
            <SettingsBrightnessIcon fontSize="small" sx={{ mr: 1 }} /> System
          </MenuItem>
        </Menu>
      </Box>

      <Dialog open={Boolean(renamingFolder)} onClose={() => setRenamingFolder(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRename();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenamingFolder(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitRename}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={Boolean(confirmDelete)} 
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ bgcolor: "error.50", color: "error.main", p: 1, borderRadius: "50%", display: "flex" }}>
            <WarningAmberIcon />
          </Box>
          <Typography variant="h6" fontWeight={600}>
            Delete {confirmDelete?.type === "folder" ? "Folder" : "Conversation"}?
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <DialogContentText color="text.secondary">
            Are you sure you want to permanently delete 
            <strong> "{confirmDelete?.title}"</strong>? 
            {confirmDelete?.type === "folder" && " All conversations inside this folder will be moved to the root."}
            <br /><br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} color="inherit" sx={{ fontWeight: 600 }}>
            Cancel
          </Button>
          <Button 
            onClick={executeDelete} 
            color="error" 
            variant="contained"
            disableElevation
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}