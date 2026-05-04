import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import "./AuthPages.css";

function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || "/";
  const { signupWithEmail, loginWithGoogle } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySMS, setNotifySMS] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isDisplayNameTaken = async (name, excludeUid = null) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const snapshot = await getDocs(query(collection(db, "users"), where("displayName", "==", trimmed)));
    if (snapshot.empty) return false;
    return snapshot.docs.some((d) => d.id !== excludeUid);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) { setError("닉네임을 입력해 주세요."); return; }
    if (!email.trim() || !password.trim()) { setError("필수 항목을 모두 입력해주세요."); return; }
    if (password.length < 8) { setError("비밀번호는 8자 이상 입력해주세요."); return; }
    if (password !== confirmPassword) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (await isDisplayNameTaken(trimmedName)) { setError("이미 사용 중인 닉네임입니다."); return; }

    setSubmitting(true); setError("");
    try {
      const user = await signupWithEmail({ email: email.trim(), password, displayName: trimmedName });
      const cleanedPhone = phoneNumber.trim();
      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);
      const payload = {
        displayName: trimmedName, email: email.trim(),
        phoneNumber: cleanedPhone || null,
        notification: { enabled: notificationEnabled, channels: { email: notificationEnabled ? notifyEmail : false, sms: notificationEnabled ? (notifySMS && Boolean(cleanedPhone)) : false } },
        updatedAt: serverTimestamp(),
      };
      if (!snapshot.exists()) { payload.createdAt = serverTimestamp(); payload.favoriteZones = []; }
      await setDoc(userRef, payload, { merge: true });
      navigate(redirectPath, { replace: true });
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") setError("이미 사용 중인 이메일입니다.");
      else setError("회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally { setSubmitting(false); }
  };

  const handleGoogleSignup = async () => {
    setSubmitting(true); setError("");
    try { const result = await loginWithGoogle(); if (result && !result.needsSetup) navigate(redirectPath, { replace: true }); }
    catch { setError("구글 계정 연동 중 문제가 발생했습니다."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-nav"><div className="auth-links"><Link to="/login">로그인</Link><Link to="/signup" className="active">회원가입</Link></div></div>
        <section className="auth-card">
          <header className="auth-header"><p className="auth-subheading">Create Account</p><h1>회원가입</h1></header>
          <p className="auth-motivation">닉네임과 알림 방식을 설정하면 관심 구역 소식을 빠르게 받을 수 있어요.</p>
          <button type="button" className="auth-google-btn" onClick={handleGoogleSignup} disabled={submitting}><span className="google-icon">G</span> Google 계정으로 시작하기</button>
          <div className="auth-divider"><span>또는 이메일로 가입</span></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-label">닉네임<input type="text" placeholder="커뮤니티에서 보여질 이름" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={submitting} required /></label>
            <label className="auth-label">이메일<input type="email" placeholder="example@seereal.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} required /></label>
            <label className="auth-label">비밀번호<input type="password" placeholder="영문, 숫자 조합 8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} required /></label>
            <label className="auth-label">비밀번호 확인<input type="password" placeholder="다시 한번 입력해주세요" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={submitting} required /></label>
            <label className="auth-label">휴대전화번호 (선택)<input type="tel" placeholder="'-' 없이 숫자만 입력" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={submitting} /></label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? "가입 처리 중..." : "회원가입"}</button>
          </form>
          <div className="auth-footer-links"><span>이미 계정이 있으신가요?</span><Link to="/login" state={{ from: redirectPath }}>로그인</Link></div>
        </section>
      </div>
    </div>
  );
}

export default Signup;
