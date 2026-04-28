import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "food",   icon: "🍕" },
  { id: "travel", icon: "✈️" },
  { id: "stay",   icon: "🏨" },
  { id: "fun",    icon: "🎉" },
  { id: "shop",   icon: "🛍️" },
  { id: "fuel",   icon: "⛽" },
  { id: "bill",   icon: "📱" },
  { id: "other",  icon: "💸" },
];

export default function GroupDetail({ group, API, socket, currentUser, onBack, onActivity }) {
  const [data, setData]       = useState(null);
  const [balances, setBalances] = useState([]);
  const [tab, setTab]         = useState("expenses");
  const [newMember, setNewMember] = useState("");
  const [toasts, setToasts]   = useState([]);
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
      toast("✅ A payment was settled!", "success");
      onActivity(`Someone settled up in ${group.name}`, "success");
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
    const d   = await res.json();
    setData(d);
    if (d.members) {
      const me = d.members.find(m => m.name === currentUser);
      if (me) setExpense(prev => ({ ...prev, paid_by: String(me.id) }));
    }
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
    setExpense(prev => ({ ...prev, split_among: data.members.map(m => String(m.id)) }));
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
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );

  const settlements  = computeSettlements();
  const totalSpent   = data.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const sharePreview = expense.split_among.length > 0 && expense.amount
    ? (parseFloat(expense.amount) / expense.split_among.length).toFixed(2) : null;
  const maxNet    = Math.max(...balances.map(b => Math.abs(parseFloat(b.net))), 1);
  const myBalance = balances.find(b => b.name === currentUser);

  return (
    <div className="group-detail">

      {/* ── Toasts ── */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-pulse" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Top info card ── */}
      <div className="detail-top">
        <div className="detail-title-row">
          <h1 className="detail-title">{data.name}</h1>
          <div className="detail-stats">
            <div className="stat-box">
              <div className="stat-value">₹{totalSpent.toFixed(0)}</div>
              <div className="stat-label">Total Spent</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{data.members.length}</div>
              <div className="stat-label">Members</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{data.expenses.length}</div>
              <div className="stat-label">Expenses</div>
            </div>
            {myBalance && (
              <div className="stat-box">
                <div className={`stat-value ${parseFloat(myBalance.net) >= 0 ? "stat-green" : "stat-red"}`}>
                  {parseFloat(myBalance.net) >= 0
                    ? `+₹${parseFloat(myBalance.net).toFixed(0)}`
                    : `-₹${Math.abs(parseFloat(myBalance.net)).toFixed(0)}`}
                </div>
                <div className="stat-label">Your Balance</div>
              </div>
            )}
          </div>
        </div>

        {/* Members row */}
        <div className="members-row">
          <div className="members-avatars-row">
            {data.members.map(m => (
              <div key={m.id} className={`member-circle ${m.name === currentUser ? "member-you" : ""}`}
                title={m.name}>
                {m.name[0].toUpperCase()}
              </div>
            ))}
            <span className="members-names">
              {data.members.slice(0, 2).map(m => m.name === currentUser ? "You" : m.name).join(", ")}
              {data.members.length > 2 && ` +${data.members.length - 2} more`}
            </span>
          </div>
          <div className="add-member-inline">
            <input
              value={newMember}
              onChange={e => setNewMember(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMember()}
              placeholder="+ Add member"
              className="member-inline-input"
            />
            <button onClick={addMember} className="member-inline-btn">Add</button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs-row">
        {[
          { id: "expenses", label: "💸 Expenses", count: data.expenses.length },
          { id: "balances", label: "📊 Balances", count: null },
          { id: "settle",   label: "✅ Settle Up", count: settlements.length || null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? "tab-active" : ""}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`tab-count ${t.id === "settle" ? "tab-count-alert" : ""}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ EXPENSES TAB ══════════ */}
      {tab === "expenses" && (
        <div className="tab-pane">
          <div className="expense-form-card">
            <div className="form-section-label">Add New Expense</div>

            {/* Category picker */}
            <div className="category-row">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setExpense({ ...expense, category: c.id })}
                  className={`cat-btn ${expense.category === c.id ? "cat-active" : ""}`}
                  title={c.id}>
                  {c.icon}
                </button>
              ))}
            </div>

            <div className="form-grid">
              <input
                value={expense.description}
                onChange={e => setExpense({ ...expense, description: e.target.value })}
                placeholder="What was it for?"
                className="form-inp"
              />
              <input
                value={expense.amount}
                type="number"
                onChange={e => setExpense({ ...expense, amount: e.target.value })}
                placeholder="₹ Amount"
                className="form-inp form-amount"
              />
            </div>

            <select
              value={expense.paid_by}
              onChange={e => setExpense({ ...expense, paid_by: e.target.value })}
              className="form-inp form-select">
              <option value="">Who paid?</option>
              {data.members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.name === currentUser ? " (you)" : ""}
                </option>
              ))}
            </select>

            <div className="split-row">
              <div className="split-label-row">
                <span className="split-label-text">Split among</span>
                {sharePreview && (
                  <span className="split-preview-badge">₹{sharePreview} each</span>
                )}
                <button onClick={selectAllSplit} className="split-all-btn">All</button>
              </div>
              <div className="split-chips-row">
                {data.members.map(m => (
                  <button key={m.id} onClick={() => toggleSplit(m.id)}
                    className={`split-chip ${expense.split_among.includes(String(m.id)) ? "split-chip-on" : ""}`}>
                    {m.name === currentUser ? "You" : m.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={addExpense} className="add-btn">Add Expense</button>
          </div>

          {/* Expense list */}
          <div className="expense-cards">
            {data.expenses.length === 0 && (
              <div className="empty-tab">No expenses yet. Add the first one ☝️</div>
            )}
            {data.expenses.map(e => {
              const cat = CATEGORIES.find(c => e.description?.startsWith(c.icon));
              const perPerson = e.split_among
                ? (parseFloat(e.amount) / e.split_among.length).toFixed(2) : null;
              return (
                <div key={e.id} className="expense-row">
                  <div className="expense-emoji-col">{cat?.icon || "💸"}</div>
                  <div className="expense-main">
                    <div className="expense-title">{e.description}</div>
                    <div className="expense-sub">
                      Paid by{" "}
                      <span className="paid-name">
                        {e.paid_by_name === currentUser ? "You" : e.paid_by_name}
                      </span>
                      {perPerson && (
                        <span className="expense-split-detail">
                          {" · "}Split {e.split_among.length} ways
                          {" · "}<strong>₹{perPerson}</strong> each
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

      {/* ══════════ BALANCES TAB ══════════ */}
      {tab === "balances" && (
        <div className="tab-pane">
          {balances.map((b, i) => {
            const net  = parseFloat(b.net);
            const pct  = Math.abs(net / maxNet) * 100;
            const isMe = b.name === currentUser;
            return (
              <div key={i} className={`balance-row-card ${isMe ? "balance-me" : ""}`}>
                <div className={`bal-avatar`}
                  style={{ background: isMe ? "rgba(0,201,167,0.15)" : "var(--surface3)",
                           color: isMe ? "var(--teal)" : "var(--teal2)" }}>
                  {b.name[0].toUpperCase()}
                </div>
                <div className="bal-info">
                  <div className="bal-name">
                    {isMe ? "You" : b.name}
                    {isMe && <span className="you-pill">you</span>}
                  </div>
                  <div className="bal-bar-track">
                    <div className={`bal-bar ${net >= 0 ? "bar-pos" : "bar-neg"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="bal-amount">
                  <div className={net >= 0 ? "bal-pos" : "bal-neg"}>
                    {net >= 0 ? "+" : "-"}₹{Math.abs(net).toFixed(2)}
                  </div>
                  <div className="bal-status">
                    {net > 0 ? "gets back" : net < 0 ? "owes" : "settled ✓"}
                  </div>
                </div>
              </div>
            );
          })}
          {balances.length === 0 && (
            <div className="empty-tab">Add expenses to see balances</div>
          )}
        </div>
      )}

      {/* ══════════ SETTLE TAB ══════════ */}
      {tab === "settle" && (
        <div className="tab-pane">
          {settlements.length === 0 ? (
            <div className="all-good">
              <div className="all-good-icon">🎊</div>
              <div className="all-good-title">All settled up!</div>
              <div className="all-good-sub">No pending payments in this group</div>
            </div>
          ) : (
            settlements.map((s, i) => {
              const fromMember = balances.find(b => b.name === s.from.name);
              const toMember   = balances.find(b => b.name === s.to.name);
              return (
                <div key={i} className="settle-card-v2">
                  <div className="settle-flow">
                    <div className="settle-person">
                      <div className="settle-av">{s.from.name[0].toUpperCase()}</div>
                      <div className="settle-pname">
                        {s.from.name === currentUser ? "You" : s.from.name}
                      </div>
                    </div>
                    <div className="settle-mid">
                      <div className="settle-line" />
                      <div className="settle-amt-pill">₹{s.amount}</div>
                      <div className="settle-arrow-icon">→</div>
                    </div>
                    <div className="settle-person">
                      <div className="settle-av">{s.to.name[0].toUpperCase()}</div>
                      <div className="settle-pname">
                        {s.to.name === currentUser ? "You" : s.to.name}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => settle(fromMember?.id, toMember?.id, s.amount)}
                    className="settle-pay-btn">
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