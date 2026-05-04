import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

function Header() {
  const { user, logout } = useAuth();
  const displayName = user?.displayName || user?.email || "회원";
  const [hasAlerts, setHasAlerts] = useState(
    () => sessionStorage.getItem("seereal-has-notifications") === "1"
  );

  useEffect(() => {
    const handleBadgeUpdate = () => {
      setHasAlerts(sessionStorage.getItem("seereal-has-notifications") === "1");
    };
    window.addEventListener("seereal-notification-update", handleBadgeUpdate);
    return () => window.removeEventListener("seereal-notification-update", handleBadgeUpdate);
  }, []);

  return (
    <header className="header-container">
      <nav className="nav-bar">
        <div className="nav-left">
          <Link to="/" className="header-logo">SEE:REAL</Link>
        </div>
        <div className="nav-links">
          <Link to="/">지도</Link>
          <Link to="/community">커뮤니티</Link>
          {user && <Link to="/mypage">마이페이지</Link>}
        </div>
        <div className="nav-right">
          {user ? (
            <div className="header-user-inline">
              <span className="user-name">{displayName}님</span>
              <span aria-hidden="true">|</span>
              <span className="mypage-link">
                <Link to="/mypage">마이페이지</Link>
                {hasAlerts && <span className="alert-dot" aria-label="알림 배지" />}
              </span>
              <span aria-hidden="true">|</span>
              <button type="button" onClick={logout}>로그아웃</button>
            </div>
          ) : (
            <div className="header-guest-links">
              <Link to="/login">로그인</Link>
              <span aria-hidden="true">|</span>
              <Link to="/signup">회원가입</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Header;
