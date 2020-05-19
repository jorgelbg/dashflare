const logflareApiKey = process.env.LOGFLARE_API_KEY
const logflareSource = process.env.LOGFLARE_TEST_SOURCE

const ipInfoMaxAge = '86400'
const ipInfoToken = process.env.IPINFO_API_TOKEN

const headers = [
  'rMeth',
  'rUrl',
  'uAgent',
  'cfRay',
  'cIP',
  'statusCode',
  'contentLength',
  'cfCacheStatus',
  'contentType',
  'responseConnection',
  'requestConnection',
  'cacheControl',
  'acceptRanges',
  'expectCt',
  'expires',
  'lastModified',
  'vary',
  'server',
  'etag',
  'date',
  'transferEncoding',
]

const INSTALL_OPTIONS = {
  env: 'test',
  source: logflareSource,
  logflare: {
    api_key: logflareApiKey,
  },
  metadata: headers.map(value => ({ field: value })),
  services: {
    ipInfoToken,
    ipInfoMaxAge,
  },
}

module.exports = INSTALL_OPTIONS
