import Geohash from 'latlon-geohash'

import { toMetadata } from './headers'
import { ipInfo } from './ipinfo'

const DEFAULT_IP = '17.110.220.180'
const MAX_QUEUE_EVENTS = 1
const LOKI_HOST = '23.101.74.228:3100'
const LOKI_URL = `http://${LOKI_HOST}/api/prom/push`

let batchedEvents: Array<Hash<any>> = []
let currentHost: string | null = ''

// flushQueue pushes the existing queue of event's metadata into the backend
async function flushQueue() {
  let arr: string[] = ['source="cloudflare"', `host="${currentHost}"`]
  for (let k in batchedEvents[0]) {
    let v = batchedEvents[0][k]
    if (v != undefined) {
      arr.push(`${k}="${v}"`)
    }
  }

  let labels = `{${arr.join(',')}}`

  let payload = {
    streams: [
      {
        labels: labels,
        entries: [
          {
            ts: new Date().toISOString(),
            line: '[INFO] ' + batchedEvents[0]['url'],
          },
        ],
      },
    ],
  }

  let res = await fetch('http://loki.jorgelbg.me/api/prom/push', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  console.log(res.status)
}

export async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request

  if (currentHost == '') {
    currentHost = request.headers.get('host')
  }

  console.log(`Fetching origin ${request.url}`)
  // fetch the original request (i.e proxy)
  const response = await fetch(request)

  let labels = {
    method: request.method,
    url: request.url,
    cf: request.cf,
    // timestamp: new Date().toISOString(),
    status: response.status,
    ...toMetadata(request.headers, 'req'),
    ...toMetadata(response.headers, 'res'),
  }

  let clientIP = request.headers.get('cf-connecting-ip') || DEFAULT_IP
  const ip = await ipInfo(clientIP)

  let [lat, lon] = ip.loc.split(',').map(n => parseFloat(n))
  let geohash = Geohash.encode(lat, lon)

  delete ip.loc
  ip.lat = lat.toString()
  ip.lon = lon.toString()
  ip.geohash = geohash

  labels = { ...labels, ...ip }
  batchedEvents.push(labels)
  event.waitUntil(flushQueue())

  return response
}
