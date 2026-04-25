export default function GroupList({ groups, onSelect }) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <p>No groups yet. Create one above ☝️</p>
      </div>
    );
  }

  return (
    <div className="group-list">
      <h2>Your Groups</h2>
      <div className="groups-grid">
        {groups.map((g) => (
          <div key={g.id} className="group-card" onClick={() => onSelect(g)}>
            <div className="group-card-icon">👥</div>
            <div className="group-card-name">{g.name}</div>
            <div className="group-card-date">
              {new Date(g.created_at).toLocaleDateString()}
            </div>
            <div className="group-card-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
}
