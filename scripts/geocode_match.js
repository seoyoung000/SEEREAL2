/**
 * cleanup_stages.json의 대표지번을 카카오 Geocoding으로 좌표 변환
 * → GeoJSON 폴리곤 안에 들어가는 프로젝트 매칭
 * → polygon_stage_map.json 저장
 *
 * 실행: node scripts/geocode_match.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const KAKAO_REST_KEY = "4f20dcab216380720edfc865e616eada";
const DATA_DIR = path.join(__dirname, "../src/data");
const stages = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "cleanup_stages.json"), "utf-8"));
const geojson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "LSMD_CONT_UD602_11_202603.json"), "utf-8"));

// ── Ray-casting Point-in-Polygon ─────────────────────────
function pointInPolygon(point, ring) {
  const [px, py] = [point.lng, point.lat];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findFeatureIndex(lat, lng) {
  for (let i = 0; i < geojson.features.length; i++) {
    const geom = geojson.features[i].geometry;
    if (!geom) continue;
    const rings =
      geom.type === "MultiPolygon"
        ? geom.coordinates.flat(1)
        : geom.coordinates;
    for (const ring of rings) {
      if (pointInPolygon({ lat, lng }, ring)) return i;
    }
  }
  return -1;
}

// ── Kakao Geocoding ───────────────────────────────────────
function geocode(address) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(address.replace(/\s*일대.*$/, "").trim());
    const options = {
      hostname: "dapi.kakao.com",
      path: `/v2/local/search/address.json?query=${query}&size=1`,
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const doc = json.documents?.[0];
          if (doc) resolve({ lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
          else resolve(null);
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  const resultMap = {}; // featureIndex → stageInfo
  let success = 0, fail = 0;

  for (let i = 0; i < stages.length; i++) {
    const row = stages[i];
    const addr = `서울시 ${row.자치구} ${row.대표지번}`;
    process.stdout.write(`\r[${i + 1}/${stages.length}] ${addr.slice(0, 40).padEnd(40)}`);

    const coord = await geocode(addr);
    if (coord) {
      const idx = findFeatureIndex(coord.lat, coord.lng);
      if (idx >= 0) {
        // 같은 폴리곤에 여러 항목이면 최신(진행단계 우선) 덮어쓰기
        resultMap[idx] = {
          사업장명: row.사업장명,
          진행단계: row.진행단계,
          사업구분: row.사업구분,
          자치구: row.자치구,
          대표지번: row.대표지번,
        };
        success++;
      } else {
        fail++;
      }
    } else {
      fail++;
    }

    await sleep(50); // 초당 20건으로 제한
  }

  console.log(`\n\n완료: 매칭 성공 ${success}건 / 실패 ${fail}건`);
  const outPath = path.join(DATA_DIR, "polygon_stage_map.json");
  fs.writeFileSync(outPath, JSON.stringify(resultMap, null, 2), "utf-8");
  console.log("저장:", outPath);
}

main().catch(console.error);
