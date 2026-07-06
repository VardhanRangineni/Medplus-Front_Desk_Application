const babelRule = {
  test: /\.jsx?$/,
  // Preload must not be transpiled — breaks contextBridge / require('electron')
  exclude: [/node_modules/, /[\\/]preload\.js$/],
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]],
    },
  },
};

const nativeModulesRule = {
  test: /native_modules[/\\].+\.node$/,
  use: 'node-loader',
};

// Main process only — rewrites node_modules with __dirname (invalid in renderer).
const assetRelocatorRule = {
  test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
  parser: { amd: false },
  use: {
    loader: '@vercel/webpack-asset-relocator-loader',
    options: {
      outputAssetBase: 'native_modules',
    },
  },
};

module.exports = {
  main: [nativeModulesRule, assetRelocatorRule],
  renderer: [babelRule],
};
