import { useState, useEffect } from "react";

const CATEGORIES = [
  { icon: "🍕", label: "Food" },
  { icon: "🚗", label: "Travel" },
  { icon: "🏠", label: "Rent" },
  { icon: "🎮", label: "Fun" },
  { icon: "🛒", label: "Shopping" },
  { icon: "⚡", label: "Bills" },
  { icon: "🏥", label: "Health" },
  { icon: "📦", label: "Other" },
];

export default function GroupDetail({ group, API, socket, currentUser, onBack, onActivity }) {
  const [data, setData] = useState(null);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [newMember, setNewMember] = useState("");
  const [toasts, setToasts] = useState([]);
  const [expense, setExpense] = useState({
    description: "", amount: "", paid_by: "", split_among: [], category: "📦"
  });

  useEffect(() => {
    fetchGroup();
    fetchBalances();
    socket.emit("join_group", group.id);

    socket.on("expense_added", (exp) => {
      setData(prev => prev ? { ...prev, expenses: [exp, ...prev.expenses] } : prev);
      fetchBalances();
      addToast(`💸 ${exp.paid_by_name} added "${exp.description}"`, "expense");
      onActivity(`${exp.paid_by_name} added "${exp.description}" — ₹${exp.amount} in ${group.name}`, "expense");
    });
    socket.on("member_added", (member) => {
      setData(prev => prev ? { ...prev, members: [...prev.members, member] } : prev);
      addToast(`👤 ${member.name} joined`, "member");
      onActivity(`${member.name} joined "${group.name}"`, "member");
    });
    socket.on("settled", () => {
      fetchBalances();
      addToast("✅ Payment settled!", "success");
      onActivity(`A payment was settled in "${group.name}"`, "success");
    });

    return () => {
      socket.off("expense_added");
      socket.off("member_added");
      socket.off("settled");
    };
  }, [group.id]);

  function addToast(msg, type = "info") {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function fetchGroup() {
    const res = await fetch(`${API}/api/groups/${group.id}`);
    setData(await res.json());
  }

  async function fetchBalances() {
    const res = await fetch(`${API}/api/groups/${group.id}/balances`);
    setBalances(await res.json());
  }

  async function addMember() {
    if (!newMember.trim()) return;
    await fetch(`${API}/api/groups/${group.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMember }),
    });
    setNewMember("");
    fetchGroup();
  }

  async function addExpense() {
    const { description, amount, paid_by, split_among, category } = expense;
    if (!description || !amount || !paid_by || split_among.length === 0) {
      addToast("⚠️ Fill all fields and select members to split with", "warn");
      return;
    }
    await fetch(`${API}/api/groups/${group.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `${category} ${description}`,
        amount: parseFloat(amount),
        paid_by: parseInt(paid_by),
        split_among: split_among.map(Number),
      }),
    });
    setExpense({ description: "", amount: "", paid_by: "", split_among: [], category: "📦" });
  }

  async function settle(fromId, toId, amount) {
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
        : [...prev.split_among, String(id)],
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

  if (!data) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;

  const totalSpent = data.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const sharePreview = expense.split_among.length > 0 && expense.amount
    ? (parseFloat(expense.amount) / expense.split_among.length).toFixed(2) : null;
  const settlements = computeSettlements();
  const maxNet = Math.max(...balances.map(b => Math.abs(parseFloat(b.net))), 1);

  // My balance
  const myBalance = balances.find(b => b.name === currentUser);
  const myNet = myBalance ? parseFloat(myBalance.net) : 0;

  return (
    <div className="group-detail">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-pulse" />
            {t.msg}
          </div>
        ))}
      </div>

      {/* Group header */}
      <div className="detail-top">
        <div className="detail-title-row">
          <h1 className="detail-title">{data.name}</h1>
          <div className="detail-stats">
            <div className="stat-box">
              <div className="stat-value">₹{totalSpent.toFixed(0)}</div>
              <div className="stat-label">Total spent</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{data.members.length}</div>
              <div className="stat-label">Members</div>
            </div>
            <div className="stat-box">
              <div className={`stat-value ${myNet >= 0 ? "stat-green" : "stat-red"}`}>
                {myNet >= 0 ? "+" : ""}₹{Math.abs(myNet).toFixed(0)}
              </div>
              <div className="stat-label">Your balance</div>
            </div>
          </div>
        </div>

        {/* Members row */}
        <div className="members-row">
          <div className="members-avatars-row">
            {data.members.map((m, i) => (
              <div key={m.id}
                className={`member-circle ${m.name === currentUser ? "member-you" : ""}`}
                style={{ zIndex: data.members.length - i }}
                title={m.name + (m.name === currentUser ? " (you)" : "")}>
                {m.name[0].toUpperCase()}
              </div>
            ))}
            <div className="members-names">
              {data.members.map(m => m.name === currentUser ? "You" : m.name).join(", ")}
            </div>
          </div>
          <div className="add-member-inline">
            <input
              value={newMember}
              onChange={e => setNewMember(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMember()}
              placeholder="+ Add member"
              className="member-inline-input"
            />
            {newMember && (
              <button onClick={addMember} className="member-inline-btn">Add</button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-row">
        {[
          { id: "expenses", label: "💸 Expenses", count: data.expenses.length },
          { id: "balances", label: "📊 Balances" },
          { id: "settle", label: "✅ Settle Up", count: settlements.length, alert: settlements.length > 0 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? "tab-active" : ""}`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`tab-count ${t.alert ? "tab-count-alert" : ""}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* EXPENSES */}
      {tab === "expenses" && (
        <div className="tab-pane">
          <div className="expense-form-card">
            <div className="form-section-label">Add Expense</div>

            {/* Category picker */}
            <div className="category-row">
              {CATEGORIES.map(c => (
                <button key={c.label}
                  onClick={() => setExpense(p => ({ ...p, category: c.icon }))}
                  className={`cat-btn ${expense.category === c.icon ? "cat-active" : ""}`}
                  title={c.label}>
                  {c.icon}
                </button>
              ))}
            </div>

            <div className="form-grid">
              <input
                className="form-inp"
                placeholder="What was it for?"
                value={expense.description}
                onChange={e => setExpense(p => ({ ...p, description: e.target.value }))}
              />
              <input
                className="form-inp form-amount"
                placeholder="₹ Amount"
                type="number"
                value={expense.amount}
                onChange={e => setExpense(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <select
              className="form-inp form-select"
              value={expense.paid_by}
              onChange={e => setExpense(p => ({ ...p, paid_by: e.target.value }))}>
              <option value="">Who paid?</option>
              {data.members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name === currentUser ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </select>

            <div className="split-row">
              <div className="split-label-row">
                <span className="split-label-text">Split among</span>
                {sharePreview && (
                  <span className="split-preview-badge">₹{sharePreview} each</span>
                )}
              </div>
              <div className="split-chips-row">
                {data.members.map(m => (
                  <button key={m.id}
                    onClick={() => toggleSplit(m.id)}
                    className={`split-chip ${expense.split_among.includes(String(m.id)) ? "split-chip-on" : ""}`}>
                    {m.name === currentUser ? "You" : m.name}
                  </button>
                ))}
                <button
                  className="split-all-btn"
                  onClick={() => setExpense(p => ({
                    ...p,
                    split_among: data.members.map(m => String(m.id))
                  }))}>
                  All
                </button>
              </div>
            </div>

            <button onClick={addExpense} className="add-btn">Add Expense</button>
          </div>

          {/* Expense cards */}
          <div className="expense-cards">
            {data.expenses.length === 0 && (
              <div className="empty-tab">No expenses yet. Add one above ☝️</div>
            )}
            {data.expenses.map(e => {
              const perPerson = e.split_among
                ? (parseFloat(e.amount) / e.split_among.length).toFixed(2) : null;
              return (
                <div key={e.id} className="expense-row">
                  <div className="expense-emoji-col">
                    {e.description.match(/^\p{Emoji}/u)?.[0] || "💳"}
                  </div>
                  <div className="expense-main">
                    <div className="expense-title">
                      {e.description.replace(/^\p{Emoji}\s*/u, "")}
                    </div>
                    <div className="expense-sub">
                      <span className="paid-name">{e.paid_by_name === currentUser ? "You" : e.paid_by_name} paid</span>
                      {perPerson && e.split_among && (
                        <span className="expense-split-detail">
                          · Split {e.split_among.length} ways · <strong>₹{perPerson}</strong> each
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
        <div className="tab-pane">
          {balances.map((b, i) => {
            const net = parseFloat(b.net);
            const isPos = net >= 0;
            const pct = Math.abs(net / maxNet) * 100;
            const isMe = b.name === currentUser;
            return (
              <div key={i} className={`balance-row-card ${isMe ? "balance-me" : ""}`}>
                <div className="bal-avatar" style={{ background: isMe ? "var(--teal-dim)" : "var(--surface3)" }}>
                  <span style={{ color: isMe ? "var(--teal)" : "var(--teal2)" }}>
                    {b.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="bal-info">
                  <div className="bal-name">
                    {isMe ? "You" : b.name}
                    {isMe && <span className="you-pill">you</span>}
                  </div>
                  <div className="bal-bar-track">
                    <div
                      className={`bal-bar ${isPos ? "bar-pos" : "bar-neg"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className={`bal-amount ${isPos ? "bal-pos" : "bal-neg"}`}>
                  {isPos ? "+" : "−"}₹{Math.abs(net).toFixed(2)}
                  <div className="bal-status">{isPos ? "to receive" : "to pay"}</div>
                </div>
              </div>
            );
          })}
          {balances.length === 0 && <div className="empty-tab">Add expenses to see balances</div>}
        </div>
      )}

      {/* SETTLE UP */}
      {tab === "settle" && (
        <div className="tab-pane">
          {settlements.length === 0 ? (
            <div className="all-good">
              <div className="all-good-icon">🎊</div>
              <div className="all-good-title">All clear!</div>
              <div className="all-good-sub">Everyone's settled up in this group</div>
            </div>
          ) : (
            settlements.map((s, i) => (
              <div key={i} className="settle-card-v2">
                <div className="settle-flow">
                  <div className="settle-person">
                    <div className="settle-av">{s.from.name[0]}</div>
                    <div className="settle-pname">{s.from.name === currentUser ? "You" : s.from.name}</div>
                  </div>
                  <div className="settle-mid">
                    <div className="settle-line" />
                    <div className="settle-amt-pill">₹{s.amount}</div>
                    <div className="settle-arrow-icon">→</div>
                  </div>
                  <div className="settle-person">
                    <div className="settle-av">{s.to.name[0]}</div>
                    <div className="settle-pname">{s.to.name === currentUser ? "You" : s.to.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => settle(
                    balances.find(b => b.name === s.from.name)?.id,
                    balances.find(b => b.name === s.to.name)?.id,
                    s.amount
                  )}
                  className="settle-pay-btn">
                  Mark as Paid ✓
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}