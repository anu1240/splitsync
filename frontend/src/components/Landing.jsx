import { useState } from "react";

const FEATURES = [
  { icon: "⚡", title: "Real-Time Sync", desc: "Expenses update instantly across all devices — no refreshing needed" },
  { icon: "💸", title: "Smart Splitting", desc: "Split any way you want. See exactly who owes what at a glance" },
  { icon: "📊", title: "Live Balances", desc: "Visual balance bars show the full picture at a glance" },
  { icon: "✅", title: "One-Click Settle", desc: "Mark payments done instantly with live confirmation to the group" },
];

export default function Landing({ onEnter }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);

  function handleEnter() {
    if (!name.trim()) return;
    onEnter(name.trim());
  }

  return (
    <div className="landing">
      {/* Bg grid */}
      <div className="landing-grid" />
      <div className="landing-glow" />

      <div className="landing-inner">
        {/* Hero */}
        <div className="landing-hero">
          <div className="landing-badge">
            <span className="badge-dot" />
            Live on AWS · Mumbai Region
          </div>
          <h1 className="landing-title">
            Split expenses.<br />
            <span className="landing-title-accent">Stay friends.</span>
          </h1>
          <p className="landing-desc">
            Real-time expense splitting for groups. Add an expense — everyone sees it instantly.
            No more WhatsApp chaos.
          </p>

          <div className="landing-cta">
            <input
              className="landing-input"
              placeholder="What's your name?"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEnter()}
              autoFocus
            />
            <button className="landing-btn" onClick={handleEnter}>
              Get Started →
            </button>
          </div>
          <p className="landing-hint">No account needed. Just enter your name.</p>
        </div>

        {/* Features */}
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Tech stack strip */}
        <div className="tech-strip">
          <span className="tech-label">Powered by</span>
          {["React", "Node.js", "PostgreSQL", "Socket.io", "Docker", "AWS EC2", "Jenkins", "Terraform"].map(t => (
            <span key={t} className="tech-tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}