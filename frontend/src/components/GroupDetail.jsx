import { useState, useEffect } from "react";

export default function GroupDetail({ group, API, socket, currentUser, onBack }) {
  const [data, setData] = useState(null);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [newMember, setNewMember] = useState("");
  const [expense, setExpense] = useState({ description: "", amount: "", paid_by: "", split_among: [] });
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    fetchGroup();
    fetchBalances();
    socket.emit("join_group", group.id);

    socket.on("expense_added", (exp) => {
      setData(prev => prev ? { ...prev, expenses: [exp, ...prev.expenses] } : prev);
      fetchBalances();
      addToast(`💸 ${exp.paid_by_name} added "${exp.description}" — ₹${exp.amount}`);
    });
    socket.on("member_added", (member) => {
      setData(prev => prev ? { ...prev, members: [...prev.members, member] } : prev);
      addToast(`👤 ${member.name} joined the group`);
    });
    socket.on("settled", () => {
      fetchBalances();
      addToast("✅ A payment was settled!");
    });

    return () => {
      socket.off("expense_added");
      socket.off("member_added");
      socket.off("settled");
    };
  }, [group.id]);

  function addToast(msg) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function fetchGroup() {
    const res = await fetch(`${API}/api/groups/${group.id}`);
    const d = await res.json();
    setData(d);
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
    fetchGroup();
  }

  async function addExpense() {
    const { description, amount, paid_by, split_among } = expense;
    if (!description || !amount || !paid_by || split_among.length === 0) {
      addToast("⚠️ Fill all fields and select who to split with");
      return;
    }
    await fetch(`${API}/api/groups/${group.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        amount: parseFloat(amount),
        paid_by: parseInt(paid_by),
        split_among: split_among.map(Number)
      }),
    });
    setExpense({ description: "", amount: "", paid_by: "", split_among: [] });
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
        : [...prev.split_among, String(id)]
    }));
  }

  function computeSettlements() {
    const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b, net: parseFloat(b.net) }));
    const debtors = balances.filter(b => b.net < -0.01).map(b => ({ ...b, net: parseFloat(b.net) }));
    const txns = [];
    const c = creditors.map(x => ({ ...x }));
    const d = debtors.map(x => ({ ...x }));
    let ci = 0, di = 0;
    while (ci < c.length && di < d.length) {
      const amount = Math.min(c[ci].net, -d[di].net);
      txns.push({ from: d[di], to: c[ci], amount: amount.toFixed(2) });
      c[ci].net -= amount;
      d[di].net += amount;
      if (Math.abs(c[ci].net) < 0.01) ci++;
      if (Math.abs(d[di].net) < 0.01) di++;
    }
    return txns;
  }

  if (!data) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading group...</p>
    </div>
  );

  const settlements = computeSettlements();
  const totalSpent = data.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const sharePerPerson = expense.split_among.length > 0 && expense.amount
    ? (parseFloat(expense.amount) / expense.split_among.length).toFixed(2) : null;

  const maxBalance = Math.max(...balances.map(b => Math.abs(parseFloat(b.net))), 1);

  return (
    <div className="group-detail">

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span className="toast-dot" />
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="detail-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="detail-header-info">
          <h1 className="detail-title">{data.name}</h1>
          <div className="detail-meta">
            <span className="meta-pill">{data.members.length} members</span>
            <span className="meta-pill accent">₹{totalSpent.toFixed(0)} total</span>
          </div>
        </div>
      </div>

      {/* Members row */}
      <div className="members-bar">
        <div className="members-avatars">
          {data.members.map((m, i) => (
            <div key={m.id} className={`member-avatar ${m.name === currentUser ? "is-you" : ""}`}
              style={{ zIndex: data.members.length - i }}
              title={m.name}>
              {m.name[0].toUpperCase()}
              {m.name === currentUser && <span className="you-badge">you</span>}
            </div>
          ))}
        </div>
        <div className="add-member-row">
          <input value={newMember} onChange={e => setNewMember(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMember()}
            placeholder="Add member..." className="member-input" />
          <button onClick={addMember} className="member-add-btn">+</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {["expenses", "balances", "settle"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "active" : ""}`}>
            {t === "expenses" ? "💸 Expenses" : t === "balances" ? "📊 Balances" : "✅ Settle Up"}
            {t === "settle" && settlements.length > 0 && (
              <span className="tab-badge">{settlements.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* EXPENSES TAB */}
      {tab === "expenses" && (
        <div className="tab-content">
          {/* Add expense form */}
          <div className="expense-form">
            <div className="form-title">Add Expense</div>
            <div className="form-row">
              <input value={expense.description}
                onChange={e => setExpense({ ...expense, description: e.target.value })}
                placeholder="What was it for?" className="form-input" />
              <input value={expense.amount}
                onChange={e => setExpense({ ...expense, amount: e.target.value })}
                placeholder="₹ Amount" type="number" className="form-input amount-input" />
            </div>
            <select value={expense.paid_by}
              onChange={e => setExpense({ ...expense, paid_by: e.target.value })}
              className="form-select">
              <option value="">Who paid?</option>
              {data.members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.name === currentUser ? " (you)" : ""}
                </option>
              ))}
            </select>
            <div className="split-section">
              <div className="split-label">
                Split among
                {sharePerPerson && (
                  <span className="split-preview"> — ₹{sharePerPerson} each</span>
                )}
              </div>
              <div className="split-chips">
                {data.members.map(m => (
                  <button key={m.id} onClick={() => toggleSplit(m.id)}
                    className={`split-chip ${expense.split_among.includes(String(m.id)) ? "selected" : ""}`}>
                    {m.name}{m.name === currentUser ? " (you)" : ""}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addExpense} className="add-expense-btn">
              Add Expense
            </button>
          </div>

          {/* Expense list */}
          <div className="expense-list">
            {data.expenses.length === 0 && (
              <div className="empty-list">No expenses yet. Add one above ☝️</div>
            )}
            {data.expenses.map(e => {
              const share = e.split_among ? (parseFloat(e.amount) / e.split_among.length).toFixed(2) : null;
              return (
                <div key={e.id} className="expense-card">
                  <div className="expense-card-left">
                    <div className="expense-desc">{e.description}</div>
                    <div className="expense-who">
                      <span className="paid-by">Paid by <strong>{e.paid_by_name}</strong></span>
                      {e.split_among && (
                        <span className="split-info">
                          · Split {e.split_among.length} ways · ₹{(parseFloat(e.amount) / e.split_among.length).toFixed(2)} each
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="expense-amount">₹{parseFloat(e.amount).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BALANCES TAB */}
      {tab === "balances" && (
        <div className="tab-content">
          <div className="balances-list">
            {balances.length === 0 && <div className="empty-list">No data yet.</div>}
            {balances.map((b, i) => {
              const net = parseFloat(b.net);
              const isPositive = net >= 0;
              const barWidth = Math.abs(net / maxBalance) * 100;
              return (
                <div key={i} className="balance-card">
                  <div className="balance-card-top">
                    <div className="balance-avatar">{b.name[0].toUpperCase()}</div>
                    <div className="balance-info">
                      <div className="balance-name">
                        {b.name}
                        {b.name === currentUser && <span className="you-tag">you</span>}
                      </div>
                      <div className={`balance-status ${isPositive ? "gets" : "owes"}`}>
                        {isPositive ? "gets back" : "owes"}
                      </div>
                    </div>
                    <div className={`balance-amount ${isPositive ? "positive" : "negative"}`}>
                      {isPositive ? "+" : "-"}₹{Math.abs(net).toFixed(2)}
                    </div>
                  </div>
                  <div className="balance-bar-track">
                    <div className={`balance-bar-fill ${isPositive ? "bar-positive" : "bar-negative"}`}
                      style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SETTLE TAB */}
      {tab === "settle" && (
        <div className="tab-content">
          {settlements.length === 0 && (
            <div className="all-clear">
              <div className="all-clear-icon">🎉</div>
              <div className="all-clear-title">All settled up!</div>
              <div className="all-clear-sub">No pending payments in this group</div>
            </div>
          )}
          {settlements.map((s, i) => (
            <div key={i} className="settle-card">
              <div className="settle-card-left">
                <div className="settle-from">
                  <span className="settle-avatar">{s.from.name[0].toUpperCase()}</span>
                  <span className="settle-name">{s.from.name === currentUser ? "You" : s.from.name}</span>
                </div>
                <div className="settle-arrow-wrap">
                  <div className="settle-arrow-line" />
                  <div className="settle-amount-badge">₹{s.amount}</div>
                </div>
                <div className="settle-to">
                  <span className="settle-avatar">{s.to.name[0].toUpperCase()}</span>
                  <span className="settle-name">{s.to.name === currentUser ? "You" : s.to.name}</span>
                </div>
              </div>
              <button onClick={() => settle(
                balances.find(b => b.name === s.from.name)?.id,
                balances.find(b => b.name === s.to.name)?.id,
                s.amount
              )} className="settle-btn">
                Mark Paid ✓
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}