/**
 * Preload bundle — must not be Babel-transpiled; electron stays external.
 */
module.exports = {
  target: 'electron-preload',
  externals: {
    electron: 'commonjs2 electron',
  },
  module: {
    rules: [],
  },
};
