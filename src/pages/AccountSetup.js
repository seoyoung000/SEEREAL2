import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import "./AccountSetup.css";

function AccountSetup() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySMS, setNotifySMS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initializing && !user) navigate("/login", { replace: true });
  }, [initializing, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const bootstrap = async () => {
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) { navigate("/", { replace: true }); return; }
        setDisplayName(user.displayName || "");
        setEmail(user.email || "");
      } finally { setLoading(false); }
    };
    bootstrap();
  }, [user, navigate]);

  if (initializing || loading || !user) return null;

  const isDisplayNameTaken = async (name) => {
    const snapshot = await getDocs(query(collection(db, "users"), where("displayName", "==", name.trim())));
    return snapshot.docs.some((d) => d.id !== user.uid);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) { setError("닉네임을 입력해 주세요."); return; }
    if (await isDisplayNameTaken(trimmedName)) { setError("이미 사용 중인 닉네임입니다."); return; }

    setSaving(true); setError("");
    const cleanedPhone = phoneNumber.trim();
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: trimmedName, email: email.trim(),
        phoneNumber: cleanedPhone || null,
        notification: { enabled: notificationEnabled, channels: { email: notificationEnabled ? notifyEmail : false, sms: notificationEnabled ? (notifySMS && Boolean(cleanedPhone)) : false } },
        favoriteZones: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
      if (user.displayName !== trimmedName) await updateProfile(user, { displayName: trimmedName });
      navigate("/", { replace: true });
    } catch { setError("계정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setSaving(false); }
  };

  return (
    <div className="account-setup">
      <div className="account-setup__card">
        <header className="account-setup__header">
          <p>첫 설정</p>
          <h1>관심 구역 알림을 설정해 주세요</h1>
          <p>닉네임과 연락처, 알림 채널을 저장하면 지도에서 관심 구역을 등록할 수 있습니다.</p>
        </header>
        <form className="account-setup__form" onSubmit={handleSave}>
          <label className="account-setup__field">닉네임<input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={saving} required /></label>
          <label className="account-setup__field">이메일<input type="email" value={email} disabled readOnly /><span className="account-setup__hint">Google 계정 정보와 동일하게 설정됩니다.</span></label>
          <label className="account-setup__field">휴대전화번호 (선택)<input type="tel" placeholder="'-' 없이 숫자만 입력" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={saving} /></label>
          <div className="account-setup__consent">
            <label className="consent-checkbox"><input type="checkbox" checked={notificationEnabled} onChange={() => setNotificationEnabled((p) => !p)} disabled={saving} />관심 구역 알림 받기</label>
            <div className="consent-options">
              <label className="consent-checkbox"><input type="checkbox" checked={notifyEmail} disabled={!notificationEnabled || saving} onChange={() => setNotifyEmail(true)} />이메일로 받기</label>
              <label className="consent-checkbox"><input type="checkbox" checked={notifySMS} disabled={!notificationEnabled || saving} onChange={() => { if (!phoneNumber.trim()) { setError("문자 알림을 받으려면 휴대전화 번호를 먼저 입력해주세요."); return; } setNotifySMS((p) => !p); }} />문자로 받기</label>
            </div>
          </div>
          {error && <p className="account-setup__error">{error}</p>}
          <button type="submit" disabled={saving} className="account-setup__submit">{saving ? "저장 중..." : "설정 완료"}</button>
        </form>
      </div>
    </div>
  );
}

export default AccountSetup;
