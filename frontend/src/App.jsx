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

  function handleChangeName() {
    const newName = prompt("Change your name:", userName);
    if (newName && newName.trim()) {
      localStorage.setItem("splitsync_user", newName.trim());
      setUserName(newName.trim());
    }
  }

  async function deleteGroup(e, groupId) {
    e.stopPropagation();
    if (!confirm("Delete this group? This cannot be undone.")) return;
    await fetch(`${API}/api/groups/${groupId}`, { method: "DELETE" });
    addActivity("Group deleted", "warn");
    fetchGroups();
  }

  async function renameGroup(e, groupId, currentName) {
    e.stopPropagation();
    const newName = prompt("Rename group:", currentName);
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

  function addActivity(msg, type = "info") {
    const item = { id: Date.now(), msg, type, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
    setActivity(prev => [item, ...prev].slice(0, 20));
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

  if (!userSet) return <Landing onStart={handleSetUser} />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo" onClick={() => setSelectedGroup(null)} style={{ cursor: "pointer" }}>
            <div className="logo-mark">S</div>
            <div className="logo-text-wrap">
              <span className="logo-word">SplitSync</span>
              <span className="logo-tagline">expense tracker</span>
            </div>
          </div>
          <div className="header-center">
            {selectedGroup && (
              <div className="breadcrumb">
                <span onClick={() => setSelectedGroup(null)} className="breadcrumb-home">Home</span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{selectedGroup.name}</span>
              </div>
            )}
          </div>
          <div className="header-right">
            <div className="user-pill" onClick={handleChangeName} title="Click to change name" style={{cursor:"pointer"}}>
              <div className="user-avatar-sm">{userName[0].toUpperCase()}</div>
              <span className="user-name-sm">{userName}</span>
              <span style={{color:"var(--muted)", fontSize:"0.75rem"}}>✎</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {!selectedGroup ? (
          <div className="home">
            <div className="home-layout">
              <div className="home-left">
                <div className="home-greeting">
                  <span className="greeting-wave">👋</span>
                  <div>
                    <h1 className="home-title">Hey, {userName}</h1>
                    <p className="home-sub">Here are your expense groups</p>
                  </div>
                </div>

                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-value">{groups.length}</div>
                    <div className="stat-label">Groups</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value accent">Active</div>
                    <div className="stat-label">Status</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{activity.length}</div>
                    <div className="stat-label">Activities</div>
                  </div>
                </div>

                {showCreate ? (
                  <div className="create-card">
                    <div className="create-card-title">New Group</div>
                    <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && createGroup()}
                      placeholder="e.g. Goa Trip, Flat Expenses..." className="create-input" autoFocus />
                    <div className="create-actions">
                      <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                      <button onClick={createGroup} disabled={loading} className="btn-teal">
                        {loading ? "Creating..." : "Create Group →"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="new-group-btn" onClick={() => setShowCreate(true)}>
                    <span className="new-group-plus">+</span>
                    <span>New Group</span>
                  </button>
                )}

                <GroupList groups={groups} currentUser={userName} onSelect={setSelectedGroup} onDelete={deleteGroup} onRename={renameGroup} />
              </div>

              <div className="home-right">
                <div className="activity-panel">
                  <div className="activity-header">
                    <span className="activity-title">Live Activity</span>
                    <span className="live-badge"><span className="live-dot-sm" />LIVE</span>
                  </div>
                  {activity.length === 0 ? (
                    <div className="activity-empty">
                      <div className="activity-empty-icon">📡</div>
                      <p>Activity will appear here in real-time</p>
                    </div>
                  ) : (
                    <div className="activity-list">
                      {activity.map(a => (
                        <div key={a.id} className={`activity-item type-${a.type}`}>
                          <div className="activity-dot" />
                          <div className="activity-content">
                            <div className="activity-msg">{a.msg}</div>
                            <div className="activity-time">{a.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
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
    </div>
  );
}