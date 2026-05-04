const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const SEOUL_KEY = process.env.SEOUL_API_KEY;
const SVC = "tbLnOpendataRtmsV";
const PAGE_SIZE = 1000;

async function fetchPage(start, end) {
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/${SVC}/${start}/${end}/`;
  const res = await fetch(url);
  return res.json();
}

function normName(name) {
  return String(name).replace(/\s+/g, "").replace(/[^\w가-힣]/g, "").toLowerCase();
}

function toPyeong(sqm) {
  return Math.round(parseFloat(sqm) / 3.3058);
}

async function main() {
  // 총 건수 확인
  const first = await fetchPage(1, 1);
  const total = first?.[SVC]?.list_total_count || 0;
  console.log(`총 ${total}건`);

  const buildings = {};

  // 전체 페이지 순차 fetch
  const maxPages = process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES) : Infinity;
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), maxPages);
  for (let page = 0; page < totalPages; page++) {
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, total);
    console.log(`Fetching ${start}~${end} ...`);

    const data = await fetchPage(start, end);
    const rows = data?.[SVC]?.row || [];

    rows.forEach((r) => {
      if (r.BLDG_USG !== "아파트") return;
      if (r.RTRCN_DAY) return; // 취소 건 제외

      const key = normName(r.BLDG_NM);
      if (!key || key.length < 2) return;

      if (!buildings[key]) buildings[key] = { name: r.BLDG_NM, areas: {} };

      const area = parseFloat(r.ARCH_AREA).toFixed(1);
      if (!buildings[key].areas[area]) buildings[key].areas[area] = [];
      buildings[key].areas[area].push(parseInt(r.THING_AMT, 10) * 10000); // 만원 → 원
    });

    await new Promise((r) => setTimeout(r, 300)); // rate limit
  }

  // Firestore에 배치 저장
  const keys = Object.keys(buildings);
  console.log(`총 ${keys.length}개 아파트 단지 저장 시작`);

  const BATCH = 400;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = db.batch();
    keys.slice(i, i + BATCH).forEach((key) => {
      const b = buildings[key];
      const sorted = Object.entries(b.areas).sort((a, b) => b[1].length - a[1].length);

      const types = sorted.slice(0, 5).map(([area, prices]) => ({
        area,
        pyeong: toPyeong(area),
        avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
        count: prices.length,
      }));

      batch.set(db.collection("apt_prices").doc(key), {
        name: b.name,
        representative: types[0] || null,
        types,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`${i + Math.min(BATCH, keys.length - i)}/${keys.length} 저장됨`);
  }

  console.log("완료!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
