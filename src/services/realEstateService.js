import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// ⚠️ scripts/syncAptPrices.js 의 normName() 과 반드시 동일하게 유지할 것.
// (브라우저 ESM ↔ Node CJS 환경 차이로 공유 import 가 어려워 이중 정의)
function normName(name) {
  return String(name)
    .replace(/\s+/g, "")
    .replace(/아파트$/, "")   // 끝의 "아파트" 제거
    .replace(/[^\w가-힣]/g, "")
    .toLowerCase();
}

// Firestore apt_prices/{normName} 에서 대표 가격 조회
export async function getAptPrice(aptName) {
  const key = normName(aptName);
  if (key.length < 2) return null;
  try {
    const snap = await getDoc(doc(db, "apt_prices", key));
    if (!snap.exists()) return null;
    return snap.data().representative || null;
  } catch {
    return null;
  }
}
