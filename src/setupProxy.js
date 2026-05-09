const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // 서울 열린데이터광장 (개발 중 CORS 우회용)
  // 정식 동기화는 .github/workflows/sync-apt-prices.yml 에서 수행한다
  app.use(
    "/api/seoul",
    createProxyMiddleware({
      target: "http://openapi.seoul.go.kr:8088",
      changeOrigin: true,
      pathRewrite: { "^/api/seoul": "" },
    })
  );
};
