import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, startAfter } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { FIXED_ZONES, getPostZoneSlug } from "../utils/zones";
import "./CommunityList.css";

const CATEGORY_TABS = ["전체", "공지", "정보공유", "질문", "후기"];
const PAGE_SIZE = 10;
const MAX_PAGE_BTNS = 5;

function CommunityList() {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [zoneFilter, setZoneFilter] = useState(zoneId || "");
  const [posts, setPosts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [pendingMore, setPendingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortOrder, setSortOrder] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const lastDocRef = useRef(null);

  const fetchPosts = useCallback(async (reset = false) => {
    try {
      if (reset) { setLoading(true); lastDocRef.current = null; setHasMore(true); }
      else setPendingMore(true);

      const constraints = [orderBy("createdAt", "desc")];
      if (!reset && lastDocRef.current) constraints.push(startAfter(lastDocRef.current));
      constraints.push(limit(PAGE_SIZE));

      const snapshot = await getDocs(query(collection(db, "posts"), ...constraints));
      if (snapshot.docs.length > 0) lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];

      const incoming = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts((prev) => (reset ? incoming : [...prev, ...incoming]));
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setPendingMore(false);
    }
  }, []);

  useEffect(() => { setPosts([]); setCurrentPage(1); fetchPosts(true); }, [zoneFilter, fetchPosts]);
  useEffect(() => { setZoneFilter(zoneId || ""); }, [zoneId]);

  const uniquePosts = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => map.set(p.id, p));
    return [...map.values()];
  }, [posts]);

  const filteredPosts = useMemo(() => uniquePosts.filter((post) => {
    const matchCategory = activeCategory === "전체" || activeCategory === post.category;
    const matchZone = !zoneFilter || getPostZoneSlug(post) === zoneFilter;
    return matchCategory && matchZone;
  }), [uniquePosts, activeCategory, zoneFilter]);

  const sortedPosts = useMemo(() => {
    const list = [...filteredPosts];
    list.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || 0;
      const dateB = b.createdAt?.toDate?.() || 0;
      if (sortOrder === "views") return (b.views || 0) - (a.views || 0);
      if (sortOrder === "comments") return (b.commentCount || 0) - (a.commentCount || 0);
      return dateB - dateA;
    });
    return list;
  }, [filteredPosts, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / PAGE_SIZE));
  const groupIndex = Math.floor((currentPage - 1) / MAX_PAGE_BTNS);
  const groupStart = groupIndex * MAX_PAGE_BTNS + 1;
  const groupEnd = Math.min(groupStart + MAX_PAGE_BTNS - 1, totalPages);

  const visiblePosts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedPosts.slice(start, start + PAGE_SIZE);
  }, [sortedPosts, currentPage]);

  return (
    <div className="list-container">
      <div className="list-heading">
        <div>
          <p className="zone-label">SEE:REAL</p>
          <h1 className="list-title">SEE:REAL 커뮤니티</h1>
          <p className="list-description">실시간으로 공유되는 지역 소식과 경험을 확인해 보세요.</p>
        </div>
      </div>

      <div className="list-controls">
        <div className="filters">
          <div className="list-tabs">
            {CATEGORY_TABS.map((c) => (
              <button key={c} className={`tab-btn ${activeCategory === c ? "active" : ""}`}
                onClick={() => { setActiveCategory(c); setCurrentPage(1); }}>
                {c}
              </button>
            ))}
          </div>
          <div className="zone-tabs">
            <button className={`tab-btn ${zoneFilter === "" ? "active" : ""}`} onClick={() => navigate("/community")}>전체</button>
            {FIXED_ZONES.map((z) => (
              <button key={z.slug} className={`tab-btn ${zoneFilter === z.slug ? "active" : ""}`}
                onClick={() => navigate(`/community/${z.slug}`)}>
                {z.name}
              </button>
            ))}
          </div>
        </div>
        <div className="list-actions">
          <div className="sort-wrapper">
            <span>정렬</span>
            <select className="sort-select" value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}>
              <option value="latest">최신순</option>
              <option value="views">조회순</option>
              <option value="comments">댓글순</option>
            </select>
          </div>
          <button type="button" className="write-inline-btn"
            onClick={() => navigate(`/community/${zoneFilter || "hannam-masterplan"}/write`)}>
            작성
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>번호</th>
              <th>제목</th>
              <th style={{ width: "15%" }}>작성자</th>
              <th style={{ width: "15%" }}>작성일</th>
              <th style={{ width: "10%" }}>조회수</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="empty-text">불러오는 중입니다...</td></tr>
            ) : visiblePosts.length === 0 ? (
              <tr><td colSpan="5" className="empty-text">선택한 조건에 해당하는 글이 없습니다.</td></tr>
            ) : (
              visiblePosts.map((post, idx) => {
                const createdAt = post.createdAt?.toDate?.().toLocaleDateString("ko-KR") || "-";
                return (
                  <tr key={post.id}>
                    <td>{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="title-cell">
                      <Link to={`/post/${post.id}`}>
                        <span className="category-chip">{post.category}</span>
                        <span className="zone-chip">{FIXED_ZONES.find((z) => z.slug === getPostZoneSlug(post))?.name}</span>
                        <span className="title-text">{post.title}</span>
                      </Link>
                    </td>
                    <td>{post.author || "회원"}</td>
                    <td>{createdAt}</td>
                    <td>{post.views || 0}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div className="pagination">
          <div className="page-numbers">
            <button type="button" className="page-arrow" disabled={groupStart <= 1} onClick={() => setCurrentPage(groupStart - 1)}>&lt;</button>
            {Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i).map((page) => (
              <button type="button" key={page} className={currentPage === page ? "active" : ""} onClick={() => setCurrentPage(page)}>{page}</button>
            ))}
            <button type="button" className="page-arrow" disabled={groupEnd >= totalPages} onClick={() => setCurrentPage(groupEnd + 1)}>&gt;</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityList;
