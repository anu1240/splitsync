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

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    const res = await fetch(`${API}/api/groups`);
    const data = await res.json();
    setGroups(data);
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">SplitSync</span>
          </div>
          <span className="header-sub">Real-Time Expense Splitter</span>
        </div>
      </header>

      <main className="main">
        {!selectedGroup ? (
          <div className="home">
            <div className="create-card">
              <h2>Create a Group</h2>
              <div className="input-row">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGroup()}
                  placeholder="e.g. Goa Trip, Flat Expenses..."
                  className="input"
                />
                <button onClick={createGroup} disabled={loading} className="btn-primary">
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>

            <GroupList
              groups={groups}
              onSelect={(g) => setSelectedGroup(g)}
            />
          </div>
        ) : (
          <GroupDetail
            group={selectedGroup}
            API={API}
            socket={socket}
            onBack={() => { setSelectedGroup(null); fetchGroups(); }}
          />
        )}
      </main>
    </div>
  );
}
