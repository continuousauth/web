const path = require('path');
const webpack = require('webpack');

const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const rules = require('./webpack.rules');

const SERVER_PORT = process.env.PORT || 3001;

module.exports = {
  mode: 'development',
  entry: [
    ...(process.env.NODE_ENV === 'production' ? [] : ['react-hot-loader/patch']),
    './src/client/polyfill.ts',
    './src/client/index.tsx',
  ],
  devtool: process.env.WEBPACK_DEVTOOL || 'eval-source-map',
  output: {
    publicPath: '/',
    path: path.join(__dirname, 'public_out'),
    filename: '[name].js',
    crossOriginLoading: 'anonymous',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules,
  },
  devServer: {
    contentBase: './public_out',
    quiet: false,
    noInfo: false,
    hot: true,
    inline: true,
    historyApiFallback: true,
    port: 3000,
    proxy: {
      '/api': `http://localhost:${SERVER_PORT}`,
    },
    disableHostCheck: true,
    compress: true,
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      template: './src/client/template.ejs',
      filename: 'index.html',
      templateParameters: {},
    }),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
  ],
};

if (process.env.ANALYZE) {
  module.exports.plugins.push(new BundleAnalyzerPlugin());
}
