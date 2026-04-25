import { useState, useEffect } from "react";

export default function GroupDetail({ group, API, socket, onBack }) {
  const [data, setData] = useState(null);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [newMember, setNewMember] = useState("");
  const [expense, setExpense] = useState({ description: "", amount: "", paid_by: "", split_among: [] });
  const [liveAlert, setLiveAlert] = useState(null);

  useEffect(() => {
    fetchGroup();
    fetchBalances();
    socket.emit("join_group", group.id);

    socket.on("expense_added", (exp) => {
      setData((prev) => prev ? { ...prev, expenses: [exp, ...prev.expenses] } : prev);
      fetchBalances();
      showAlert(`💸 New expense: ${exp.description} — ₹${exp.amount}`);
    });
    socket.on("member_added", (member) => {
      setData((prev) => prev ? { ...prev, members: [...prev.members, member] } : prev);
      showAlert(`👤 ${member.name} joined the group!`);
    });
    socket.on("settled", () => {
      fetchBalances();
      showAlert("✅ A payment was settled!");
    });

    return () => {
      socket.off("expense_added");
      socket.off("member_added");
      socket.off("settled");
    };
  }, [group.id]);

  function showAlert(msg) {
    setLiveAlert(msg);
    setTimeout(() => setLiveAlert(null), 3500);
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
    if (!description || !amount || !paid_by || split_among.length === 0) return;
    await fetch(`${API}/api/groups/${group.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amount: parseFloat(amount), paid_by: parseInt(paid_by), split_among: split_among.map(Number) }),
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

  function toggleSplitMember(id) {
    setExpense((prev) => ({
      ...prev,
      split_among: prev.split_among.includes(String(id))
        ? prev.split_among.filter((x) => x !== String(id))
        : [...prev.split_among, String(id)],
    }));
  }

  // Compute who owes whom
  function computeSettlements() {
    const creditors = balances.filter((b) => b.net > 0.01).map((b) => ({ ...b, net: parseFloat(b.net) }));
    const debtors = balances.filter((b) => b.net < -0.01).map((b) => ({ ...b, net: parseFloat(b.net) }));
    const txns = [];
    let ci = 0, di = 0;
    const c = creditors.map((x) => ({ ...x }));
    const d = debtors.map((x) => ({ ...x }));
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

  if (!data) return <div className="loading">Loading...</div>;

  const settlements = computeSettlements();

  return (
    <div className="group-detail">
      {liveAlert && (
        <div className="live-alert">
          <span className="live-dot" /> {liveAlert}
        </div>
      )}

      <div className="detail-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h1>{data.name}</h1>
        <span className="member-count">{data.members.length} members</span>
      </div>

      {/* Add Member */}
      <div className="section-card">
        <h3>Add Member</h3>
        <div className="input-row">
          <input value={newMember} onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            placeholder="Member name..." className="input" />
          <button onClick={addMember} className="btn-primary">Add</button>
        </div>
        <div className="member-chips">
          {data.members.map((m) => (
            <span key={m.id} className="chip">{m.name}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {["expenses", "balances", "settle"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "active" : ""}`}>
            {t === "expenses" ? "💸 Expenses" : t === "balances" ? "📊 Balances" : "✅ Settle Up"}
          </button>
        ))}
      </div>

      {/* Add Expense */}
      {tab === "expenses" && (
        <div>
          <div className="section-card">
            <h3>Add Expense</h3>
            <input value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })}
              placeholder="What was it for?" className="input mb" />
            <input value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
              placeholder="Amount (₹)" type="number" className="input mb" />
            <select value={expense.paid_by} onChange={(e) => setExpense({ ...expense, paid_by: e.target.value })} className="input mb">
              <option value="">Who paid?</option>
              {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="split-label">Split among:</div>
            <div className="member-chips">
              {data.members.map((m) => (
                <span key={m.id}
                  onClick={() => toggleSplitMember(m.id)}
                  className={`chip selectable ${expense.split_among.includes(String(m.id)) ? "selected" : ""}`}>
                  {m.name}
                </span>
              ))}
            </div>
            <button onClick={addExpense} className="btn-primary mt">Add Expense</button>
          </div>

          <div className="expense-list">
            {data.expenses.length === 0 && <p className="empty">No expenses yet.</p>}
            {data.expenses.map((e) => (
              <div key={e.id} className="expense-item">
                <div className="exp-left">
                  <div className="exp-desc">{e.description}</div>
                  <div className="exp-meta">Paid by <strong>{e.paid_by_name}</strong></div>
                </div>
                <div className="exp-amount">₹{parseFloat(e.amount).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balances */}
      {tab === "balances" && (
        <div className="section-card">
          <h3>Net Balances</h3>
          {balances.length === 0 && <p className="empty">No data yet.</p>}
          {balances.map((b, i) => (
            <div key={i} className="balance-row">
              <span className="balance-name">{b.name}</span>
              <span className={`balance-amount ${parseFloat(b.net) >= 0 ? "positive" : "negative"}`}>
                {parseFloat(b.net) >= 0 ? `+₹${parseFloat(b.net).toFixed(2)}` : `-₹${Math.abs(parseFloat(b.net)).toFixed(2)}`}
              </span>
              <span className="balance-label">{parseFloat(b.net) > 0 ? "gets back" : parseFloat(b.net) < 0 ? "owes" : "settled"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Settle Up */}
      {tab === "settle" && (
        <div className="section-card">
          <h3>Suggested Settlements</h3>
          {settlements.length === 0 && <p className="empty">✅ All settled up!</p>}
          {settlements.map((s, i) => (
            <div key={i} className="settle-row">
              <span><strong>{s.from.name}</strong> → <strong>{s.to.name}</strong>: ₹{s.amount}</span>
              <button onClick={() => settle(
                balances.find(b => b.name === s.from.name)?.id,
                balances.find(b => b.name === s.to.name)?.id,
                s.amount
              )} className="btn-settle">Mark Paid</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
