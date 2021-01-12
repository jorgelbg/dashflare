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
const sessionHash = JSON.stringify(
  process.env.FINGERPRINT || 'finger-print-token',
)

console.log({
  ipInfoToken,
  clientId,
  lokiHost,
  excludeOptions,
  fingerprintHash: sessionHash,
})

module.exports = {
  output: {
    filename: `worker.${mode}.js`,
    path: path.join(__dirname, 'dist'),
  },
  devtool: 'none',
  mode,
  plugins: [
    new webpack.DefinePlugin({
      IPINFO: ipInfoToken,
      CLIENT_ID: clientId,
      LOKI_HOST: lokiHost,
      OPTIONS: `'${excludeOptions}'`,
      FINGERPRINT: sessionHash,
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
      {
        test: /\.ya?ml$/,
        use: [
          {
            loader: '@friends-of-js/yaml-loader',
            options: { useNodeEnv: false },
          },
        ],
      },
    ],
  },
  node: {
    fs: 'empty',
    net: 'empty',
  },
}
