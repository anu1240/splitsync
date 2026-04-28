import { useState } from "react";

const features = [
  { icon: "⚡", title: "Real-Time Sync", desc: "Expenses update instantly across all devices using WebSockets" },
  { icon: "🧮", title: "Smart Splits", desc: "Automatically calculates who owes what with one-click settle up" },
  { icon: "☁️", title: "Cloud Hosted", desc: "Deployed on AWS EC2 in Mumbai with Jenkins CI/CD pipeline" },
  { icon: "🔒", title: "Always Available", desc: "Docker containers ensure zero downtime and fast restarts" },
];

export default function Landing({ onStart }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);

  function handleStart() {
    if (!name.trim()) return;
    onStart(name.trim());
  }

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="bg-orb orb1" />
        <div className="bg-orb orb2" />
        <div className="bg-grid" />
      </div>

      <nav className="landing-nav">
        <div className="logo">
          <div className="logo-mark">S</div>
          <div className="logo-text-wrap">
            <span className="logo-word">SplitSync</span>
          </div>
        </div>
        <div className="nav-tag">DevOps Major Project · SRMIST CSE</div>
      </nav>

      <div className="landing-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Real-time · WebSocket powered · AWS deployed
        </div>
        <h1 className="hero-headline">
          Split expenses.<br />
          <span className="hero-accent">Stay friends.</span>
        </h1>
        <p className="hero-desc">
          A real-time expense splitting app built with React, Node.js, PostgreSQL, 
          Docker, Terraform, Ansible, and Jenkins on AWS EC2.
        </p>

        <div className="hero-cta">
          {step === 0 ? (
            <button className="cta-btn" onClick={() => setStep(1)}>
              Get Started →
            </button>
          ) : (
            <div className="name-entry">
              <input
                className="name-input"
                placeholder="What's your name?"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleStart()}
                autoFocus
              />
              <button className="cta-btn" onClick={handleStart}>
                Enter App →
              </button>
            </div>
          )}
        </div>

        <div className="hero-stack">
          {["React", "Node.js", "PostgreSQL", "Docker", "Terraform", "Ansible", "Jenkins", "AWS EC2"].map(t => (
            <span key={t} className="stack-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="landing-features">
        {features.map((f, i) => (
          <div key={i} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="landing-footer">
        Built with ❤️ for DevOps · SRMIST CSE · 2025
      </div>
    </div>
  );
}