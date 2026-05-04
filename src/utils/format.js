export const formatKoreanPrice = (val) => {
  if (!val) return "0원";
  if (val >= 100000000) {
    const eok = Math.floor(val / 100000000);
    const remainder = Math.round((val % 100000000) / 10000);
    return remainder > 0
      ? `${eok.toLocaleString()}억 ${remainder.toLocaleString()}만원`
      : `${eok.toLocaleString()}억원`;
  }
  return `${Math.round(val / 10000).toLocaleString()}만원`;
};
