import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { DEFAULT_ZONE_SLUG } from "../utils/zones";
import { sendStageNotification } from "../services/notificationService";
import "./AccountSettings.css";

function AccountSettings() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [channelWarning, setChannelWarning] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySMS, setNotifySMS] = useState(false);
  const [favoriteZones, setFavoriteZones] = useState([]);

  useEffect(() => { if (!initializing && !user) navigate("/login", { replace: true }); }, [initializing, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) { setDisplayName(user.displayName || ""); setContactEmail(user.email || ""); setLoading(false); return; }
      const data = snap.data();
      const notif = data.notification || { enabled: true, channels: { email: true, sms: false } };
      setDisplayName(data.displayName || user.displayName || "");
      setContactEmail(data.email || user.email || "");
      setPhoneNumber(data.phoneNumber || "");
      setNotificationEnabled(Boolean(notif.enabled));
      setNotifyEmail(Boolean(notif.channels?.email));
      setNotifySMS(Boolean(notif.channels?.sms && data.phoneNumber));
      setFavoriteZones(data.favoriteZones || []);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = displayName.trim();
    if (!trimmedName) { setError("닉네임을 입력해 주세요."); return; }

    const snapshot = await getDocs(query(collection(db, "users"), where("displayName", "==", trimmedName)));
    if (snapshot.docs.some((d) => d.id !== user.uid)) { setError("이미 사용 중인 닉네임입니다."); return; }

    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: trimmedName, email: contactEmail.trim(),
        phoneNumber: phoneNumber.trim() || null,
        notification: { enabled: notificationEnabled, channels: { email: notificationEnabled ? notifyEmail : false, sms: notificationEnabled ? (notifySMS && Boolean(phoneNumber.trim())) : false } },
        favoriteZones, updatedAt: serverTimestamp(),
      }, { merge: true });
      if (user.displayName !== trimmedName) await updateProfile(user, { displayName: trimmedName });
      setMessage("설정이 저장되었습니다.");
    } catch { setError("설정을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  };

  const handleTestNotification = async () => {
    if (!user) return;
    setTesting(true);
    try {
      const result = await sendStageNotification({ userId: user.uid, zoneId: favoriteZones[0] || DEFAULT_ZONE_SLUG, title: "단계 변경 알림 테스트", body: "설정한 채널로 단계 변경 알림이 도착합니다.", safeMode: true });
      if (result.sent) setMessage("테스트 알림이 생성되었습니다!");
      else setError("알림 생성에 실패했습니다.");
    } catch { setError("알림 생성에 실패했습니다."); }
    finally { setTesting(false); }
  };

  if (initializing || !user) return null;

  return (
    <div className="account-settings">
      <header className="account-header">
        <div>
          <p className="account-label">계정 관리</p>
          <h1>프로필 · 알림 설정</h1>
          <p>연락처와 알림 채널을 관리하고 테스트 알림을 확인할 수 있습니다.</p>
        </div>
        <button onClick={() => navigate("/mypage")}>마이페이지로 이동</button>
      </header>
      <section className="account-card">
        <form onSubmit={handleSubmit}>
          <div className="account-form-grid">
            <div className="account-form-section">
              <p className="section-label">기본 정보</p>
              <label className="account-field"><span>닉네임</span><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required disabled={saving} /></label>
              <label className="account-field"><span>이메일</span><input type="email" value={contactEmail} disabled /></label>
              <label className="account-field"><span>휴대전화번호</span><input type="tel" placeholder="'-' 없이 숫자만 입력" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></label>
            </div>
            <div className="account-form-section">
              <p className="section-label">알림 설정</p>
              <label className="consent-checkbox"><input type="checkbox" checked={notificationEnabled} onChange={() => setNotificationEnabled((p) => !p)} />알림 전체 켜기</label>
              <div className="consent-depth">
                <label className="consent-checkbox"><input type="checkbox" checked={notifyEmail} disabled={!notificationEnabled} onChange={() => setNotifyEmail((p) => !p)} />이메일 알림</label>
                <label className="consent-checkbox"><input type="checkbox" checked={notifySMS} disabled={!notificationEnabled} onChange={() => { if (!phoneNumber.trim()) { setChannelWarning("문자 알림을 받으려면 휴대전화 번호를 먼저 입력해주세요."); return; } setNotifySMS((p) => !p); }} />문자 알림</label>
              </div>
              <div className="account-test-card">
                <p>설정 확인</p>
                <button type="button" disabled={!notificationEnabled || testing} onClick={handleTestNotification}>{testing ? "테스트 중..." : "테스트 알림 보내기"}</button>
              </div>
            </div>
          </div>
          {error && <div className="account-error">{error}</div>}
          {message && <div className="account-success">{message}</div>}
          <div className="account-actions">
            <button type="submit" className="primary" disabled={saving}>{saving ? "저장 중..." : "설정 저장"}</button>
            <button type="button" className="ghost" onClick={() => navigate("/mypage")}>마이페이지로 돌아가기</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AccountSettings;
