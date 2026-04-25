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

};
