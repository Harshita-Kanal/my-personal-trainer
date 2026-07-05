import { Link } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/react';
import { Navbar } from './Navbar';

const authAppearance = {
  elements: {
    footerAction: { display: 'none' },
    header: 'auth-widget-header',
  },
};

export function LoginPage() {
  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-screen">
        <div>
          <SignIn routing="virtual" appearance={authAppearance} />
          <p className="auth-toggle">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-screen">
        <div>
          <SignUp routing="virtual" appearance={authAppearance} />
          <p className="auth-toggle">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
