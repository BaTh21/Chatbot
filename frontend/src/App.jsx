import React, { useEffect, useRef, useState } from "react";
import { Box, Snackbar, Alert } from "@mui/material";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import AuthDialog from "./components/AuthDialog";
import {
  fetchHistory,
  fetchFolders,
  createFolder,
  deleteFolder,
  isLoggedIn,
  logout,
  sendChatMessage,
  deleteConversation,
  moveConversation,
} from "./api";

function makeId() {
  return crypto.randomUUID();
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [folderByConv, setFolderByConv] = useState({});
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      // Guest path: never call backend, so no 401
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

      // Logged-in path: fetch from backend
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
          convs.push({ id: cid, title: items[0].user_message.slice(0, 40) });
          const arr = [];
          items.forEach((r) => {
            arr.push({
              role: "user",
              content: r.user_message,
              time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
            arr.push({
              role: "assistant",
              content: r.bot_reply,
              time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
          });
          msgs[cid] = arr;
        });

        convs.sort((a, b) => (a.id < b.id ? 1 : -1));
        setConversations(convs);
        setMessagesByConv(msgs);
        setFolderByConv(folderMap);
        setActiveId(convs[0]?.id ?? null);
      } catch (err) {
        if (err.status === 401) {
          logout();
          setLoggedIn(false);
        }
      }
    };
    load();
  }, [loggedIn]);

  useEffect(() => {
    if (loggedIn) return;
    localStorage.setItem(
      "chatbot_conversations",
      JSON.stringify({ conversations, messages: messagesByConv, folders, folderByConv })
    );
  }, [conversations, messagesByConv, folders, folderByConv, loggedIn]);

  const newChat = (folderId = null) => {
    const id = makeId();
    setConversations((prev) => [{ id, title: "New conversation" }, ...prev]);
    setMessagesByConv((prev) => ({ ...prev, [id]: [] }));
    if (folderId != null) setFolderByConv((prev) => ({ ...prev, [id]: folderId }));
    setActiveId(id);
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
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (loggedIn) {
      try {
        await deleteFolder(folderId);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setFolderByConv((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((k) => {
        if (copy[k] === folderId) copy[k] = null;
      });
      return copy;
    });
  };

  const handleMoveToFolder = async (convId, folderId) => {
    if (loggedIn) {
      try {
        await moveConversation(convId, folderId);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setFolderByConv((prev) => ({ ...prev, [convId]: folderId }));
  };

  const deleteChat = async (id) => {
    if (loggedIn) {
      try {
        await deleteConversation(id);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesByConv((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setFolderByConv((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeId === id) setActiveId(null);
  };

  const sendMessage = async (text) => {
    let convId = activeId;
    if (!convId) {
      convId = makeId();
      setConversations((prev) => [{ id: convId, title: text.slice(0, 40) }, ...prev]);
      setMessagesByConv((prev) => ({ ...prev, [convId]: [] }));
      setActiveId(convId);
    }

    const folderId = folderByConv[convId] ?? null;
    const userMsg = { role: "user", content: text, time: nowTime() };
    setMessagesByConv((prev) => ({ ...prev, [convId]: [...(prev[convId] || []), userMsg] }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId && c.title === "New conversation" ? { ...c, title: text.slice(0, 40) } : c
      )
    );

    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const data = await sendChatMessage(text, convId, convId, folderId);
      setMessagesByConv((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), { role: "assistant", content: data.reply, time: nowTime() }],
      }));
    } catch (err) {
      if (err.status === 401) {
        logout();
        setLoggedIn(false);
      }
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

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      <Sidebar
        conversations={conversations}
        folders={folders}
        folderByConv={folderByConv}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newChat}
        onDelete={deleteChat}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveToFolder={handleMoveToFolder}
        loggedIn={loggedIn}
        onLogin={() => setAuthOpen(true)}
        onLogout={() => {
          logout();
          setLoggedIn(false);
        }}
      />

      <ChatArea
        messages={activeMessages}
        loading={loading}
        onSend={sendMessage}
        onStop={stop}
        headerTitle={activeConv?.title}
        isGuest={!loggedIn}
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
  );
}