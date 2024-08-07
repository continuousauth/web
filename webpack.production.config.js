const webpack = require('webpack');

const CSPPlugin = require('csp-html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const config = require('./webpack.config');

// Hash all JS assets
config.output.filename = '[name].[contenthash].min.js';

// Remove devServer config
delete config.devServer;

// Remove NoEmitOnErrors, HotModuleReplacement and Dashboard plugins
config.plugins.shift();
config.plugins.shift();

// Remove source mapping
config.devtool = 'source-map';

// Add production plugins
config.plugins.unshift(
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: '"production"',
    },
  }),
  new MiniCssExtractPlugin({
    filename: '[name].[contenthash].css',
    chunkFilename: 'chunk.[id].[contenthash].css',
    // allChunks: true,
  }),
  new OptimizeCssAssetsPlugin());

config.plugins.push(
  new CSPPlugin({
    'base-uri': "'self'",
    'object-src': "'none'",
    'script-src': ["'unsafe-inline'", "'self'"],
    'style-src': ["'unsafe-inline'", "'self'", "https://fonts.googleapis.com"]
  }, {
    enabled: true,
    hashingMethod: 'sha256',
    hashEnabled: {
      'script-src': true,
      'style-src': false
    },
    nonceEnabled: {
      'script-src': true,
      'style-src': false
    }
  }),
  new SubresourceIntegrityPlugin({
    hashFuncNames: ['sha256', 'sha384'],
    enabled: true,
  }),
);

config.mode = 'production';

module.exports = config;