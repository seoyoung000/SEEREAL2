import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, collectionGroup, deleteDoc, doc, arrayRemove, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { readableZoneName } from "../utils/zones";
import "./MyPage.css";

const formatDateTime = (timestamp, withTime = false) => {
  if (!timestamp) return "-";
  try {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("ko-KR", withTime ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" } : { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return "-"; }
};

function MyPage() {
  const navigate = useNavigate();
  const { user, initializing, logout } = useAuth();

  const [favoriteZoneIds, setFavoriteZoneIds] = useState([]);
  const [notificationPrefs, setNotificationPrefs] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userComments, setUserComments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingSections, setLoadingSections] = useState({ favorites: true, posts: true, comments: true, notifications: true });
  const [accountError, setAccountError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [hideReadNotifications, setHideReadNotifications] = useState(false);

  useEffect(() => {
    if (!initializing && !user) navigate("/login", { replace: true, state: { from: "/mypage" } });
  }, [initializing, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoadingSections({ favorites: true, posts: true, comments: true, notifications: true });
    const markReady = (key) => setLoadingSections((prev) => ({ ...prev, [key]: false }));
    const unsubscribes = [];

    unsubscribes.push(onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      setFavoriteZoneIds(Array.isArray(data?.favoriteZones) ? data.favoriteZones : []);
      setNotificationPrefs(data?.notification || null);
      markReady("favorites");
    }, () => markReady("favorites")));

    unsubscribes.push(onSnapshot(
      query(collection(db, "posts"), where("authorId", "==", user.uid), orderBy("createdAt", "desc"), limit(5)),
      (snap) => { setUserPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); markReady("posts"); },
      () => markReady("posts")
    ));

    unsubscribes.push(onSnapshot(
      query(collectionGroup(db, "comments"), where("authorId", "==", user.uid), orderBy("createdAt", "desc"), limit(5)),
      async (snap) => {
        const list = [];
        for (const docSnap of snap.docs) {
          const postId = docSnap.ref.parent.parent?.id;
          if (!postId) { await deleteDoc(docSnap.ref); continue; }
          list.push({ id: docSnap.id, postId, ...docSnap.data() });
        }
        setUserComments(list);
        markReady("comments");
      },
      () => markReady("comments")
    ));

    unsubscribes.push(onSnapshot(
      query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"), limit(6)),
      (snap) => { setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data(), read: d.data().read === true }))); markReady("notifications"); },
      () => markReady("notifications")
    ));

    return () => unsubscribes.forEach((u) => u());
  }, [user]);

  useEffect(() => {
    if (!user) { sessionStorage.setItem("seereal-has-notifications", "0"); window.dispatchEvent(new Event("seereal-notification-update")); return; }
    const hasUnread = notifications.some((n) => !n.read);
    sessionStorage.setItem("seereal-has-notifications", hasUnread ? "1" : "0");
    window.dispatchEvent(new Event("seereal-notification-update"));
  }, [notifications, user]);

  const joinDate = useMemo(() => { if (!user?.metadata?.creationTime) return "-"; return formatDateTime(user.metadata.creationTime); }, [user]);
  const profileAvatar = useMemo(() => { if (user?.photoURL) return user.photoURL; const name = user?.displayName || user?.email || "SEE REAL"; return `https://ui-avatars.com/api/?background=2268a0&color=fff&name=${encodeURIComponent(name)}`; }, [user]);

  const favoriteZoneList = useMemo(() => favoriteZoneIds.map((zoneId, index) => ({ id: zoneId, name: readableZoneName(zoneId), order: index + 1 })), [favoriteZoneIds]);

  const filteredNotifications = useMemo(() => hideReadNotifications ? notifications.filter((n) => !n.read) : notifications, [notifications, hideReadNotifications]);

  const handleRemoveFavorite = async (zoneId) => {
    if (!user || !zoneId) return;
    if (!window.confirm("해당 관심 구역을 삭제할까요?")) return;
    try { await updateDoc(doc(db, "users", user.uid), { favoriteZones: arrayRemove(zoneId) }); }
    catch { alert("관심 구역을 삭제하지 못했습니다."); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm("정말 탈퇴하시겠습니까? 작성한 게시글과 댓글이 모두 삭제됩니다.")) return;
    setDeletingAccount(true);
    try {
      const postsSnap = await getDocs(query(collection(db, "posts"), where("authorId", "==", user.uid)));
      for (const post of postsSnap.docs) {
        const commentsSnap = await getDocs(collection(db, "posts", post.id, "comments"));
        await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)));
        await deleteDoc(post.ref);
      }
      const commentSnap = await getDocs(query(collectionGroup(db, "comments"), where("authorId", "==", user.uid)));
      for (const c of commentSnap.docs) await deleteDoc(c.ref);
      const notifSnap = await getDocs(collection(db, "users", user.uid, "notifications"));
      await Promise.all(notifSnap.docs.map((n) => deleteDoc(n.ref)));
      await deleteDoc(doc(db, "users", user.uid));
      await user.delete();
      navigate("/", { replace: true });
    } catch { setAccountError("탈퇴 중 오류가 발생했습니다. 다시 시도해주세요."); }
    finally { setDeletingAccount(false); }
  };

  const handleNotificationClick = async (notification) => {
    if (!user) return;
    try { if (!notification.read) await updateDoc(doc(db, "users", user.uid, "notifications", notification.id), { read: true }); }
    catch {}
    navigate(notification?.targetUrl || "/community");
  };

  const handleDeleteNotification = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, "users", user.uid, "notifications", id)); setNotifications((prev) => prev.filter((n) => n.id !== id)); }
    catch {}
  };

  const handleDeleteAllNotifications = async () => {
    if (!user || !window.confirm("모든 알림을 삭제할까요?")) return;
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "notifications"));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      setNotifications([]);
    } catch {}
  };

  if (initializing || !user) {
    return (
      <div className="mypage-container">
        <section className="mypage-locked">
          <h2>회원 전용 페이지</h2>
          <p>로그인 이후 접근할 수 있습니다.</p>
          <button onClick={() => navigate("/login")}>로그인</button>
        </section>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <section className="profile-card">
        <div className="profile-info">
          <img src={profileAvatar} alt="profile" />
          <div>
            <p className="profile-label">SEE:REAL MEMBER</p>
            <h1>{user.displayName || "회원"}</h1>
            <p className="profile-email">{user.email}</p>
            <div className="profile-meta">
              <span>가입일 {joinDate}</span>
              <span>최근 접속 {formatDateTime(Date.now(), true)}</span>
            </div>
          </div>
        </div>
        <div className="profile-actions">
          <button onClick={() => navigate("/account-settings")}>계정 관리</button>
          <button className="outline" onClick={logout}>로그아웃</button>
          <button className="danger" onClick={handleDeleteAccount} disabled={deletingAccount}>{deletingAccount ? "탈퇴 중..." : "탈퇴하기"}</button>
        </div>
      </section>

      <section className="quick-stats">
        <div><strong>{favoriteZoneIds.length}</strong><span>관심 구역</span></div>
        <div><strong>{userPosts.length}</strong><span>작성 글</span></div>
        <div><strong>{userComments.length}</strong><span>작성 댓글</span></div>
        <div><strong>{notifications.length}</strong><span>알림</span></div>
      </section>

      <section className="mypage-section">
        <div className="section-heading">
          <div><p className="section-label">나의 관심 구역</p><h2>즐겨찾은 정비/단지 목록</h2></div>
          <button type="button" onClick={() => navigate("/")}>지도에서 보기</button>
        </div>
        {favoriteZoneList.length === 0 ? (
          <p className="section-empty">아직 관심 구역이 없습니다. 지도에서 마음에 드는 구역을 등록해 보세요.</p>
        ) : (
          <div className="favorite-grid">
            {favoriteZoneList.map((zone) => (
              <div className="favorite-card" key={`${zone.id}-${zone.order}`}>
                <div className="favorite-card-header">
                  <span># {zone.order}</span>
                  <button type="button" className="favorite-remove" onClick={() => handleRemoveFavorite(zone.id)}>삭제</button>
                </div>
                <p className="favorite-stage">{zone.name}</p>
                <div className="favorite-meta">
                  <div><span>알림 상태</span><strong>{notificationPrefs?.enabled ? "ON" : "OFF"}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mypage-section">
        <div className="section-heading">
          <div><p className="section-label">커뮤니티 활동</p><h2>내 게시글과 댓글 이력</h2></div>
          <Link to="/community">전체 보기</Link>
        </div>
        <div className="activity-grid">
          <div className="activity-column">
            <div className="activity-header"><h3>작성한 게시글</h3></div>
            {userPosts.length === 0 ? <p className="section-empty small">작성한 글이 없습니다.</p> : (
              userPosts.slice(0, 3).map((post) => (
                <Link key={post.id} to={`/post/${post.id}`} className="activity-item">
                  <div>
                    <p className="activity-title">{post.title}</p>
                    <span className="activity-meta">{readableZoneName(post.zoneId)} · {formatDateTime(post.createdAt)}</span>
                  </div>
                  <span className="activity-badge">조회 {post.views || 0} · 댓글 {post.commentCount || 0}</span>
                </Link>
              ))
            )}
          </div>
          <div className="activity-column">
            <div className="activity-header"><h3>작성한 댓글</h3></div>
            {userComments.length === 0 ? <p className="section-empty small">댓글이 없습니다.</p> : (
              userComments.slice(0, 3).map((comment) => (
                <Link key={comment.id} to={`/post/${comment.postId}`} className="activity-item">
                  <div>
                    <p className="activity-title">{comment.text}</p>
                    <span className="activity-meta">{formatDateTime(comment.createdAt, true)}</span>
                  </div>
                  <span className="activity-badge subtle">댓글 보기</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mypage-section">
        <div className="section-heading">
          <div><p className="section-label">알림 모음</p><h2>단계 변화 · 댓글 알림</h2></div>
          <div className="notification-actions">
            <button onClick={() => navigate("/account-settings")}>알림 설정</button>
            {notifications.length > 0 && (
              <label className="notification-toggle">
                <input type="checkbox" checked={hideReadNotifications} onChange={() => setHideReadNotifications((prev) => !prev)} />
                읽은 알림 숨기기
              </label>
            )}
            {notifications.length > 0 && <button className="danger" onClick={handleDeleteAllNotifications}>전체 삭제</button>}
          </div>
        </div>
        {filteredNotifications.length === 0 ? (
          <div className="section-empty">{hideReadNotifications ? "읽지 않은 알림이 없습니다." : "아직 받은 알림이 없습니다."}</div>
        ) : (
          <div className="notification-list">
            {filteredNotifications.map((notification) => (
              <div key={notification.id} className={`notification-item${notification.read ? " read" : ""}`} role="button" onClick={() => handleNotificationClick(notification)}>
                <div>
                  <p className="notification-title">{notification.title || "알림"}</p>
                  <p className="notification-body">{notification.body || notification.message || ""}</p>
                </div>
                <div className="notification-meta">
                  <span>{formatDateTime(notification.createdAt, true)}</span>
                  <button className="notification-delete" onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notification.id); }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {accountError && <div className="mypage-alert-error">{accountError}</div>}
    </div>
  );
}

export default MyPage;
