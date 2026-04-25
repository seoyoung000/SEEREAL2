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
const HOUSEHOLD_KEYS = ["households", "HOUSEHOLDS", "owner_cnt", "house_cnt", "HOUSE_CNT", "TOT_HSHD", "TOT_HOUSE"];

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
  // 서울 전체를 커버하는 초기 bounds (onCreate 호출 불필요)
  const [mapBounds, setMapBounds] = useState({
    swLat: 37.40, swLng: 126.78,
    neLat: 37.70, neLng: 127.20,
    level: 5,
  });
  const [zoneFeatures] = useState(zoneData.features || []);

  const mapRef = useRef(null);

  // ── 1. 폴리곤 데이터 사전 계산 (마운트 1회) ──────────────
  const allPolygons = useMemo(() => {
    const stageLookup = {};
    stageData.forEach((row) => {
      const key = row.사업장명?.replace(/\s+/g, "").toLowerCase();
      if (key) stageLookup[key] = row;
    });

    return zoneFeatures.map((feature, idx) => {
      const geom = feature.geometry;
      if (!geom) return null;

      const rings = geom.type === "MultiPolygon"
        ? geom.coordinates.flat(1)
        : geom.coordinates;

      const props = feature.properties || {};
      const alias = getValueFromKeys(props, NAME_KEYS);
      const aliasKey = alias?.replace(/\s+/g, "").toLowerCase();
      const info = polygonStageMap[String(idx)] || (aliasKey ? stageLookup[aliasKey] : null);
      const color = getStageColor(info?.진행단계);

      // 바운딩 박스 계산
      const allCoords = rings.flat();
      const lats = allCoords.map(([, lat]) => lat);
      const lngs = allCoords.map(([lng]) => lng);
      const bbox = {
        minLat: Math.min(...lats), maxLat: Math.max(...lats),
        minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
      };

      const paths = rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
      const panelInfo = {
        name: info?.사업장명 || alias,
        area: toNumberOrNull(getValueFromKeys(props, AREA_KEYS)),
        type: info?.사업구분 || "정비구역",
        stage: info?.진행단계,
        district: info?.자치구,
        location: info?.대표지번,
      };

      return { idx, paths, color, bbox, panelInfo };
    }).filter(Boolean);
  }, [zoneFeatures]);

  // ── 2. 뷰포트 컬링 ────────────────────────────────────────
  const visiblePolygons = useMemo(() => {
    if (mapBounds.level >= 9) return [];

    const { swLat, swLng, neLat, neLng } = mapBounds;
    // 약간의 여유(padding) 추가
    const pad = 0.02;
    return allPolygons.filter(({ bbox }) =>
      bbox.maxLat >= swLat - pad &&
      bbox.minLat <= neLat + pad &&
      bbox.maxLng >= swLng - pad &&
      bbox.minLng <= neLng + pad
    );
  }, [allPolygons, mapBounds, mapLevel]);

  // ── 3. 지도 이동/줌 시 bounds 갱신 (level 포함, setState 1회) ──
  const updateBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    setMapBounds({
      swLat: sw.getLat(), swLng: sw.getLng(),
      neLat: ne.getLat(), neLng: ne.getLng(),
      level: map.getLevel(),
    });
  }, []);

  useEffect(() => {
    loadKakaoSdk(kakaoAppKey)
      .then(() => setKakaoReady(true))
      .catch((err) => console.error(err));
  }, []);

  // ---------------------------
  // 검색
  // ---------------------------
  const normalize = useCallback((v) => v?.replace(/\s+/g, "").toLowerCase() || "", []);

  const handleSearch = () => {
    const term = keyword.trim();
    if (!term) return alert("이름을 입력하세요");
    const norm = normalize(term);

    const matchPolygon = allPolygons.find(({ panelInfo }) =>
      normalize(panelInfo.name || "").includes(norm) || norm.includes(normalize(panelInfo.name || ""))
    );

    if (matchPolygon) {
      const firstPath = matchPolygon.paths[0];
      const centroid = {
        lat: firstPath.reduce((s, p) => s + p.lat, 0) / firstPath.length,
        lng: firstPath.reduce((s, p) => s + p.lng, 0) / firstPath.length,
      };
      setPanelData({ ...matchPolygon.panelInfo, coords: firstPath });
      setPanelType("zone");
      setIsOpen(true);
      setMapCenter(centroid);
      setMapLevel(4);
      return;
    }

    const matchStage = stageData.find((row) =>
      normalize(row.사업장명 || "").includes(norm) || norm.includes(normalize(row.사업장명 || ""))
    );
    if (matchStage) {
      setPanelData({
        name: matchStage.사업장명,
        type: matchStage.사업구분,
        stage: matchStage.진행단계,
        district: matchStage.자치구,
        location: matchStage.대표지번,
      });
      setPanelType("zone");
      setIsOpen(true);
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
        <KakaoMap
          center={mapCenter}
          level={mapLevel}
          style={{ width: "100%", height: "100%" }}
          onCreate={(map) => {
            mapRef.current = map;
          }}
          onDragEnd={updateBounds}
          onZoomChanged={updateBounds}
        >
          {visiblePolygons.map(({ idx, paths, color, panelInfo }) =>
            paths.map((path, rIdx) => (
              <Polygon
                key={`zone-${idx}-${rIdx}`}
                path={path}
                strokeWeight={2}
                strokeColor={color}
                strokeOpacity={0.8}
                fillColor={color}
                fillOpacity={0.2}
                onClick={() => {
                  setPanelData(panelInfo);
                  setPanelType("zone");
                  setIsOpen(true);
                }}
              />
            ))
          )}

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
        </KakaoMap>
      </div>

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
