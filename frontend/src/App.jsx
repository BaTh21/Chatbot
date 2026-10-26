import React, { useEffect, useRef, useState, useMemo } from "react";
import { 
  Box, Snackbar, Alert, ThemeProvider, CssBaseline, Drawer, useMediaQuery 
} from "@mui/material";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import AuthDialog from "./components/AuthDialog";
import { getTheme } from "./theme";
import {
  fetchHistory, fetchFolders, fetchAttachments,
  createFolder, deleteFolder, renameFolder,
  isLoggedIn, logout, sendChatMessage, deleteConversation,
  moveConversation, uploadAttachment, deleteMessage, updateMessage,
} from "./api";

function makeId() { return crypto.randomUUID(); }
function nowTime() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export default function App() {
  // --- THEME STATE ---
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("themeMode") || "system");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const activeMode = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
  const theme = useMemo(() => getTheme(activeMode), [activeMode]);

  const handleThemeChange = (newMode) => {
    setThemeMode(newMode);
    localStorage.setItem("themeMode", newMode);
  };

  // --- RESPONSIVE STATE ---
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Auto-toggle sidebar when screen size changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  // --- APP STATE ---
  const [conversations, setConversations] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [folderByConv, setFolderByConv] = useState({});
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortRef = useRef(null);

  // --- LOAD DATA ---
  useEffect(() => {
    const load = async () => {
      if (!isLoggedIn()) {
        try {
          const raw = localStorage.getItem("chatbot_conversations");
          if (raw) {
            const parsed = JSON.parse(raw);
            setConversations(parsed.conversations || []);
            setMessagesByConv(parsed.messages || {});
            setFolders(parsed.folders || []);
            setFolderByConv(parsed.folderByConv || {});
            if (parsed.conversations?.length) setActiveId(parsed.conversations[0].id);
          }
        } catch {}
        return;
      }

      try {
        const [rows, folderRows] = await Promise.all([fetchHistory(), fetchFolders()]);
        setFolders(folderRows);

        if (!rows.length) {
          setConversations([]);
          setMessagesByConv({});
          setFolderByConv({});
          setActiveId(null);
          return;
        }

        const groups = {};
        const folderMap = {};
        rows.forEach((r) => {
          const cid = r.conversation_id;
          if (!groups[cid]) groups[cid] = [];
          groups[cid].push(r);
          folderMap[cid] = r.folder_id ?? null;
        });

        const convs = [];
        const msgs = {};
        Object.entries(groups).forEach(([cid, items]) => {
          convs.push({ id: cid, title: items[0].user_message.slice(0, 40) || "Image/File" });
          const arr = [];
          items.forEach((r) => {
            arr.push({ role: "user", content: r.user_message, time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), id: r.id });
            arr.push({ role: "assistant", content: r.bot_reply, time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), id: r.id });
          });
          msgs[cid] = arr;
        });

        const attachmentsByConv = {};
        await Promise.all(convs.map(async (c) => {
          try { attachmentsByConv[c.id] = await fetchAttachments(c.id); } catch { attachmentsByConv[c.id] = []; }
        }));

        Object.keys(msgs).forEach((cid) => {
          const atts = attachmentsByConv[cid] || [];
          if (!atts.length) return;
          const arr = msgs[cid];
          atts.forEach(att => {
            const msgIdx = arr.findIndex(m => m.role === "user" && m.id === att.message_id);
            if (msgIdx !== -1) {
              if (!arr[msgIdx].attachments) arr[msgIdx].attachments = [];
              arr[msgIdx].attachments.push(att);
            }
          });
        });

        convs.sort((a, b) => (a.id < b.id ? 1 : -1));
        setConversations(convs);
        setMessagesByConv(msgs);
        setFolderByConv(folderMap);
        setActiveId(convs[0]?.id ?? null);
      } catch (err) {
        if (err.status === 401) { logout(); setLoggedIn(false); }
      }
    };
    load();
  }, [loggedIn]);

  // --- PERSIST GUEST DATA ---
  useEffect(() => {
    if (loggedIn) return;
    localStorage.setItem("chatbot_conversations", JSON.stringify({ conversations, messages: messagesByConv, folders, folderByConv }));
  }, [conversations, messagesByConv, folders, folderByConv, loggedIn]);

  // --- HANDLERS ---
  const newChat = (folderId = null) => {
    const id = makeId();
    setConversations((prev) => [{ id, title: "New conversation" }, ...prev]);
    setMessagesByConv((prev) => ({ ...prev, [id]: [] }));
    if (folderId != null) setFolderByConv((prev) => ({ ...prev, [id]: folderId }));
    setActiveId(id);
    if (isMobile) setSidebarOpen(false); // Auto-close sidebar on mobile
  };

  const handleCreateFolder = async (name) => {
    if (!loggedIn) {
      const id = Date.now();
      setFolders((prev) => [...prev, { id, name, created_at: new Date().toISOString() }]);
      return;
    }
    try {
      const f = await createFolder(name);
      setFolders((prev) => [...prev, f]);
    } catch (err) { setError(err.message); }
  };

  const handleRenameFolder = async (folderId, newName) => {
    if (loggedIn) {
      try {
        const updated = await renameFolder(folderId, newName);
        setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f)));
      } catch (err) { setError(err.message); }
    } else {
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)));
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (loggedIn) {
      try { await deleteFolder(folderId); } catch (err) { setError(err.message); return; }
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setFolderByConv((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((k) => { if (copy[k] === folderId) copy[k] = null; });
      return copy;
    });
  };

  const handleMoveToFolder = async (convId, folderId) => {
    if (loggedIn) {
      try { await moveConversation(convId, folderId); } catch (err) { setError(err.message); return; }
    }
    setFolderByConv((prev) => ({ ...prev, [convId]: folderId }));
  };

  const deleteChat = async (id) => {
    if (loggedIn) {
      try { await deleteConversation(id); } catch (err) { setError(err.message); return; }
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesByConv((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    setFolderByConv((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    if (activeId === id) setActiveId(null);
  };

  const handleDeleteMessage = async (messageId) => {
    if (loggedIn) {
      try { await deleteMessage(messageId); } catch (err) { setError(err.message); return; }
    }
    setMessagesByConv((prev) => {
      const newMsgs = { ...prev };
      Object.keys(newMsgs).forEach((cid) => { newMsgs[cid] = newMsgs[cid].filter((m) => m.id !== messageId); });
      return newMsgs;
    });
  };

  const handleEditMessage = async (messageId, newText) => {
    const convId = activeId;
    if (!convId) return;

    setLoading(true);
    try {
      const data = await updateMessage(messageId, newText);
      setMessagesByConv((prev) => {
        const arr = [...(prev[convId] || [])];
        const idx = arr.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          arr[idx] = { ...arr[idx], content: data.user_message };
          if (idx + 1 < arr.length && arr[idx + 1].role === "assistant") {
            arr[idx + 1] = { ...arr[idx + 1], content: data.bot_reply, time: nowTime() };
          } else {
            arr.splice(idx + 1, 0, { role: "assistant", content: data.bot_reply, time: nowTime(), id: data.id });
          }
        }
        return { ...prev, [convId]: arr };
      });
    } catch (err) {
      setError(err.message || "Failed to edit message");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFiles = (files) => {
    const allowed = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (allowed.length < files.length) setError("Some files exceed 10 MB and were skipped");
    setPendingFiles((prev) => [...prev, ...allowed]);
  };

  const handleRemoveFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (text) => {
    let convId = activeId;
    if (!convId) {
      convId = makeId();
      setConversations((prev) => [{ id: convId, title: text.slice(0, 40) || "New conversation" }, ...prev]);
      setMessagesByConv((prev) => ({ ...prev, [convId]: [] }));
      setActiveId(convId);
    }

    const folderId = folderByConv[convId] ?? null;
    let uploaded = [];
    if (loggedIn && pendingFiles.length > 0) {
      setIsUploading(true);
      try {
        for (const f of pendingFiles) {
          const att = await uploadAttachment(f, convId);
          uploaded.push(att);
        }
      } catch (err) {
        setError(err.message || "Upload failed");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const tempId = makeId();
    const userMsg = { role: "user", content: text, time: nowTime(), attachments: uploaded, id: tempId };
    setMessagesByConv((prev) => ({ ...prev, [convId]: [...(prev[convId] || []), userMsg] }));
    setPendingFiles([]);
    setConversations((prev) => prev.map((c) => c.id === convId && c.title === "New conversation" ? { ...c, title: text.slice(0, 40) || "New conversation" } : c));

    if (!text.trim()) return;

    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const data = await sendChatMessage(text, convId, convId, folderId);
      setMessagesByConv((prev) => {
        const arr = [...(prev[convId] || [])];
        const tempIdx = arr.findIndex(m => m.id === tempId);
        if (tempIdx !== -1) arr[tempIdx] = { ...arr[tempIdx], id: data.id };
        arr.push({ role: "assistant", content: data.reply, time: nowTime(), id: data.id });
        return { ...prev, [convId]: arr };
      });
    } catch (err) {
      if (err.status === 401) { logout(); setLoggedIn(false); }
      setError(err.message || "Request failed");
      setMessagesByConv((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), { role: "assistant", content: `Error: ${err.message}`, time: nowTime() }],
      }));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const activeMessages = activeId ? messagesByConv[activeId] || [] : [];
  const activeConv = conversations.find((c) => c.id === activeId);

  // --- RENDER ---
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default", overflow: "hidden" }}>
        
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Box
            sx={{
              width: sidebarOpen ? 280 : 0,
              flexShrink: 0,
              transition: "width 0.3s ease",
              overflow: "hidden",
              borderRight: sidebarOpen ? "1px solid" : "none",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Sidebar
              conversations={conversations}
              folders={folders}
              folderByConv={folderByConv}
              activeId={activeId}
              onSelect={(id) => { setActiveId(id); }}
              onNew={newChat}
              onDelete={deleteChat}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveToFolder={handleMoveToFolder}
              loggedIn={loggedIn}
              onLogin={() => setAuthOpen(true)}
              onLogout={() => { logout(); setLoggedIn(false); }}
              themeMode={themeMode}
              onThemeChange={handleThemeChange}
            />
          </Box>
        )}

        {/* Mobile Sidebar (Drawer) */}
        {isMobile && (
          <Drawer
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            ModalProps={{ keepMounted: true }} // Better open performance on mobile
            sx={{ "& .MuiDrawer-paper": { width: 280, boxSizing: "border-box" } }}
          >
            <Sidebar
              conversations={conversations}
              folders={folders}
              folderByConv={folderByConv}
              activeId={activeId}
              onSelect={(id) => { setActiveId(id); setSidebarOpen(false); }} // Close on select
              onNew={newChat}
              onDelete={deleteChat}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveToFolder={handleMoveToFolder}
              loggedIn={loggedIn}
              onLogin={() => setAuthOpen(true)}
              onLogout={() => { logout(); setLoggedIn(false); }}
              themeMode={themeMode}
              onThemeChange={handleThemeChange}
            />
          </Drawer>
        )}

        {/* Chat Area */}
        <ChatArea
          messages={activeMessages}
          loading={loading}
          onSend={sendMessage}
          onStop={stop}
          headerTitle={activeConv?.title}
          isGuest={!loggedIn}
          pendingFiles={pendingFiles}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
          isUploading={isUploading}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          isMobile={isMobile}
        />

        <AuthDialog 
          open={authOpen} 
          onClose={() => setAuthOpen(false)} 
          onSuccess={() => setLoggedIn(true)} 
        />

        <Snackbar 
          open={Boolean(error)} 
          autoHideDuration={4000} 
          onClose={() => setError("")} 
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}