import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Map as KakaoMap, Polygon, Circle } from "react-kakao-maps-sdk";
import InfoPanel from "./InfoPanel";
import "./InfoPanel.css";
import "./MapContainer.css";
import zoneData from "../data/LSMD_CONT_UD602_11_202603.json";
import stageData from "../data/cleanup_stages.json";
import polygonStageMap from "../data/polygon_stage_map.json";
import apartmentData from "../data/apartments.json";
import { predictProfitability } from "../utils/predictModel";

// ---------------------------
// Kakao SDK Loader
// ---------------------------
let kakaoLoaderPromise = null;

function loadKakaoSdk(appKey) {
  if (!appKey) return Promise.reject();
  if (window.kakao && window.kakao.maps) return Promise.resolve(window.kakao);
  if (kakaoLoaderPromise) return kakaoLoaderPromise;

  kakaoLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${appKey}&libraries=services`;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
      } else {
        reject(new Error("Kakao SDK loaded but window.kakao is missing"));
      }
    };
    script.onerror = () => {
      kakaoLoaderPromise = null;
      reject(new Error("Failed to load Kakao SDK"));
    };
    document.head.appendChild(script);
  });

  return kakaoLoaderPromise;
}

const kakaoAppKey = process.env.REACT_APP_KAKAO_JS_KEY || process.env.REACT_APP_KAKAO_APP_KEY;
const defaultCenter = { lat: 37.531, lng: 127.0039 };

const NAME_KEYS = ["ALIAS", "name", "NAME", "title", "TITLE", "zone_name", "DGM_NM"];
const AREA_KEYS = ["area", "AREA", "land_area", "plan_area", "DGM_AR", "SHAPE_AREA"];

// 진행단계별 색상
const STAGE_COLORS = {
  "정비계획 수립":   "#B0C4FF",
  "정비구역지정":    "#7799FF",
  "안전진단":        "#9999FF",
  "추진위구성":      "#5577EE",
  "추진위원회승인":  "#5577EE",
  "조합규약작성":    "#3366DD",
  "조합창립총회":    "#3366DD",
  "조합원 모집신고": "#3366DD",
  "조합설립인가":    "#0055CC",
  "사업시행인가":    "#FF8800",
  "지구단위계획수립/건축심의/교통심의": "#FF8800",
  "사업계획승인":    "#FF6600",
  "관리처분인가":    "#FF3300",
  "철거":            "#CC0000",
  "철거 및 착공":    "#AA0000",
  "착공":            "#880000",
  "분양":            "#FF66AA",
  "준공인가":        "#00AA44",
  "이전고시":        "#008833",
  "조합해산":        "#888888",
  "조합청산":        "#AAAAAA",
};

function getStageColor(stage) {
  return stage ? (STAGE_COLORS[stage] || "#CCCCCC") : "#CCCCCC";
}

const getValueFromKeys = (source, keys) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const val = source[key];
      if (val !== undefined && val !== null && val !== "") return val;
    }
  }
  return undefined;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// 금액을 억, 만원 단위로 변환하는 함수
const formatKoreanPrice = (val) => {
  if (!val) return "0원";
  if (val >= 100000000) {
    const eok = Math.floor(val / 100000000);
    const remainder = Math.round((val % 100000000) / 10000);
    return remainder > 0 ? `${eok.toLocaleString()}억 ${remainder.toLocaleString()}만원` : `${eok.toLocaleString()}억원`;
  }
  return `${Math.round(val / 10000).toLocaleString()}만원`;
};

const getDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function MapContainer({ title, height }) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [keyword, setKeyword] = useState("");
  
  // 패널별 독립적 상태
  const [isZoneOpen, setIsZoneOpen] = useState(false);
  const [isPredictOpen, setIsPredictOpen] = useState(false);
  const [isNearbyOpen, setIsNearbyOpen] = useState(false);

  const [panelData, setPanelData] = useState({});
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapLevel, setMapLevel] = useState(5);
  const [mapBounds, setMapBounds] = useState({
    swLat: 37.40, swLng: 126.78,
    neLat: 37.70, neLng: 127.20,
    level: 5,
  });
  const [zoneFeatures] = useState(zoneData.features || []);
  const mapRef = useRef(null);

  const allPolygons = useMemo(() => {
    const stageLookup = {};
    stageData.forEach((row) => {
      const key = row.사업장명?.replace(/\s+/g, "").toLowerCase();
      if (key) stageLookup[key] = row;
    });

    return zoneFeatures.map((feature, idx) => {
      const geom = feature.geometry;
      if (!geom) return null;
      const rings = geom.type === "MultiPolygon" ? geom.coordinates.flat(1) : geom.coordinates;
      const props = feature.properties || {};
      const alias = getValueFromKeys(props, NAME_KEYS);
      const aliasKey = alias?.replace(/\s+/g, "").toLowerCase();
      const info = polygonStageMap[String(idx)] || (aliasKey ? stageLookup[aliasKey] : null);
      const color = getStageColor(info?.진행단계);
      const allCoords = rings.flat();
      const lats = allCoords.map(([, lat]) => lat);
      const lngs = allCoords.map(([lng]) => lng);
      const bbox = { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
      const paths = rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
      const panelInfo = { name: info?.사업장명 || alias, area: toNumberOrNull(getValueFromKeys(props, AREA_KEYS)), type: info?.사업구분 || "정비구역", stage: info?.진행단계, district: info?.자치구, location: info?.대표지번 };
      return { idx, paths, color, bbox, panelInfo };
    }).filter(Boolean);
  }, [zoneFeatures]);

  const visiblePolygons = useMemo(() => {
    if (mapBounds.level >= 9) return [];
    const { swLat, swLng, neLat, neLng } = mapBounds;
    const pad = 0.02;
    return allPolygons.filter(({ bbox }) => bbox.maxLat >= swLat - pad && bbox.minLat <= neLat + pad && bbox.maxLng >= swLng - pad && bbox.minLng <= neLng + pad);
  }, [allPolygons, mapBounds]);

  const updateBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    setMapBounds({ swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng(), level: map.getLevel() });
  }, []);

  useEffect(() => {
    loadKakaoSdk(kakaoAppKey).then(() => setKakaoReady(true)).catch((err) => console.error(err));
  }, []);

  const handlePolygonClick = useCallback((panelInfo, paths) => {
    let centerLat, centerLng;
    if (panelInfo.bbox) {
      centerLat = (panelInfo.bbox.minLat + panelInfo.bbox.maxLat) / 2;
      centerLng = (panelInfo.bbox.minLng + panelInfo.bbox.maxLng) / 2;
    } else if (paths && paths[0] && paths[0][0]) {
      centerLat = paths[0][0].lat;
      centerLng = paths[0][0].lng;
    } else {
      centerLat = mapCenter.lat;
      centerLng = mapCenter.lng;
    }

    const zoneName = panelInfo.name || "";
    const selfAptData = apartmentData.find(apt => zoneName.includes(apt.id) || apt.name.includes(zoneName) || zoneName.includes(apt.name.split(' ')[0]));
    const zonePrediction = selfAptData ? predictProfitability(selfAptData.ai_inputs) : null;
    const nearbyApts = apartmentData.map(apt => ({ ...apt, distance: getDistance(centerLat, centerLng, apt.lat, apt.lng), prediction: predictProfitability(apt.ai_inputs || {}) })).filter(apt => apt.distance <= 1.5).sort((a, b) => a.distance - b.distance);

    setPanelData({ ...panelInfo, zonePrediction, matchingApt: selfAptData, nearbyApts });
    setIsZoneOpen(true);
    setIsPredictOpen(!!zonePrediction);
    setIsNearbyOpen(nearbyApts.length > 0);
  }, [mapCenter, apartmentData]);

  const handleSearch = () => {
    const term = keyword.trim();
    if (!term) return alert("이름을 입력하세요");
    const norm = term.replace(/\s+/g, "").toLowerCase();
    const matchPolygon = allPolygons.find(({ panelInfo }) => (panelInfo.name || "").replace(/\s+/g, "").toLowerCase().includes(norm));
    if (matchPolygon) {
      const firstPath = matchPolygon.paths[0];
      setMapCenter({ lat: firstPath[0].lat, lng: firstPath[0].lng });
      setMapLevel(4);
      handlePolygonClick(matchPolygon.panelInfo, matchPolygon.paths);
      return;
    }
    alert("검색 결과 없음");
  };

  if (!kakaoAppKey) return <div>API KEY ERROR</div>;
  if (!kakaoReady) return <div>지도 로딩 중...</div>;

  return (
    <section className="map-fullscreen" style={{ height: height || "100vh" }}>
      <div className="map-fullscreen__canvas">
        <KakaoMap center={mapCenter} level={mapLevel} style={{ width: "100%", height: "100%" }} onCreate={(map) => { mapRef.current = map; }} onDragEnd={updateBounds} onZoomChanged={updateBounds}>
          {visiblePolygons.map(({ idx, paths, color, panelInfo }) => paths.map((path, rIdx) => (
            <Polygon key={`zone-${idx}-${rIdx}`} path={path} strokeWeight={2} strokeColor={color} strokeOpacity={0.8} fillColor={color} fillOpacity={0.2} onClick={() => handlePolygonClick(panelInfo, paths)} />
          )))}
        </KakaoMap>
      </div>

      <div className="map-overlay-stack">
        <div className="map-overlay-card">
          <p className="map-overlay-eyebrow">SEE:REAL</p>
          <h2>{title || "재개발 구역 통합 지도"}</h2>
          <div className="map-search-row">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="구역명 검색" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <button onClick={handleSearch}>검색</button>
          </div>
        </div>

        <div className={`map-info-panel left${isZoneOpen ? " open" : ""}`}>
          <InfoPanel type="zone" data={panelData} onClose={() => setIsZoneOpen(false)} />
        </div>

        <div className={`map-info-panel prediction${isPredictOpen ? " open" : ""}`}>
          <div className="side-panel-container prediction">
            <button className="side-panel-close" onClick={() => setIsPredictOpen(false)}>×</button>
            <div className="side-panel-content">
              <h3 className="side-panel-title">수익성 예측 결과</h3>
              {panelData.zonePrediction && (
                <>
                  <div className="ai-result-card">
                    <div className="ai-result-main">
                      <span className={`ai-direction ${panelData.zonePrediction.direction === "수익성 높음" ? "high" : panelData.zonePrediction.direction === "보통" ? "normal" : "low"}`}>{panelData.zonePrediction.direction}</span>
                      <div className="ai-score">점수: <strong>{panelData.zonePrediction.score}</strong></div>
                    </div>
                    <div className="ai-details">
                      <div className="ai-detail-item"><label>비례율</label><span>{panelData.zonePrediction.predRatio}%</span></div>
                      <div className="ai-detail-item"><label>분담금</label><span>{formatKoreanPrice(panelData.zonePrediction.predCost)}</span></div>
                    </div>
                  </div>
                  <details className="raw-inputs-details" open>
                    <summary>예측 변수 원본 데이터 (X값)</summary>
                    <div className="raw-inputs-grid">
                      <div className="raw-input-item"><label>공시지가</label><span>{formatKoreanPrice(panelData.matchingApt?.ai_inputs.landPrice)}</span></div>
                      <div className="raw-input-item"><label>일반분양</label><span>{panelData.matchingApt?.ai_inputs.generalSales}%</span></div>
                      <div className="raw-input-item"><label>노후도</label><span>{panelData.matchingApt?.ai_inputs.agingDegree}%</span></div>
                      <div className="raw-input-item"><label>실거래가</label><span>{formatKoreanPrice(panelData.matchingApt?.ai_inputs.actualPrice)}</span></div>
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`map-info-panel right${isNearbyOpen ? " open" : ""}`}>
        <div className="side-panel-container">
          <button className="side-panel-close" onClick={() => setIsNearbyOpen(false)}>×</button>
          <div className="side-panel-content">
            <h3 className="side-panel-title">인근 단지 수익성 분석</h3>
            <div className="nearby-list">
              {panelData.nearbyApts && panelData.nearbyApts.map((apt) => (
                <div key={apt.id} className="nearby-item">
                  <div className="nearby-info"><span className="nearby-name">{apt.name}</span><span className="nearby-dist">{(apt.distance * 1000).toFixed(0)}m</span></div>
                  <div className="ai-result-card">
                    <div className="ai-result-main">
                      <span className={`ai-direction ${apt.prediction.direction === "수익성 높음" ? "high" : apt.prediction.direction === "보통" ? "normal" : "low"}`}>{apt.prediction.direction}</span>
                      <div className="ai-score">점수: <strong>{apt.prediction.score}</strong></div>
                    </div>
                    <div className="ai-details">
                      <div className="ai-detail-item"><label>비례율</label><span>{apt.prediction.predRatio}%</span></div>
                      <div className="ai-detail-item"><label>분담금</label><span>{formatKoreanPrice(apt.prediction.predCost)}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MapContainer;
