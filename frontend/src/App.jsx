import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import GroupList from "./components/GroupList";
import GroupDetail from "./components/GroupDetail";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(API);

export default function App() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userSet, setUserSet] = useState(false);
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("splitsync_user");
    if (saved) { setUserName(saved); setUserSet(true); fetchGroups(); }
  }, []);

  async function fetchGroups() {
    const res = await fetch(`${API}/api/groups`);
    const data = await res.json();
    setGroups(data);
  }

  function handleSetUser() {
    if (!tempName.trim()) return;
    localStorage.setItem("splitsync_user", tempName.trim());
    setUserName(tempName.trim());
    setUserSet(true);
    fetchGroups();
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setLoading(true);
    await fetch(`${API}/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    });
    setNewGroupName("");
    await fetchGroups();
    setLoading(false);
  }

  if (!userSet) {
    return (
      <div className="onboard-screen">
        <div className="onboard-card">
          <div className="onboard-logo">
            <span className="logo-bolt">⚡</span>
            <span className="logo-word">SplitSync</span>
          </div>
          <p className="onboard-tagline">Split expenses. Stay friends.</p>
          <div className="onboard-form">
            <label className="onboard-label">What should we call you?</label>
            <input
              className="onboard-input"
              placeholder="Enter your name..."
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSetUser()}
              autoFocus
            />
            <button className="onboard-btn" onClick={handleSetUser}>
              Get Started →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-bolt">⚡</span>
            <span className="logo-word">SplitSync</span>
          </div>
          <div className="header-right">
            <div className="user-pill">
              <span className="user-avatar">{userName[0].toUpperCase()}</span>
              <span className="user-name">{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {!selectedGroup ? (
          <div className="home">
            <div className="home-hero">
              <h1 className="hero-title">Your Groups</h1>
              <p className="hero-sub">Track shared expenses in real-time</p>
            </div>
            <div className="create-row">
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createGroup()}
                placeholder="✦  New group name — Goa Trip, Flat, etc."
                className="create-input"
              />
              <button onClick={createGroup} disabled={loading} className="create-btn">
                {loading ? "..." : "+ Create"}
              </button>
            </div>
            <GroupList groups={groups} currentUser={userName} onSelect={setSelectedGroup} />
          </div>
        ) : (
          <GroupDetail
            group={selectedGroup}
            API={API}
            socket={socket}
            currentUser={userName}
            onBack={() => { setSelectedGroup(null); fetchGroups(); }}
          />
        )}
      </main>
    </div>
  );
}