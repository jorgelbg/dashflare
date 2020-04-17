import Geohash from 'latlon-geohash'

import { toMetadata } from './headers'
import { ipInfo } from './ipinfo'
import { referrer } from 'inbound'
import { URL } from '@cliqz/url-parser'
import { getName } from 'country-list'
import { UAParser } from 'ua-parser-js'

// These settings will be provided as environment variables or SECRETS.
// Other option is by shipping a full featured Cloudflare App
const DEFAULT_IP = '17.110.220.180'
const MAX_QUEUE_EVENTS = 1
const LOKI_HOST = 'loki.jorgelbg.me'
const EXCLUDE_IMAGES = false
const EXCLUDE_CSS = false
const EXCLUDE_JAVASCRIPT = false
const LOG_ALL_HEADERS = false

const JAVASCRIPT_REGEX = /\.js$/
const IMAGE_REGEX = /\.(?:png|jpg|jpeg|webp|gif|ico|svg|webmanifest)$/
const CSS_REGEX = /\.css$/

// TODO: Currently a Cloudflare app cannot use edge workers
if (typeof INSTALL_OPTIONS !== 'undefined') {
  let options = INSTALL_OPTIONS || {}
  console.log(options)
}

// Used in a different file but also should be configurable
// IPINFO_TOKEN
const LOKI_URL = `http://${LOKI_HOST}/api/prom/push`

let batchedEvents: Array<Hash<any>> = []
let currentHost: string | null = ''

const parser = new UAParser()

// flushQueue pushes the existing queue of event's metadata into the backend
async function flushQueue() {
  let arr: string[] = [`host="${currentHost}"`]
  for (let k in batchedEvents[0]) {
    let v = batchedEvents[0][k]
    if (v != undefined) {
      arr.push(`${k}="${v}"`)
    }
  }

  let level = 'INFO'
  let labels = `{${arr.join(',')}}`
  let status = parseInt(batchedEvents[0]['status'])

  if (status > 300) {
    level = 'WARN'
  }

  if (status > 400) {
    level = 'ERROR'
  }

  let payload = {
    streams: [
      {
        labels: labels,
        entries: [
          {
            ts: new Date().toISOString(),
            line: `[${level}] ${batchedEvents[0]['method']} ${batchedEvents[0]['url']}`,
          },
        ],
      },
    ],
  }

  let res = await fetch(LOKI_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  console.debug(res.status)
  batchedEvents = []
}

export async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request
  if (currentHost == '') {
    currentHost = request.headers.get('host') || request.headers.get('hostname')
  }

  // fetch the original request
  console.log(`Fetching origin ${request.url}`)
  const response = await fetch(request)

  if (EXCLUDE_JAVASCRIPT && JAVASCRIPT_REGEX.test(request.url)) {
    return response
  }

  if (EXCLUDE_CSS && CSS_REGEX.test(request.url)) {
    return response
  }

  if (EXCLUDE_IMAGES && IMAGE_REGEX.test(request.url)) {
    return response
  }

  let parsed = new URL(request.url)
  let userAgent = request.headers.get('user-agent')

  parser.setUA(`${userAgent}`)

  let labels = {
    method: request.method,
    url: request.url,
    status: response.status,
    referer: request.headers.get('referer'),
    user_agent: userAgent,
    protocol: request.headers.get('x-forwarded-proto'),
    domain: parsed.domain,
    origin: parsed.origin,
    path: parsed.path,
    hash: parsed.hash,
    query: parsed.search,
    browser: parser.getBrowser().name,
    browser_version: parser.getBrowser().major,
    os: parser.getOS().name,
    os_version: parser.getOS().version,
    device_type: parser.getDevice().type,
  }

  if (LOG_ALL_HEADERS) {
    labels = {
      ...labels,
      ...toMetadata(request.headers, 'req'),
      ...toMetadata(response.headers, 'res'),
    }
  }

  let clientIP = request.headers.get('cf-connecting-ip') || DEFAULT_IP
  const ip = await ipInfo(clientIP)

  let [lat, lon] = ip.loc.split(',').map(n => parseFloat(n))
  let geohash = Geohash.encode(lat, lon)

  delete ip.loc
  delete ip.timezone
  delete ip.postal
  delete ip.org
  ip.lat = lat.toString()
  ip.lon = lon.toString()
  ip.geohash = geohash
  ip.country_name = `${getName(ip.country)}`

  if (request.headers.get('referer')) {
    let refData: object = await new Promise(resolve => {
      const ref = request.headers.get('referer')
      referrer.parse(request.url, ref, function(err: any, info: any) {
        console.log(JSON.stringify(info['referrer']))
        resolve(info['referrer'])
      })
    })

    labels = { ...labels, ...refData }
  }

  // userAgent =
  //   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36'
  // const userAgent =
  //   'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25 (compatible; Googlebot-Mobile/2.1; +http://www.google.com/bot.html)'

  labels = { ...labels, ...ip }
  // console.log(JSON.stringify(labels))

  batchedEvents.push(labels)
  event.waitUntil(flushQueue())

  return response
}
