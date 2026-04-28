import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Landing from "./components/Landing";
import GroupList from "./components/GroupList";
import GroupDetail from "./components/GroupDetail";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(API);

export default function App() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [userName, setUserName] = useState("");
  const [userSet, setUserSet] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("splitsync_user");
    if (saved) { setUserName(saved); setUserSet(true); fetchGroups(); }
  }, []);

  async function fetchGroups() {
    const res = await fetch(`${API}/api/groups`);
    const data = await res.json();
    setGroups(data);
  }

  function handleSetUser(name) {
    localStorage.setItem("splitsync_user", name);
    setUserName(name);
    setUserSet(true);
    fetchGroups();
  }

  function handleLogout() {
    localStorage.removeItem("splitsync_user");
    setUserName("");
    setUserSet(false);
    setSelectedGroup(null);
    setGroups([]);
    setActivity([]);
  }

  function addActivity(msg, type = "info") {
    const id = Date.now();
    setActivity(prev => [{ id, msg, type, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }, ...prev].slice(0, 20));
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setLoading(true);
    await fetch(`${API}/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    });
    addActivity(`Group "${newGroupName}" created`, "success");
    setNewGroupName("");
    setShowCreate(false);
    await fetchGroups();
    setLoading(false);
  }

  async function deleteGroup(e, groupId, groupName) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${groupName}"? This cannot be undone.`)) return;
    await fetch(`${API}/api/groups/${groupId}`, { method: "DELETE" });
    addActivity(`Group "${groupName}" deleted`, "warn");
    fetchGroups();
  }

  async function renameGroup(e, groupId, currentName) {
    e.stopPropagation();
    const newName = window.prompt("Rename group:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      await fetch(`${API}/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      addActivity(`Group renamed to "${newName.trim()}"`, "success");
      fetchGroups();
    }
  }

  if (!userSet) return <Landing onEnter={handleSetUser} />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo" onClick={() => setSelectedGroup(null)} style={{ cursor: "pointer" }}>
            <span className="logo-bolt">⚡</span>
            <span className="logo-word">SplitSync</span>
          </div>
          <div className="header-center">
            {selectedGroup && (
              <div className="breadcrumb">
                <span className="breadcrumb-home" onClick={() => setSelectedGroup(null)}>Groups</span>
                <span className="breadcrumb-sep">›</span>
                <span className="breadcrumb-current">{selectedGroup.name}</span>
              </div>
            )}
          </div>
          <div className="header-right">
            <div className="user-pill">
              <div className="user-avatar-sm">{userName[0].toUpperCase()}</div>
              <span className="user-name-sm">{userName}</span>
              <button className="logout-btn" onClick={handleLogout} title="Switch user">⏻</button>
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">
        <main className="main">
          {!selectedGroup ? (
            <div className="home">
              <div className="home-top">
                <div>
                  <h1 className="home-title">
                    {getGreeting()}, <span className="name-highlight">{userName}</span> 👋
                  </h1>
                  <p className="home-sub">
                    You have <strong>{groups.length}</strong> group{groups.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button className="create-group-btn" onClick={() => setShowCreate(true)}>
                  + New Group
                </button>
              </div>

              {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <div className="modal-title">Create a new group</div>
                      <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                    </div>
                    <p className="modal-hint">Give your group a memorable name</p>
                    <input
                      className="modal-input"
                      placeholder="e.g. Goa Trip, Flat, Office Lunch..."
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && createGroup()}
                      autoFocus
                    />
                    <div className="modal-suggestions">
                      {["🏖️ Goa Trip", "🏠 Flat", "✈️ Europe", "🍕 Lunch Gang"].map(s => (
                        <button key={s} className="suggestion-chip"
                          onClick={() => setNewGroupName(s.split(" ").slice(1).join(" "))}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="modal-actions">
                      <button className="modal-cancel" onClick={() => setShowCreate(false)}>Cancel</button>
                      <button className="modal-confirm" onClick={createGroup} disabled={loading}>
                        {loading ? "Creating..." : "Create Group →"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <GroupList
                groups={groups}
                currentUser={userName}
                onSelect={setSelectedGroup}
                onDelete={deleteGroup}
                onRename={renameGroup}
              />
            </div>
          ) : (
            <GroupDetail
              group={selectedGroup}
              API={API}
              socket={socket}
              currentUser={userName}
              onBack={() => { setSelectedGroup(null); fetchGroups(); }}
              onActivity={addActivity}
            />
          )}
        </main>

        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="live-indicator">
              <span className="live-dot-sm" />
              Live Feed
            </span>
          </div>
          {activity.length === 0 ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">📡</div>
              <div>Activity will appear here in real-time</div>
            </div>
          ) : (
            <div className="activity-list">
              {activity.map(a => (
                <div key={a.id} className={`activity-item activity-${a.type}`}>
                  <div className="activity-icon">
                    {a.type === "success" ? "✓" : a.type === "expense" ? "₹" : a.type === "member" ? "👤" : a.type === "warn" ? "!" : "•"}
                  </div>
                  <div className="activity-body">
                    <div className="activity-msg">{a.msg}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}