import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "food", label: "Food", icon: "🍕" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "stay", label: "Stay", icon: "🏨" },
  { id: "fun", label: "Fun", icon: "🎉" },
  { id: "shop", label: "Shopping", icon: "🛍️" },
  { id: "fuel", label: "Fuel", icon: "⛽" },
  { id: "bill", label: "Bills", icon: "📱" },
  { id: "other", label: "Other", icon: "💸" },
];

export default function GroupDetail({ group, API, socket, currentUser, onBack, onActivity }) {
  const [data, setData] = useState(null);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [newMember, setNewMember] = useState("");
  const [toasts, setToasts] = useState([]);
  const [expense, setExpense] = useState({
    description: "", amount: "", paid_by: "", split_among: [], category: "other"
  });

  useEffect(() => {
    fetchGroup();
    fetchBalances();
    socket.emit("join_group", group.id);

    socket.on("expense_added", (exp) => {
      setData(prev => prev ? { ...prev, expenses: [exp, ...prev.expenses] } : prev);
      fetchBalances();
      toast(`💸 ${exp.paid_by_name} added "${exp.description}" — ₹${parseFloat(exp.amount).toFixed(0)}`, "expense");
      onActivity(`${exp.paid_by_name} added expense: ${exp.description} ₹${parseFloat(exp.amount).toFixed(0)}`, "expense");
    });
    socket.on("member_added", (member) => {
      setData(prev => prev ? { ...prev, members: [...prev.members, member] } : prev);
      toast(`👤 ${member.name} joined the group`, "member");
      onActivity(`${member.name} joined ${group.name}`, "member");
    });
    socket.on("settled", () => {
      fetchBalances();
      toast("✅ A payment was settled!", "settle");
      onActivity(`Someone settled up in ${group.name}`, "settle");
    });

    return () => {
      socket.off("expense_added");
      socket.off("member_added");
      socket.off("settled");
    };
  }, [group.id]);

  function toast(msg, type = "info") {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function fetchGroup() {
    const res = await fetch(`${API}/api/groups/${group.id}`);
    const d = await res.json();
    setData(d);
    if (d.members) {
      const me = d.members.find(m => m.name === currentUser);
      if (me) setExpense(prev => ({ ...prev, paid_by: String(me.id) }));
    }
  }

  async function fetchBalances() {
    const res = await fetch(`${API}/api/groups/${group.id}/balances`);
    const b = await res.json();
    setBalances(b);
  }

  async function addMember() {
    if (!newMember.trim()) return;
    await fetch(`${API}/api/groups/${group.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMember }),
    });
    setNewMember("");
  }

  async function addExpense() {
    const { description, amount, paid_by, split_among, category } = expense;
    if (!description || !amount || !paid_by || split_among.length === 0) {
      toast("⚠️ Fill all fields and select members to split with", "warn");
      return;
    }
    await fetch(`${API}/api/groups/${group.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `${CATEGORIES.find(c => c.id === category)?.icon} ${description}`,
        amount: parseFloat(amount),
        paid_by: parseInt(paid_by),
        split_among: split_among.map(Number),
      }),
    });
    setExpense(prev => ({ ...prev, description: "", amount: "", split_among: [], category: "other" }));
  }

  async function settle(fromId, toId, amount) {
    if (!fromId || !toId) return;
    await fetch(`${API}/api/groups/${group.id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_member: fromId, to_member: toId, amount }),
    });
  }

  function toggleSplit(id) {
    setExpense(prev => ({
      ...prev,
      split_among: prev.split_among.includes(String(id))
        ? prev.split_among.filter(x => x !== String(id))
        : [...prev.split_among, String(id)]
    }));
  }

  function selectAllSplit() {
    if (!data) return;
    setExpense(prev => ({
      ...prev,
      split_among: data.members.map(m => String(m.id))
    }));
  }

  function computeSettlements() {
    const c = balances.filter(b => b.net > 0.01).map(b => ({ ...b, net: parseFloat(b.net) }));
    const d = balances.filter(b => b.net < -0.01).map(b => ({ ...b, net: parseFloat(b.net) }));
    const txns = [];
    let ci = 0, di = 0;
    while (ci < c.length && di < d.length) {
      const amt = Math.min(c[ci].net, -d[di].net);
      txns.push({ from: d[di], to: c[ci], amount: amt.toFixed(2) });
      c[ci].net -= amt; d[di].net += amt;
      if (Math.abs(c[ci].net) < 0.01) ci++;
      if (Math.abs(d[di].net) < 0.01) di++;
    }
    return txns;
  }

  if (!data) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );

  const settlements = computeSettlements();
  const totalSpent = data.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const sharePreview = expense.split_among.length > 0 && expense.amount
    ? (parseFloat(expense.amount) / expense.split_among.length).toFixed(2) : null;
  const maxNet = Math.max(...balances.map(b => Math.abs(parseFloat(b.net))), 1);
  const myBalance = balances.find(b => b.name === currentUser);

  return (
    <div className="group-detail">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-pulse" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="gd-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="gd-header-main">
          <h1 className="gd-title">{data.name}</h1>
          <div className="gd-pills">
            <span className="pill">{data.members.length} members</span>
            <span className="pill teal-pill">₹{totalSpent.toFixed(0)} total</span>
            {myBalance && (
              <span className={`pill ${parseFloat(myBalance.net) >= 0 ? "green-pill" : "red-pill"}`}>
                You {parseFloat(myBalance.net) >= 0 ? `get ₹${parseFloat(myBalance.net).toFixed(0)}` : `owe ₹${Math.abs(parseFloat(myBalance.net)).toFixed(0)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="members-section">
        <div className="members-row">
          {data.members.map((m, i) => (
            <div key={m.id} className={`member-chip ${m.name === currentUser ? "me" : ""}`}>
              <div className="member-chip-avatar">{m.name[0].toUpperCase()}</div>
              <span>{m.name === currentUser ? "You" : m.name}</span>
            </div>
          ))}
          <div className="add-member-inline">
            <input value={newMember} onChange={e => setNewMember(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMember()}
              placeholder="+ Add member" className="add-member-input" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: "expenses", label: "💸 Expenses", count: data.expenses.length },
          { id: "balances", label: "📊 Balances", count: null },
          { id: "settle", label: "✅ Settle Up", count: settlements.length || null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab ${tab === t.id ? "active" : ""}`}>
            {t.label}
            {t.count > 0 && <span className={`tab-count ${t.id === "settle" ? "red" : ""}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* EXPENSES */}
      {tab === "expenses" && (
        <div className="tab-body">
          <div className="expense-form">
            <div className="ef-row">
              <input value={expense.description}
                onChange={e => setExpense({ ...expense, description: e.target.value })}
                placeholder="What was it for?" className="ef-input" />
              <input value={expense.amount} type="number"
                onChange={e => setExpense({ ...expense, amount: e.target.value })}
                placeholder="₹ Amount" className="ef-input ef-amount" />
            </div>

            {/* Category selector */}
            <div className="category-row">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setExpense({ ...expense, category: c.id })}
                  className={`cat-btn ${expense.category === c.id ? "active" : ""}`}
                  title={c.label}>
                  {c.icon}
                </button>
              ))}
            </div>

            <select value={expense.paid_by}
              onChange={e => setExpense({ ...expense, paid_by: e.target.value })}
              className="ef-select">
              <option value="">Who paid?</option>
              {data.members.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.name === currentUser ? " (you)" : ""}</option>
              ))}
            </select>

            <div className="split-row">
              <div className="split-row-header">
                <span className="split-label-text">
                  Split among
                  {sharePreview && <span className="share-preview"> · ₹{sharePreview} each</span>}
                </span>
                <button onClick={selectAllSplit} className="select-all-btn">Select all</button>
              </div>
              <div className="split-chips">
                {data.members.map(m => (
                  <button key={m.id} onClick={() => toggleSplit(m.id)}
                    className={`split-chip ${expense.split_among.includes(String(m.id)) ? "on" : ""}`}>
                    {m.name === currentUser ? "You" : m.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={addExpense} className="add-btn">Add Expense</button>
          </div>

          <div className="expense-feed">
            {data.expenses.length === 0 && (
              <div className="feed-empty">No expenses yet. Add the first one ☝️</div>
            )}
            {data.expenses.map(e => {
              const perPerson = e.split_among ? (parseFloat(e.amount) / e.split_among.length).toFixed(2) : null;
              return (
                <div key={e.id} className="expense-row">
                  <div className="expense-row-left">
                    <div className="expense-desc">{e.description}</div>
                    <div className="expense-sub">
                      Paid by <strong className="payer">{e.paid_by_name === currentUser ? "You" : e.paid_by_name}</strong>
                      {e.split_among && (
                        <span className="split-detail">
                          {" · "}{e.split_among.length} people · ₹{perPerson} each
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="expense-amt">₹{parseFloat(e.amount).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BALANCES */}
      {tab === "balances" && (
        <div className="tab-body">
          {balances.map((b, i) => {
            const net = parseFloat(b.net);
            const pct = Math.abs(net / maxNet) * 100;
            const isMe = b.name === currentUser;
            return (
              <div key={i} className={`balance-row ${isMe ? "balance-me" : ""}`}>
                <div className="bal-left">
                  <div className={`bal-avatar ${isMe ? "me" : ""}`}>{b.name[0].toUpperCase()}</div>
                  <div className="bal-info">
                    <div className="bal-name">
                      {isMe ? "You" : b.name}
                      {isMe && <span className="you-tag">you</span>}
                    </div>
                    <div className="bal-bar-wrap">
                      <div className={`bal-bar ${net >= 0 ? "pos" : "neg"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="bal-right">
                  <div className={`bal-amount ${net >= 0 ? "green" : "red"}`}>
                    {net >= 0 ? "+" : "-"}₹{Math.abs(net).toFixed(2)}
                  </div>
                  <div className="bal-status">{net > 0 ? "gets back" : net < 0 ? "owes" : "settled"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SETTLE */}
      {tab === "settle" && (
        <div className="tab-body">
          {settlements.length === 0 ? (
            <div className="all-clear">
              <div className="all-clear-emoji">🎊</div>
              <div className="all-clear-title">All settled up!</div>
              <div className="all-clear-sub">No pending payments in this group</div>
            </div>
          ) : (
            settlements.map((s, i) => {
              const fromMember = balances.find(b => b.name === s.from.name);
              const toMember = balances.find(b => b.name === s.to.name);
              return (
                <div key={i} className="settle-row">
                  <div className="settle-flow">
                    <div className="settle-person">
                      <div className="settle-av">{s.from.name[0].toUpperCase()}</div>
                      <div className="settle-nm">{s.from.name === currentUser ? "You" : s.from.name}</div>
                    </div>
                    <div className="settle-middle">
                      <div className="settle-line" />
                      <div className="settle-badge">₹{s.amount}</div>
                      <div className="settle-arrow-icon">→</div>
                    </div>
                    <div className="settle-person">
                      <div className="settle-av">{s.to.name[0].toUpperCase()}</div>
                      <div className="settle-nm">{s.to.name === currentUser ? "You" : s.to.name}</div>
                    </div>
                  </div>
                  <button onClick={() => settle(fromMember?.id, toMember?.id, s.amount)}
                    className="settle-btn">
                    Mark Paid ✓
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}