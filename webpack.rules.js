const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const baseCacheDir = path.resolve(
  __dirname,
  'node_modules',
  '.build-cache',
  isProd ? 'prod' : 'dev',
);

const envSpecificCSSLoader = () =>
  isProd
    ? MiniCssExtractPlugin.loader
    : {
        loader: 'style-loader',
        options: {
          // sourceMap: true,
        },
      };

module.exports = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|bower_components|public_out\/)/,
    use: [
      {
        loader: 'cache-loader',
        options: {
          cacheDirectory: path.resolve(baseCacheDir, 'ts'),
        },
      },
      {
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.public.json',
          transpileOnly: true,
        },
      },
    ],
  },
  {
    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
    exclude: /(node_modules|bower_components)/,
    loader: 'url-loader',
    options: {
      limit: 10000,
      mimetype: 'image/svg+xml',
    },
  },
  {
    test: /\.png/,
    exclude: /(node_modules|bower_components)/,
    loader: 'url-loader',
    options: {
      limit: 10000,
      mimetype: 'image/png',
    },
  },
  {
    test: /\.css$/,
    use: [envSpecificCSSLoader(), 'css-loader'],
  },
  {
    test: /\.scss$/,
    exclude: /[/\\](node_modules|bower_components|public_out\/)[/\\]/,
    use: [
      {
        loader: 'cache-loader',
        options: {
          cacheDirectory: path.resolve(baseCacheDir, 'scss'),
        },
      },
      envSpecificCSSLoader(),
      {
        loader: 'css-loader',
        options: {
          modules: true,
          importLoaders: 1,
          sourceMap: true,
          // modules: {
          //   localIdentName: isProd ? undefined : '[path]___[name]__[local]___[hash:base64:5]'
          // }
        },
      },
      'postcss-loader',
      'sass-loader',
    ],
  },
];
