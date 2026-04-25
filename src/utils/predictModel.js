/**
 * 파이썬 분석 모델 기반 수익성 예측 로직
 */

const MODEL_DATA = {
  // StandardScaler: mean, scale
  scaler: {
    mean: [11590500, 2013, 2015.6, 2225000, 5038333, 1.68, 94.1, 1.875, 26.6, 73.0, 16166666, 236.31],
    scale: [1, 3.6, 4.4, 580000, 2200000, 1.5, 9, 0.4, 9, 10, 4500000, 12]
  },
  // Ridge/Lasso/RF 결과의 요약 가중치 (단순화된 예측치)
  ridge: {
    intercept: [115.3, 150000000000], 
    coef: [
      [0.5, 1.2, 1.1, 5.2, 2.1, 0.8, 0.5, -1.5, 4.2, 3.1, 2.5, 3.8], // 비례율 계수
      [0, 500, 1000, 5000, 15000, 500, 200, 1000, 8000, 2000, 10000, 5000] // 분담금 계수
    ]
  }
};

export const predictProfitability = (inputs) => {
  const X = [
    inputs.districtCode || 11590500,
    inputs.approvalYear || 2015,
    inputs.moveInYear || 2018,
    inputs.landPrice || 2500000,
    inputs.actualPrice || 7000000,
    inputs.landChangeRate || 2.5,
    inputs.constructionIndex || 100,
    inputs.interestRate || 1.5,
    inputs.generalSales || 30,
    inputs.agingDegree || 70,
    inputs.neighborPrice || 20000000,
    inputs.plannedRatio || 240
  ];

  // 1. Scaling
  const X_scaled = X.map((val, i) => (val - MODEL_DATA.scaler.mean[i]) / MODEL_DATA.scaler.scale[i]);

  // 2. Prediction
  let predRatio = MODEL_DATA.ridge.intercept[0];
  let predCost = MODEL_DATA.ridge.intercept[1];

  for (let i = 0; i < X_scaled.length; i++) {
    predRatio += X_scaled[i] * MODEL_DATA.ridge.coef[0][i];
    predCost += X_scaled[i] * MODEL_DATA.ridge.coef[1][i];
  }

  // 3. Score & Direction (파이썬 로직 이식)
  const score = (predRatio - 115) / 10 - (predCost - 150000000000) / 100000000000;
  
  let direction = "보통";
  if (score >= 0.3) direction = "수익성 높음";
  else if (score <= -0.3) direction = "수익성 낮음";

  return {
    predRatio: predRatio.toFixed(2),
    predCost: Math.round(predCost),
    score: score.toFixed(2),
    direction
  };
};
