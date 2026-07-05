import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';

const CARDS = [
  { icon: '🏋️', title: 'Log a Set', desc: 'Track weights, reps, and performance.', long: 'Type it like you\'d say it, "squat 5×5 at 225", and it\'s logged.' },
  { icon: '📈', title: 'Check Progression', desc: 'Analyze past performance and volume.', long: 'Ask how your lifts are trending and get answers from your real history.' },
  { icon: '🎯', title: 'Form Check', desc: 'Get mechanical cues and safety tips.', long: 'Describe how a lift felt and get cues to move better and safer.' },
  { icon: '🔋', title: 'Manage Fatigue', desc: 'Autoregulate volume based on recovery.', long: "Feeling beat up? Your volume adjusts to how you're actually recovering." },
];

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-blob landing-blob--top" />
      <div className="landing-blob landing-blob--bottom" />

      <Navbar>
        <Link className="landing-login-link" to="/login">Log in</Link>
        <Link className="landing-cta" to="/signup">Get started</Link>
      </Navbar>

      <section className="landing-hero">
        <h1>Your strength coach, in a chat.</h1>
        <p>Log sets, check your progression, and get form and fatigue guidance, just by talking to it.</p>

        <div className="landing-appscreen">
          <div className="landing-appscreen-dots">
            <span /><span /><span />
          </div>
          <div className="landing-appframe">
            <aside className="landing-sidebar">
              <div className="landing-sidebar-brand">
                <div className="landing-sidebar-brand-icon">🏋️</div>
                <span>Strength Coach</span>
              </div>
              <div className="landing-newworkout">
                <span className="landing-plus">+</span> New workout
              </div>
              <div className="landing-chat-history-label">CHAT HISTORY</div>
              <div className="landing-chat-history-list">
                <div className="landing-chat-history-item"><span>💬</span> New Workout</div>
                <div className="landing-chat-history-item"><span>💬</span> Which exercise would…</div>
              </div>
            </aside>
            <main className="landing-appmain">
              <div className="landing-appmain-inner">
                <div className="landing-appmain-icon">🏋️</div>
                <div className="landing-appmain-title">What are we lifting today?</div>
                <div className="landing-searchbar">
                  <span>Log your set or ask for a progression check…</span>
                  <span className="landing-searchbar-btn">➤</span>
                </div>
                <div className="landing-appgrid">
                  {CARDS.map((c) => (
                    <div key={c.title} className="landing-appcard">
                      <div className="landing-appcard-icon">{c.icon}</div>
                      <div>
                        <div className="landing-appcard-title">{c.title}</div>
                        <div className="landing-appcard-desc">{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-features-inner">
          <div className="landing-featgrid">
            {CARDS.map((f) => (
              <div key={f.title}>
                <div className="landing-feat-icon">{f.icon}</div>
                <div className="landing-feat-title">{f.title}</div>
                <div className="landing-feat-long">{f.long}</div>
              </div>
            ))}
          </div>

          <div className="landing-cta-section">
            <div className="landing-cta-heading">Start your next session with a coach in your corner.</div>
            <Link className="landing-cta landing-cta--large" to="/signup">Get started, it's free</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-brand">Strength Coach</span>
        <span>© 2026 Strength Coach</span>
      </footer>
    </div>
  );
}
