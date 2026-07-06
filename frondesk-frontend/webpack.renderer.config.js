const rules = [...require('./webpack.rules').renderer];

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

rules.push({
  test: /\.(png|jpe?g|gif|ico|webp)$/i,
  type: 'asset',
  parser: {
    dataUrlCondition: {
      maxSize: 8 * 1024,
    },
  },
});

const DEV_CSP = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
  "connect-src 'self' http://localhost:8080 http://localhost:9090 http://127.0.0.1:9090 ws://localhost:3000 ws://localhost:9000",
].join('; ');

module.exports = {
  // Do not set `target` here — Electron Forge picks `web` when nodeIntegration is
  // false (see main.js). `electron-renderer` externalizes Node builtins and breaks
  // HMR with "require is not defined" in the renderer.
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  // Route-level lazy() already creates one chunk per page. Extra async splitChunks
  // (e.g. shared locationService) caused ChunkLoadError/timeouts in Electron dev.
  optimization: {
    splitChunks: false,
  },
  devServer: {
    open: false,
    headers: {
      'Content-Security-Policy': DEV_CSP,
    },
  },
};
