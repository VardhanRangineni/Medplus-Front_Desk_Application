/**
 * Main process bundle — keep Node/Electron requires intact (no Babel).
 */
const path = require('node:path');
const webpack = require('webpack');
const dotenv = require('dotenv');

const mode = process.env.NODE_ENV || 'development';
const envFiles = [
  path.resolve(__dirname, `.env.${mode}`),
  path.resolve(__dirname, '.env'),
];

for (const envPath of envFiles) {
  dotenv.config({ path: envPath });
}

const frontdeskApiUrl = process.env.FRONTDESK_API_URL || '';

module.exports = {
  entry: './src/main.js',
  target: 'electron-main',
  module: {
    rules: require('./webpack.rules').main,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.FRONTDESK_API_URL': JSON.stringify(frontdeskApiUrl),
    }),
  ],
};
