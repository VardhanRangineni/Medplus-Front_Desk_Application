const rules = require('./webpack.rules');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

rules.push({
  test: /\.(png|jpe?g|gif|ico|webp)$/i,
  use: [
    {
      loader: 'url-loader',
      options: { limit: Infinity },
    },
  ],
});

const DEV_CSP = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
  "connect-src 'self' http://localhost:8080 ws://localhost:3000 ws://localhost:9000",
].join('; ');

module.exports = {
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devServer: {
    headers: {
      'Content-Security-Policy': DEV_CSP,
    },
  },
};
