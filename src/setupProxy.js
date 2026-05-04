const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/vworld-api",
    createProxyMiddleware({
      target: "https://api.vworld.kr",
      changeOrigin: true,
      pathRewrite: { "^/vworld-api": "" },
    })
  );

  app.use(
    "/api/seoul",
    createProxyMiddleware({
      target: "http://openapi.seoul.go.kr:8088",
      changeOrigin: true,
      pathRewrite: { "^/api/seoul": "" },
    })
  );
};
