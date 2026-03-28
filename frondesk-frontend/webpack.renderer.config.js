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

module.exports = {
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
