import Geohash from 'latlon-geohash'

import { toMetadata } from './headers'
import { ipInfo } from './ipinfo'
import { referrer } from 'inbound'
import { URL } from '@cliqz/url-parser'
import { getName } from 'country-list'
import { UAParser } from 'ua-parser-js'
import { hash_hex, string_to_u8 } from 'siphash'
import { parse } from './referer'

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

const SKIP_LABELS = new Set(['url', 'referer', 'user_agent', 'hostname', 'ip'])

if (EXCLUDE.ip) {
  SKIP_LABELS.add('ip')
}

const parser = new UAParser()

// flushQueue pushes the existing queue of event's metadata into the backend
async function flushQueue() {
  let arr: string[] = [`host="${currentHost}"`]
  let arrLog: string[] = []
  for (let k in batchedEvents[0]) {
    // Avoid putting the url & referer links in the label set
    if (SKIP_LABELS.has(k)) continue
    let v = batchedEvents[0][k]
    if (v != undefined) {
      arr.push(`${k}="${v}"`)
      arrLog.push(`${k}=${v}`)
    }
  }

  let level = 'info'
  let labels = `{${arr.join(',')}}`
  let status = parseInt(batchedEvents[0]['status'])
  let session = hash_hex(
    sessionKey,
    `${batchedEvents[0]['user_agent']}${batchedEvents[0]['ip']}${batchedEvents[0]['domain']}`,
  )

  let line = `level=${level} method=${batchedEvents[0]['method']} ${
    batchedEvents[0]['url']
  } referer=${batchedEvents[0]['referer']} user_agent=${
    batchedEvents[0]['user_agent']
  } session_id=${session} ${arrLog.join(' ')}`

  if (status > 300) {
    level = 'warn'
  }

  if (status > 400) {
    level = 'error'
  }

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
    device_type: parser.getDevice().type,
  }

  if (DEBUG_HEADERS) {
    // This might need to increase the max limit of labels on the Loki side
    labels = {
      ...labels,
      ...toMetadata(request.headers, 'req'),
      ...toMetadata(response.headers, 'res'),
    }
  }

  let clientIP = request.headers.get('cf-connecting-ip') || ''

  if (ipInfoQuotaReached == false && clientIP.length > 0) {
    try {
      const ip = await ipInfo(clientIP)

      let [lat, lon] = ip.loc.split(',').map((n) => parseFloat(n))
      let geohash = Geohash.encode(lat, lon)

      delete ip.loc
      delete ip.timezone
      delete ip.postal
      delete ip.org

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
