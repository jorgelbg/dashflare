const path = require('path')
const webpack = require('webpack')

const defaultExclude = {
  css: false,
  images: false,
  js: false,
  ip: false,
}

const mode = 'development'
const ipInfoToken = JSON.stringify(process.env.IPINFO || 'not-yet-set')
const clientId = JSON.stringify(process.env.CLIENT_ID || 'not-yet-set')
const lokiHost = JSON.stringify(process.env.LOKI_HOST || 'loki.jorgelbg.me')
const excludeOptions = JSON.stringify(
  process.env.WORKER_OPTIONS || defaultExclude,
)

console.log({ ipInfoToken, clientId, lokiHost, excludeOptions })

module.exports = {
  output: {
    filename: `worker.${mode}.js`,
    path: path.join(__dirname, 'dist'),
  },
  devtool: 'source-map',
  mode,
  plugins: [
    new webpack.DefinePlugin({
      IPINFO_TOKEN: ipInfoToken,
      CLIENT_ID: clientId,
      LOKI_HOST: lokiHost,
      OPTIONS: `"${excludeOptions}"`,
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    plugins: [],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' },
    ],
  },
  node: {
    fs: 'empty',
    net: 'empty',
  },
}
