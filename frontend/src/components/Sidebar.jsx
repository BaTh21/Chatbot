import React, { useState } from "react";
import {
  Box, Typography, Button, List, ListItemButton, ListItemText,
  IconButton, Divider, Avatar, Menu, MenuItem, CircularProgress,
  Collapse, TextField, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

function ConversationItem({ c, activeId, onSelect, onDelete, deletingId, folders, onMoveToFolder }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  return (
    <ListItemButton
      selected={c.id === activeId}
      onClick={() => onSelect(c.id)}
      sx={{ mx: 1, borderRadius: 1, mb: 0.5, "&.Mui-selected": { bgcolor: "primary.50" } }}
    >
      <ChatBubbleOutlineOutlined fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
      <ListItemText
        primary={c.title || "New conversation"}
        slotProps={{ primary: { variant: "body2", noWrap: true } }}
      />
      <Tooltip title="Move to folder">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
          sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
        >
          <FolderOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <IconButton
        size="small"
        disabled={deletingId === c.id}
        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
        sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
      >
        {deletingId === c.id ? <CircularProgress size={14} /> : <DeleteOutlineOutlined fontSize="small" />}
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
  onCreateFolder, onDeleteFolder, onMoveToFolder,
  loggedIn, onLogin, onLogout,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (!window.confirm("Delete this conversation permanently?")) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const submitFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    await onCreateFolder(name);
    setFolderName("");
    setCreatingFolder(false);
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
        width: 280, bgcolor: "grey.50", borderRight: "1px solid",
        borderColor: "divider", display: "flex", flexDirection: "column", height: "100vh",
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
                cursor: "pointer", "&:hover": { bgcolor: "grey.100" },
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
                  if (window.confirm(`Delete folder "${f.name}"? Conversations will move to root.`)) {
                    onDeleteFolder(f.id);
                  }
                }}
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
                      onDelete={handleDelete}
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
                onDelete={handleDelete}
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
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: loggedIn ? "primary.main" : "grey.400" }}>
            {loggedIn ? "U" : "G"}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {loggedIn ? "User" : "Guest"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {loggedIn ? "History saved" : "No history saved"}
            </Typography>
          </Box>
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
      </Box>
    </Box>
  );
}