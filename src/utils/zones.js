// 커뮤니티/마이페이지/지도에서 공통으로 사용하는 정비구역 목록.
// slug: URL 식별자 (DB의 post.zoneId 와 일치해야 함)
// name: UI 표시명
export const FIXED_ZONES = [
  { slug: "hannam-masterplan", name: "한남 지구단위계획구역" },
  { slug: "itaewon-masterplan", name: "이태원로 주변 지구단위계획구역" },
  { slug: "hannam-foreigner", name: "한남외인주택부지" },
  { slug: "hannam3-redev", name: "한남3재정비촉진구역" },
  { slug: "hannam4-redev", name: "한남4재정비촉진구역" },
  { slug: "hannam5-redev", name: "한남5재정비촉진구역" },
];

export const DEFAULT_ZONE_SLUG = FIXED_ZONES[3].slug; // hannam3-redev

// 게시글 zoneId/zoneSlug/zone 필드 어느 쪽이든 안전하게 꺼내는 헬퍼
export function getPostZoneSlug(post) {
  if (!post) return "";
  return post.zoneId || post.zoneSlug || post.zone || "";
}

// id 가 정확한 slug 가 아닐 수도 있어 부분일치까지 허용해 표시명을 찾는다
export function readableZoneName(id) {
  if (!id) return "구역 미지정";
  const norm = String(id).replace(/\s+/g, "").toLowerCase();
  const matched = FIXED_ZONES.find((zone) => {
    const s = zone.slug.replace(/\s+/g, "").toLowerCase();
    const n = zone.name.replace(/\s+/g, "").toLowerCase();
    return s === norm || n === norm || s.includes(norm) || norm.includes(s) || n.includes(norm) || norm.includes(n);
  });
  return matched?.name || id;
}
