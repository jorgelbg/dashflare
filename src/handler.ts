import { toLabels } from './headers'
import { ipInfo } from './ipinfo'
import { referrer } from 'inbound'
import { URL } from '@cliqz/url-parser'
import { getName } from 'country-list'
import { UAParser } from 'ua-parser-js'
import { hash_hex, string_to_u8 } from 'siphash'
// import { parse } from './referer'
import { encode } from 'ngeohash'

let sessionKey = string_to_u8(FINGERPRINT)

// These settings will be provided as environment variables
const MAX_QUEUE_EVENTS = 1
const DEBUG_HEADERS = false

const JAVASCRIPT_REGEX = /\.js/
const IMAGE_REGEX = /\.(?:png|jpg|jpeg|webp|gif|ico|svg|webmanifest)/
const CSS_REGEX = /\.css/

// Used in a different file but also should be configurable
// IPINFO_TOKEN
const LOKI_URL = `http://${LOKI_HOST}/api/prom/push`

const EXCLUDE = JSON.parse(OPTIONS) || {
  css: false,
  images: false,
  js: false,
  ip: true,
}

let batchedEvents: Array<Hash<any>> = []
let currentHost: string | null = ''
let ipInfoQuotaReached = false

const SKIP_LABELS = new Set([
  'url',
  'referer',
  'user_agent',
  'hostname',
  'ip',
  'os_version',
  'browser_version',
])

if (EXCLUDE.ip) {
  SKIP_LABELS.add('ip')
}

const parser = new UAParser()

// Translates the status code from the request into a string representation
// compatible with the log level mapping from Grafana:
// https://github.com/grafana/grafana/blob/1915d10980a1ac91fef6b3577432b47f7c744892/packages/grafana-data/src/types/logs.ts#L9-L27
function levelFromStatus(status: number): string {
  if (status >= 400) {
    return 'error'
  }

  if (status >= 300) {
    return 'warn'
  }

  if (status >= 200) {
    return 'info'
  }

  return 'trace'
}

// flushQueue pushes the existing queue of event's metadata into the backend
async function flushQueue() {
  let arr: string[] = [`host="${currentHost}"`]
  let arrLog: string[] = []
  let event = batchedEvents[0]
  for (let k in event) {
    // Avoid putting the url & referer links in the label set
    if (SKIP_LABELS.has(k)) continue
    let v = event[k]
    if (v != undefined) {
      arr.push(`${k}="${v}"`)
      arrLog.push(`${k}=${v}`)
    }
  }

  let labels = `{${arr.join(',')}}`
  let status = parseInt(event['status'])
  let session = hash_hex(
    sessionKey,
    `${event['user_agent']}${event['ip']}${event['domain']}`,
  )

  let line = `level=${levelFromStatus(status)} method=${event['method']} ${
    event['url']
  } referer=${event['referer']} user_agent=${
    event['user_agent']
  } session_id=${session} os_version=${event['os_version']} browser_version=${
    event['browser_version']
  } ${arrLog.join(' ')}`

  let payload = {
    streams: [
      {
        labels: labels,
        entries: [
          {
            ts: new Date().toISOString(),
            line: line,
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
      'X-Scope-OrgID': CLIENT_ID,
    },
  })

  // console.debug(res.status)
  batchedEvents = []
}

async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request
  if (currentHost == '') {
    currentHost = request.headers.get('host') || request.headers.get('hostname')
  }

  // fetch the original request
  console.log(`Fetching origin ${request.url}`)
  const response = await fetch(request.url, request)

  if (EXCLUDE.js && JAVASCRIPT_REGEX.test(request.url)) {
    return response
  }

  if (EXCLUDE.css && CSS_REGEX.test(request.url)) {
    return response
  }

  if (EXCLUDE.images && IMAGE_REGEX.test(request.url)) {
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
    // the ua-parser-js library identify desktop clients as an empty device type
    device_type: parser.getDevice().type ? parser.getDevice().type : 'desktop',
    country: request.headers.get('cf-ipcountry'),
  }

  if (DEBUG_HEADERS) {
    // This might need to increase the max limit of labels on the Loki side
    labels = {
      ...labels,
      ...toLabels(request.headers, 'req'),
      ...toLabels(response.headers, 'res'),
    }
  }

  let clientIP = request.headers.get('cf-connecting-ip') || ''

  if (ipInfoQuotaReached == false && clientIP.length > 0) {
    try {
      const ip = await ipInfo(clientIP)

      let [lat, lon] = ip.loc.split(',').map((n) => parseFloat(n))
      let geohash = encode(lat, lon)

      delete ip.loc
      delete ip.timezone
      delete ip.postal
      delete ip.org
      delete ip.region

      ip.geohash = geohash
      ip.country_name = `${getName(ip.country)}`

      labels = { ...labels, ...ip }
    } catch (error) {
      // We catched 429 Too Many Requests, this means that we reached our current
      // ipinfo quota. Avoid making extra requests.
      ipInfoQuotaReached = true
    }
  }

  if (request.headers.get('referer')) {
    let refData: any = await new Promise((resolve) => {
      const ref = request.headers.get('referer')
      referrer.parse(request.url, ref, function (err: any, info: any) {
        console.log(JSON.stringify(info['referrer']))
        resolve(info['referrer'])
      })
    })

    const { type, network, client } = refData

    labels = { ...labels, ...{ type, network, client } }
  }

  batchedEvents.push(labels)
  event.waitUntil(flushQueue())

  return response
}

export { handleRequest, levelFromStatus }
