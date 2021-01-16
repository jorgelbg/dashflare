import { toLabels } from './headers'
import { ipInfo } from './ipinfo'
import { referrer, shorten } from 'inbound'
import { URL } from '@cliqz/url-parser'
import { getName } from 'country-list'
import { UAParser } from 'ua-parser-js'
import { hash_hex, string_to_u8 } from 'siphash'
import logfmt from 'logfmt'
// import { parse } from './referer'
import { encode } from 'ngeohash'

let sessionKey = string_to_u8(FINGERPRINT)

// These settings will be provided as environment variables
const MAX_QUEUE_EVENTS = 1
const DEBUG_HEADERS = false

const JAVASCRIPT_REGEX = /\.js/
const IMAGE_REGEX = /\.(?:png|jpg|jpeg|webp|gif|ico|svg|webmanifest)/
const CSS_REGEX = /\.css/

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

const INCLUDE_LABELS = new Set(['method', 'status', 'protocol', 'device_type'])

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
  let event = batchedEvents[0]
  let labels: string[] = [`host="${currentHost}"`]
  let obj: Hash<String> = {}

  for (let k in event) {
    // Avoid putting some information in the label set
    let v = event[k]
    if (v == undefined) {
      continue
    }

    if (INCLUDE_LABELS.has(k)) {
      labels.push(`${k}="${v}"`)
    }

    obj[k] = v
  }

  let status = parseInt(event['status'])
  let session = hash_hex(
    sessionKey,
    `${event['user_agent']}${event['ip']}${event['domain']}`,
  )

  obj['level'] = levelFromStatus(status)
  obj['session'] = session

  let payload = {
    streams: [
      {
        labels: `{${labels.join(',')}}`,
        entries: [
          {
            ts: new Date().toISOString(),
            line: logfmt.stringify(obj),
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

  let response: Response
  let url = request.headers.get('x-original-url') || request.url
  let duration: number = 0
  let clientIP =
    request.headers.get('x-original-ip') ||
    request.headers.get('cf-connecting-ip') ||
    ''

  // If the request contains a 'x-original-url' header we understand that this request is forwarded
  // to the worker and that therefor the upstream should not be fetched. We use a custom header to
  // change as little as possible from the original request.
  if (request.headers.get('x-original-url') != null) {
    response = new Response('ok', { status: 200 })
  } else {
    // fetch the original request
    console.log(`Fetching origin ${request.url}`)
    const t = Date.now()
    response = await fetch(request.url, request)
    duration = Math.floor(Date.now() - t) // milliseconds
  }

  if (EXCLUDE.js && JAVASCRIPT_REGEX.test(url)) {
    return response
  }

  if (EXCLUDE.css && CSS_REGEX.test(url)) {
    return response
  }

  if (EXCLUDE.images && IMAGE_REGEX.test(url)) {
    return response
  }

  let parsed = new URL(url)
  let userAgent = request.headers.get('user-agent')

  parser.setUA(`${userAgent}`)

  let labels = {
    method: request.method,
    url: url,
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
    type: '',
    network: '',
    client: '',
    referer_domain: '',
    duration,
  }

  if (DEBUG_HEADERS) {
    // This might need to increase the max limit of labels on the Loki side
    labels = {
      ...labels,
      ...toLabels(request.headers, 'req'),
      ...toLabels(response.headers, 'res'),
    }
  }

  if (ipInfoQuotaReached == false && clientIP.length > 0) {
    try {
      const ip = await ipInfo(clientIP)

      let geohash = encode(ip.lat, ip.lon)
      let country_name = `${getName(ip.country)}`

      labels = { ...labels, ...ip, ...{ country_name, geohash } }
    } catch (error) {
      // We catched 429 Too Many Requests, this means that we reached our current
      // ipinfo quota. Avoid making extra requests.
      ipInfoQuotaReached = true
    }
  }

  if (request.headers.get('referer')) {
    let refData: any = await new Promise((resolve) => {
      const ref = request.headers.get('referer') || ''
      referrer.parse(request.url, ref, function (err: any, info: any) {
        // The inbound library doesn't shortens all links from a referer URL only some
        // transformations are applied. We first get only the domain from the URL and then run it
        // through the shorten.domain function.
        let domain = shorten.domain(new URL(ref).domain)
        resolve({ ...info['referrer'], domain })
      })
    })

    const { type, network, client, domain } = refData
    labels = { ...labels, type, network, client, referer_domain: domain }
  }

  batchedEvents.push(labels)
  event.waitUntil(flushQueue())

  return response
}

export { handleRequest, levelFromStatus }
