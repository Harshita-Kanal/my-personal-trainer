import { Link } from 'react-router-dom';

export function Navbar({ children }) {
  return (
    <nav className="landing-nav">
      <Link className="landing-brand" to="/">
        <div className="landing-brand-icon">🏋️</div>
        <span>Strength Coach</span>
      </Link>
      {children && <div className="landing-nav-actions">{children}</div>}
    </nav>
  );
}
