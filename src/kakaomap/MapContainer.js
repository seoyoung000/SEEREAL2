import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Map, Polygon, Circle } from "react-kakao-maps-sdk";
import InfoPanel from "./InfoPanel";
import "./InfoPanel.css";
import "./MapContainer.css";

import lsmdData from "../data/LSMD_CONT_UD602_11_202603.json";

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
      kakaoLoaderPromise = null; // 실패 시 캐시 초기화 (재시도 가능)
      reject(new Error("Failed to load Kakao SDK"));
    };
    document.head.appendChild(script);
  });

  return kakaoLoaderPromise;
}

const kakaoAppKey = process.env.REACT_APP_KAKAO_JS_KEY || process.env.REACT_APP_KAKAO_APP_KEY;

const defaultCenter = { lat: 37.531, lng: 127.0039 };

const AREA_KEYS = ["area", "AREA", "land_area", "plan_area", "DGM_AR", "SHAPE_AREA"];
const HOUSEHOLD_KEYS = [
  "households", "HOUSEHOLDS", "owner_cnt", "house_cnt",
  "HOUSE_CNT", "TOT_HSHD", "TOT_HOUSE",
];
const TYPE_KEYS = ["type", "TYPE", "category", "plan_type", "zone_category", "LCLAS_CL"];
const STAGE_KEYS = ["stage", "STAGE", "status", "STATUS", "progress", "zone_category", "LCLAS_CL"];
const NAME_KEYS = ["name", "NAME", "title", "TITLE", "zone_name", "DGM_NM"];

const getValueFromKeys = (source, keys) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ======================================================
//                 MAIN COMPONENT
// ======================================================
function MapContainer({ title, height }) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [panelType, setPanelType] = useState("zone");
  const [panelData, setPanelData] = useState({});
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapLevel, setMapLevel] = useState(5);
  const [circleCenter, setCircleCenter] = useState(null);

  const mapRef = useRef(null);

  useEffect(() => {
    loadKakaoSdk(kakaoAppKey)
      .then(() => setKakaoReady(true))
      .catch((err) => console.error(err));
  }, []);

  const lsmdPolygons = useMemo(() => {
    return Array.isArray(lsmdData?.features) ? lsmdData.features : [];
  }, []);

  // ---------------------------
  // 검색 함수
  // ---------------------------
  const normalize = useCallback(
    (v) => v?.replace(/\s+/g, "").toLowerCase() || "",
    []
  );

  const handleSearch = () => {
    const term = keyword.trim();
    if (!term) return alert("이름을 입력하세요");
    const norm = normalize(term);

    const matchFeature = lsmdPolygons.find((f) => {
      const props = f.properties || {};
      const name = getValueFromKeys(props, NAME_KEYS) || "";
      return normalize(name).includes(norm) || norm.includes(normalize(name));
    });

    if (matchFeature) {
      const geom = matchFeature.geometry;
      const ring = geom.type === "MultiPolygon"
        ? geom.coordinates[0][0]
        : geom.coordinates[0];
      const path = ring.map(([lng, lat]) => ({ lat, lng }));
      const centroid = {
        lat: ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length,
        lng: ring.reduce((sum, [lng]) => sum + lng, 0) / ring.length,
      };
      const props = matchFeature.properties || {};

      setPanelData({
        name: getValueFromKeys(props, NAME_KEYS),
        area: toNumberOrNull(getValueFromKeys(props, AREA_KEYS)),
        type: getValueFromKeys(props, TYPE_KEYS) || "정비구역",
        stage: getValueFromKeys(props, STAGE_KEYS),
        households: toNumberOrNull(getValueFromKeys(props, HOUSEHOLD_KEYS)),
        coords: path,
      });
      setPanelType("zone");
      setIsOpen(true);
      setMapCenter(centroid);
      setMapLevel(4);
      return;
    }

    alert("검색 결과 없음");
  };

  // ---------------------------
  // Render
  // ---------------------------
  if (!kakaoAppKey) return <div>API KEY ERROR</div>;
  if (!kakaoReady) return <div>지도 로딩 중...</div>;

  return (
    <section className="map-fullscreen" style={{ height: height || "100vh" }}>
      <div className="map-fullscreen__canvas">
        <Map
          center={mapCenter}
          level={mapLevel}
          style={{ width: "100%", height: "100%" }}
          onCreate={(map) => (mapRef.current = map)}
        >

          {lsmdPolygons.map((feature, idx) => {
            const geom = feature.geometry;
            if (!geom) return null;

            const rings = geom.type === "MultiPolygon"
              ? geom.coordinates.flat(1)
              : geom.coordinates;

            return rings.map((ring, rIdx) => (
              <Polygon
                key={`lsmd-${idx}-${rIdx}`}
                path={ring.map(([lng, lat]) => ({ lat, lng }))}
                strokeWeight={2}
                strokeColor="#0055FF"
                strokeOpacity={0.8}
                fillColor="#0055FF"
                fillOpacity={0.15}
              />
            ));
          })}

          {circleCenter && (
            <Circle
              center={circleCenter}
              radius={500}
              strokeWeight={2}
              strokeColor="#4A90D9"
              strokeOpacity={0.8}
              fillColor="#4A90D9"
              fillOpacity={0.15}
            />
          )}
        </Map>
      </div>

      {/* 상단 검색 UI */}
      <div className="map-overlay-stack">
        <div className="map-overlay-card">
          <p className="map-overlay-eyebrow">SEE:REAL</p>
          <h2>{title || "재개발 구역 통합 지도"}</h2>
          <div className="map-search-row">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="구역명 검색"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch}>검색</button>
          </div>
        </div>

        {/* 정보 패널 */}
        <div className={`map-info-panel${isOpen ? " open" : ""}`}>
          <InfoPanel
            type={panelType}
            data={panelData}
            onClose={() => { setIsOpen(false); setCircleCenter(null); }}
          />
        </div>
      </div>
    </section>
  );
}

export default MapContainer;
