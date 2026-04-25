export default function GroupList({ groups, currentUser, onSelect }) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🪐</div>
        <p className="empty-title">No groups yet</p>
        <p className="empty-sub">Create one above to get started</p>
      </div>
    );
  }

  const emojis = ["🏖️", "🏠", "🍕", "✈️", "🎮", "🎉", "🚗", "💼"];

  return (
    <div className="groups-grid">
      {groups.map((g, i) => (
        <div key={g.id} className="group-card" onClick={() => onSelect(g)}>
          <div className="group-card-top">
            <span className="group-emoji">{emojis[i % emojis.length]}</span>
            <span className="group-arrow">→</span>
          </div>
          <div className="group-card-name">{g.name}</div>
          <div className="group-card-date">
            Created {new Date(g.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </div>
          <div className="group-card-bar" />
        </div>
      ))}
    </div>
  );
}