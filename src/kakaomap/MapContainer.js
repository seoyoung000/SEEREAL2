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
import { formatKoreanPrice } from "../utils/format";
import { getAptPrice } from "../services/realEstateService";

const APT_PREDICTIONS = apartmentData.reduce((acc, apt) => {
  acc[apt.id] = predictProfitability(apt.ai_inputs || {});
  return acc;
}, {});

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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


function MapContainer({ title, height }) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [keyword, setKeyword] = useState("");

  const [isZoneOpen, setIsZoneOpen] = useState(false);
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
  const [circleCenter, setCircleCenter] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
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
      // reduce 사용 — spread는 좌표 수천 개일 때 스택 오버플로우 가능
      const bbox = {
        minLat: lats.reduce((a, b) => (b < a ? b : a), Infinity),
        maxLat: lats.reduce((a, b) => (b > a ? b : a), -Infinity),
        minLng: lngs.reduce((a, b) => (b < a ? b : a), Infinity),
        maxLng: lngs.reduce((a, b) => (b > a ? b : a), -Infinity),
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

  const visiblePolygons = useMemo(() => {
    if (mapBounds.level >= 9) return [];
    const { swLat, swLng, neLat, neLng } = mapBounds;
    const pad = 0.02;
    return allPolygons.filter(
      ({ bbox }) =>
        bbox.maxLat >= swLat - pad &&
        bbox.minLat <= neLat + pad &&
        bbox.maxLng >= swLng - pad &&
        bbox.minLng <= neLng + pad
    );
  }, [allPolygons, mapBounds]);

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

  const PLACE_EXCLUDE = ["후문", "관리사무소", "경비실", "입구", "출입구", "주차장", "상가", "어린이집", "유치원", "경로당", "노인정", "커뮤니티센터", "도서관", "진출입로", "지하주차장", "경비초소"];

  const searchNearbyApartments = useCallback(async (lat, lng) => {
    const svc = window.kakao?.maps?.services;
    if (!svc) return;
    setLoadingPlaces(true);
    setNearbyPlaces([]);

    const places = await new Promise((resolve) => {
      const ps = new svc.Places();
      ps.keywordSearch("아파트", (data, status) => {
        resolve(status === svc.Status.OK ? data : []);
      }, {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 1500,
        sort: svc.SortBy.DISTANCE,
        size: 15,
      });
    });

    const filtered = places.filter((p) => {
      const cat = p.category_name || "";
      if (!cat.includes("아파트")) return false;
      return !PLACE_EXCLUDE.some((kw) => p.place_name.includes(kw));
    });

    const results = await Promise.all(
      filtered.map(async (p) => ({
        name: p.place_name,
        lat: parseFloat(p.y),
        lng: parseFloat(p.x),
        distance: parseInt(p.distance, 10),
        address: p.road_address_name || p.address_name,
        url: p.place_url,
        priceInfo: await getAptPrice(p.place_name),
      }))
    );

    setNearbyPlaces(results);
    setLoadingPlaces(false);
  }, []);

  const handlePolygonClick = useCallback((panelInfo, paths) => {
    let centerLat, centerLng;
    if (panelInfo.bbox) {
      centerLat = (panelInfo.bbox.minLat + panelInfo.bbox.maxLat) / 2;
      centerLng = (panelInfo.bbox.minLng + panelInfo.bbox.maxLng) / 2;
    } else if (paths?.[0]?.[0]) {
      centerLat = paths[0][0].lat;
      centerLng = paths[0][0].lng;
    } else {
      centerLat = mapCenter.lat;
      centerLng = mapCenter.lng;
    }

    const redevApts = apartmentData
      .map((apt) => ({
        ...apt,
        distance: getDistance(centerLat, centerLng, apt.lat, apt.lng),
        prediction: APT_PREDICTIONS[apt.id],
      }))
      .filter((apt) => apt.distance <= 1.5)
      .sort((a, b) => a.distance - b.distance);

    setCircleCenter({ lat: centerLat, lng: centerLng });
    searchNearbyApartments(centerLat, centerLng);
    setPanelData({ ...panelInfo, nearbyApts: redevApts });
    setIsZoneOpen(true);
    setIsNearbyOpen(true);
  }, [mapCenter, searchNearbyApartments]);

  const handleSearch = useCallback(() => {
    const term = keyword.trim();
    if (!term) return alert("이름을 입력하세요");

    // 1차: 정비구역 이름 부분일치
    const norm = term.replace(/\s+/g, "").toLowerCase();
    const matchPolygon = allPolygons.find(({ panelInfo }) =>
      (panelInfo.name || "").replace(/\s+/g, "").toLowerCase().includes(norm)
    );
    if (matchPolygon) {
      const firstPath = matchPolygon.paths[0];
      setMapCenter({ lat: firstPath[0].lat, lng: firstPath[0].lng });
      setMapLevel(4);
      handlePolygonClick({ ...matchPolygon.panelInfo, bbox: matchPolygon.bbox }, matchPolygon.paths);
      return;
    }

    // 2차: 카카오 Places 키워드 검색 (지하철역·아파트·랜드마크·다리 등)
    const svc = window.kakao?.maps?.services;
    if (!svc) return alert("검색 결과 없음");

    const ps = new svc.Places();
    ps.keywordSearch(term, (data, status) => {
      if (status !== svc.Status.OK || !data?.length) {
        return alert("검색 결과 없음");
      }
      const top = data[0];
      const lat = parseFloat(top.y);
      const lng = parseFloat(top.x);

      // 검색 지점 기준 1.5km 내 재개발 완료 단지
      const redevApts = apartmentData
        .map((apt) => ({
          ...apt,
          distance: getDistance(lat, lng, apt.lat, apt.lng),
          prediction: APT_PREDICTIONS[apt.id],
        }))
        .filter((apt) => apt.distance <= 1.5)
        .sort((a, b) => a.distance - b.distance);

      setMapCenter({ lat, lng });
      setMapLevel(4);
      setCircleCenter({ lat, lng });
      setPanelData({
        name: top.place_name,
        address: top.road_address_name || top.address_name,
        nearbyApts: redevApts,
      });
      setIsZoneOpen(false); // 정비구역이 아니므로 좌측 패널은 닫음
      setIsNearbyOpen(true);
      searchNearbyApartments(lat, lng);
    });
  }, [keyword, allPolygons, handlePolygonClick, searchNearbyApartments]);

  if (!kakaoAppKey) return <div>API KEY ERROR</div>;
  if (!kakaoReady) return <div>지도 로딩 중...</div>;

  return (
    <section className="map-fullscreen" style={{ height: height || "100vh" }}>
      <div className="map-fullscreen__canvas">
        <KakaoMap
          center={mapCenter}
          level={mapLevel}
          style={{ width: "100%", height: "100%" }}
          onCreate={(map) => { mapRef.current = map; }}
          onDragEnd={updateBounds}
          onZoomChanged={updateBounds}
        >
          {visiblePolygons.map(({ idx, paths, color, panelInfo, bbox }) =>
            paths.map((path, rIdx) => (
              <Polygon
                key={`zone-${idx}-${rIdx}`}
                path={path}
                strokeWeight={color === "#CCCCCC" ? 1 : 2}
                strokeColor={color}
                strokeOpacity={color === "#CCCCCC" ? 0.5 : 0.8}
                fillColor={color}
                fillOpacity={color === "#CCCCCC" ? 0.08 : 0.2}
                onClick={() => handlePolygonClick({ ...panelInfo, bbox }, paths)}
              />
            ))
          )}
          {circleCenter && (
            <Circle
              center={circleCenter}
              radius={1500}
              strokeWeight={2}
              strokeColor="#2268a0"
              strokeOpacity={0.7}
              strokeStyle="solid"
              fillColor="#2268a0"
              fillOpacity={0.05}
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
              placeholder="구역·역·아파트·장소 검색"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch}>검색</button>
          </div>
        </div>

        <div className={`map-info-panel left${isZoneOpen ? " open" : ""}`}>
          <InfoPanel type="zone" data={panelData} onClose={() => setIsZoneOpen(false)} />
        </div>
      </div>

      <div className={`map-info-panel right${isNearbyOpen ? " open" : ""}`}>
        <div className="side-panel-container">
          <button className="side-panel-close" onClick={() => { setIsNearbyOpen(false); setCircleCenter(null); }}>×</button>
          <div className="side-panel-content">
            <h3 className="side-panel-title">1.5km 반경 아파트</h3>

            {panelData.nearbyApts?.length > 0 && (
              <div className="nearby-section">
                <p className="nearby-section-label">재개발 완료 단지</p>
                {panelData.nearbyApts.map((apt) => (
                  <div key={apt.id} className="nearby-item">
                    <div className="nearby-info">
                      <span className="nearby-badge redev">재완</span>
                      <span className="nearby-name">{apt.name}</span>
                      <span className="nearby-dist">{(apt.distance * 1000).toFixed(0)}m</span>
                    </div>
                    {apt.prediction && (
                      <div className="ai-details">
                        <div className="ai-detail-item"><label>비례율</label><span>{apt.prediction.predRatio}%</span></div>
                        <div className="ai-detail-item"><label>분담금</label><span>{formatKoreanPrice(apt.prediction.predCost)}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="nearby-section">
              <p className="nearby-section-label">주변 아파트</p>
              {loadingPlaces && <p className="nearby-loading">검색 중...</p>}
              {!loadingPlaces && nearbyPlaces.length === 0 && (
                <p className="nearby-empty">검색 결과 없음</p>
              )}
              {nearbyPlaces.map((p, i) => (
                <div key={i} className="nearby-item">
                  <div className="nearby-info">
                    <span className="nearby-name">{p.name}</span>
                    <span className="nearby-dist">{p.distance}m</span>
                  </div>
                  {p.priceInfo ? (
                    <p className="nearby-price">
                      <span className="nearby-price-size">{p.priceInfo.pyeong}평</span>
                      {formatKoreanPrice(p.priceInfo.avgPrice)}
                    </p>
                  ) : (
                    <p className="nearby-address">{p.address}</p>
                  )}
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
