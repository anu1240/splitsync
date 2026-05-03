import { useState } from "react";

const features = [
  { icon: "⚡", title: "Real-Time Sync",    desc: "Expenses update instantly across all devices using WebSockets" },
  { icon: "🧮", title: "Smart Splits",      desc: "Automatically calculates who owes what with one-click settle up" },
  { icon: "☁️", title: "Cloud Hosted",      desc: "Deployed on AWS EC2 in Mumbai with Jenkins CI/CD pipeline" },
  { icon: "🔒", title: "Always Available",  desc: "Docker containers ensure zero downtime and fast restarts" },
];

export default function Landing({ onEnter }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);

  function handleStart() {
    if (!name.trim()) return;
    onEnter(name.trim());
  }

  return (
    <div className="landing">
      <div className="landing-grid" />
      <div className="landing-glow" />

      <div className="landing-inner">
        <div className="landing-hero">
          <div className="landing-badge">
            <span className="badge-dot" />
            Real-time · WebSocket powered · AWS deployed
          </div>

          <h1 className="landing-title">
            Split expenses.<br />
            <span className="landing-title-accent">Stay frends.</span>
          </h1>

          <p className="landing-desc">
            A real-time expense splitting app built with React, Node.js, PostgreSQL,
            Docker, Terraform, Ansible, and Jenkins on AWS EC2.
          </p>

          <div className="landing-cta">
            {step === 0 ? (
              <button className="landing-btn" onClick={() => setStep(1)}>
                Get Started →
              </button>
            ) : (
              <>
                <input
                  className="landing-input"
                  placeholder="What's your name?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStart()}
                  autoFocus
                />
                <button className="landing-btn" onClick={handleStart}>
                  Enter App →
                </button>
              </>
            )}
          </div>
          <p className="landing-hint">No account needed — just enter your name</p>
        </div>

        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="tech-strip">
          <span className="tech-label">Built with:</span>
          {["React", "Node.js", "PostgreSQL", "Docker", "Terraform", "Ansible", "Jenkins", "AWS EC2"].map(t => (
            <span key={t} className="tech-tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}