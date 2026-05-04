import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || "/";
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError("아이디와 비밀번호를 모두 입력해주세요."); return; }
    setSubmitting(true); setError("");
    try { await loginWithEmail(email.trim(), password); navigate(redirectPath, { replace: true }); }
    catch { setError("로그인에 실패했습니다. 입력 정보를 확인해주세요."); }
    finally { setSubmitting(false); }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true); setError("");
    try {
      const result = await loginWithGoogle();
      if (result && !result.needsSetup) navigate(redirectPath, { replace: true });
    } catch { setError("구글 로그인 중 문제가 발생했습니다. 다시 시도해주세요."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-nav">
          <div className="auth-links">
            <Link to="/login" className="active">로그인</Link>
            <Link to="/signup">회원가입</Link>
          </div>
        </div>
        <section className="auth-card">
          <header className="auth-header">
            <p className="auth-subheading">Community Access</p>
            <h1>로그인</h1>
          </header>
          <p className="auth-motivation">지금 가입하고 관심 구역 알림을 받아보세요.</p>
          <button type="button" className="auth-google-btn" onClick={handleGoogleLogin} disabled={submitting}>
            <span className="google-icon">G</span> Google 계정으로 계속하기
          </button>
          <div className="auth-divider"><span>또는</span></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-label">아이디 (이메일)<input type="email" placeholder="example@seereal.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} /></label>
            <label className="auth-label">비밀번호<input type="password" placeholder="영문, 숫자 조합 8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} /></label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? "로그인 중..." : "로그인"}</button>
          </form>
          <div className="auth-footer-links"><Link to="/signup" state={{ from: redirectPath }}>회원가입</Link></div>
        </section>
      </div>
    </div>
  );
}

export default Login;
