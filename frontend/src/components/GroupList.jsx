const CATEGORY_EMOJIS = ["🏖️", "🏠", "✈️", "🍕", "🎮", "🎉", "🚗", "💼", "🎓", "🏋️"];
const CATEGORY_COLORS = [
  "card-blue", "card-purple", "card-teal", "card-orange",
  "card-pink", "card-green", "card-red", "card-yellow", "card-indigo", "card-cyan"
];

export default function GroupList({ groups, currentUser, onSelect, onDelete, onRename }) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-illustration">
          <div className="empty-circle" />
          <div className="empty-icon-big">🪐</div>
        </div>
        <h3 className="empty-title">No groups yet</h3>
        <p className="empty-sub">Create your first group to start splitting expenses</p>
      </div>
    );
  }

  return (
    <div className="groups-section">
      <div className="section-label">Your Groups · {groups.length}</div>
      <div className="groups-grid">
        {groups.map((g, i) => (
          <div key={g.id}
            className={`group-card ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
            onClick={() => onSelect(g)}>
            <div className="gc-top">
              <span className="gc-emoji">{CATEGORY_EMOJIS[i % CATEGORY_EMOJIS.length]}</span>
              <div className="gc-actions" onClick={e => e.stopPropagation()}>
                <button className="gc-action-btn" onClick={e => onRename(e, g.id, g.name)} title="Rename">✎</button>
                <button className="gc-action-btn gc-delete-btn" onClick={e => onDelete(e, g.id)} title="Delete">✕</button>
              </div>
            </div>
            <div className="gc-name">{g.name}</div>
            <div className="gc-date">
              {new Date(g.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="gc-shine" />
          </div>
        ))}
      </div>
    </div>
  );
}