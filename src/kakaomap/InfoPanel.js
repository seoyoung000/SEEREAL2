import React, { useMemo, useState } from "react";
import { formatKoreanPrice } from "../utils/format";
import "./InfoPanel.css";

const normalizeName = (value = "") =>
  value.toString().replace(/\s+/g, " ").trim();

const SIMPLE_ZONES = [
  "한남 지구단위계획구역",
  "한남지구단위계획구역",
  "이태원로 주변 지구단위계획구역",
  "이태원로주변 지구단위계획구역",
  "한남외인주택부지 지구단위계획구역",
  "한남외인주택부지",
  "한남4재정비촉진구역 지구단위계획구역",
  "한남4재정비촉진구역",
  "한남5재정비촉진구역 지구단위계획구역",
  "한남5재정비촉진구역",
].map(normalizeName);

function InfoPanel({ type = "zone", data, onClose }) {
  const [dealType, setDealType] = useState("sale");

  const panelData = data || {};
  const zoneStats = Array.isArray(panelData.stats) ? panelData.stats : [];
  const latestZoneStat = zoneStats.length > 0 ? zoneStats[zoneStats.length - 1] : null;
  const recentZoneStats = useMemo(() => zoneStats.slice(-4), [zoneStats]);

  const simpleKey = normalizeName(panelData.name || panelData.note || "");
  const isSimpleZone =
    simpleKey.length > 0 &&
    SIMPLE_ZONES.some(
      (zoneName) =>
        simpleKey === zoneName ||
        simpleKey.includes(zoneName) ||
        zoneName.includes(simpleKey)
    );

  const normalizedComplexDeals = useMemo(() => {
    if (!Array.isArray(panelData.deals)) return [];

    const deals = panelData.deals
      .map((deal) => ({
        type: deal.type || "sale",
        price: deal.price ?? deal.deal_price ?? deal.amount ?? deal.value ?? null,
        deposit: deal.deposit ?? null,
        monthly_rent: deal.monthly_rent ?? null,
        area_m2: deal.area_m2 ?? deal.area ?? null,
        floor: deal.floor ?? null,
        date: deal.date || deal.deal_date || null,
      }))
      .filter(
        (deal) =>
          typeof deal.type === "string" &&
          (deal.type !== "sale" || typeof deal.price === "number")
      );

    return deals.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [panelData.deals]);

  if (!data) return null;

  const formatNumber = (num) =>
    num || num === 0 ? Number(num).toLocaleString() : "N/A";

  const formatPeriod = (stat) =>
    stat ? `${stat.year}.${stat.month.toString().padStart(2, "0")}` : "";

  const formatAreaValue = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    const hasDecimal = Math.abs(value - Math.round(value)) > 0.001;
    return `${value.toLocaleString("ko-KR", {
      minimumFractionDigits: hasDecimal ? 2 : 0,
      maximumFractionDigits: 2,
    })}㎡`;
  };

  const formatDealDate = (dateString) =>
    dateString ? dateString.replace(/-/g, ".") : "-";

  const renderAISection = (prediction) => {
    if (!prediction) return null;
    return (
      <div className="ai-result-card mini">
        <div className="ai-result-main">
          <span
            className={`ai-direction ${
              prediction.direction === "수익성 높음"
                ? "high"
                : prediction.direction === "보통"
                ? "normal"
                : "low"
            }`}
          >
            {prediction.direction}
          </span>
          <div className="ai-score">
            점수: <strong>{prediction.score}</strong>
          </div>
        </div>
        <div className="ai-details">
          <div className="ai-detail-item">
            <label>비례율</label>
            <span>{prediction.predRatio}%</span>
          </div>
          <div className="ai-detail-item">
            <label>분담금</label>
            <span>{formatKoreanPrice(prediction.predCost)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderZoneInfo = () => {
    if (isSimpleZone) {
      const simpleDetails = [
        { label: "면적", content: "290,718.9㎡" },
        {
          label: "용도지역",
          content:
            "땅의 건폐율·용적률과 건물 용도를 정하는 구역 (제1종전용·제1·2종일반주거지역, 준주거지역, 일반상업지역, 자연녹지지역)",
        },
        {
          label: "용도지구",
          content: "안전과 경관을 위한 추가 규제 (고도지구, 방화지구 등)",
        },
      ];

      return (
        <>
          <h2>{panelData.name || "정비구역"}</h2>
          <p className="info-simple-text">
            보행 단절과 주차 같은 생활 민원을 해결하고, 관광객이 머물기 좋은
            환경을 만들기 위해 지정된 구역입니다.
          </p>
          <div className="info-simple-details">
            {simpleDetails.map((detail) => (
              <div className="info-simple-detail" key={detail.label}>
                <span className="detail-label">{detail.label}</span>
                <p>{detail.content}</p>
              </div>
            ))}
            <p className="info-simple-note">
              주변 보행 환경과 주차 공간을 정비해 한남·이태원 일대 관광 동선을
              잇는 것이 목표입니다.
            </p>
          </div>
        </>
      );
    }

    return (
      <>
        <h2>{panelData.name || panelData.note}</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>진행 단계</strong>
            <span className="stage">{panelData.stage || "N/A"}</span>
          </div>
          <div className="info-item">
            <strong>구역 면적(㎡)</strong>
            <span>{formatNumber(panelData.area)}</span>
          </div>
          <div className="info-item">
            <strong>구분</strong>
            <span>{panelData.type || "N/A"}</span>
          </div>
          <div className="info-item">
            <strong>토지등 소유자 수</strong>
            <span>{formatNumber(panelData.households)}</span>
          </div>
        </div>

        {latestZoneStat && (
          <div className="info-price-section">
            <p className="info-price-title">최근 평균 실거래가</p>
            <p className="info-price-value">
              {formatNumber(latestZoneStat.avg_price)}원
            </p>
            <p className="info-price-period">{formatPeriod(latestZoneStat)}</p>
            <div className="info-price-trend">
              {recentZoneStats.map((stat) => (
                <div key={`${stat.year}-${stat.month}`}>
                  <span>{formatPeriod(stat)}</span>
                  <strong>{formatNumber(stat.avg_price)}원</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderComplexInfo = () => {
    const filteredDeals = normalizedComplexDeals.filter(
      (deal) => deal.type === dealType
    );
    const recentDisplayDeals = filteredDeals.slice(0, 5);

    const formatDealPrice = (deal) => {
      if (deal.type === "sale") return `${formatNumber(deal.price)}원`;
      if (deal.type === "jeonse") return `${formatNumber(deal.deposit)}만원`;
      if (deal.type === "rent") {
        if (deal.monthly_rent && deal.monthly_rent > 0) {
          return `${formatNumber(deal.deposit)}/${formatNumber(deal.monthly_rent)}만원`;
        }
        return `${formatNumber(deal.deposit)}만원`;
      }
      return "N/A";
    };

    return (
      <>
        <h2>{panelData.name || "단지 상세"}</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>주소</strong>
            <span>{panelData.address || "주소 정보 없음"}</span>
          </div>
          <div className="info-item">
            <strong>세대수 / 준공년도</strong>
            <span>
              {formatNumber(panelData.total_households)}세대 /{" "}
              {panelData.build_year}년
            </span>
          </div>
          {Array.isArray(panelData.areas) && panelData.areas.length > 0 && (
            <div className="info-item">
              <strong>전용 면적</strong>
              <div className="area-chip-row">
                {panelData.areas.map((area) => (
                  <span
                    className="area-chip"
                    key={`${panelData.name || "complex"}-${area}`}
                  >
                    {formatAreaValue(area)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {dealType === "sale" && (
            <div className="info-item">
              <strong>최신 평균 실거래가</strong>
              <span>
                {panelData.latest_avg
                  ? `${(panelData.latest_avg / 10000).toFixed(1)}억`
                  : "N/A"}
              </span>
            </div>
          )}
        </div>

        {renderAISection(panelData.prediction)}

        <div className="info-deal-section">
          <div className="deal-type-selector">
            <button
              className={dealType === "sale" ? "active" : ""}
              onClick={() => setDealType("sale")}
            >
              매매
            </button>
            <button
              className={dealType === "jeonse" ? "active" : ""}
              onClick={() => setDealType("jeonse")}
            >
              전세
            </button>
            <button
              className={dealType === "rent" ? "active" : ""}
              onClick={() => setDealType("rent")}
            >
              월세
            </button>
          </div>
          <p className="info-price-title">최근 거래 내역</p>
          {recentDisplayDeals.length ? (
            <div className="deal-list">
              {recentDisplayDeals.map((deal, index) => (
                <div
                  className="deal-item"
                  key={`${deal.date}-${deal.area_m2}-${deal.floor}-${deal.type}-${index}`}
                >
                  <div className="deal-headline">
                    <span className="deal-date">
                      {formatDealDate(deal.date)}
                    </span>
                    <strong>{formatDealPrice(deal)}</strong>
                  </div>
                  <div className="deal-meta">
                    <span>{formatAreaValue(deal.area || deal.area_m2)}</span>
                    <span>
                      {typeof deal.floor === "number" ? `${deal.floor}층` : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-deal-data">
              선택된 유형의 최근 거래 내역이 없습니다.
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="infoPanel">
      <button className="close-btn" onClick={onClose}>
        ×
      </button>
      <div className="infoPanel-content">
        {type === "complex" ? renderComplexInfo() : renderZoneInfo()}
      </div>
    </div>
  );
}

export default InfoPanel;
