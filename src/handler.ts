import { toMetadata } from './headers'
import { ipInfo } from './ipinfo'

const defaultIP = '17.110.220.180'

const MAX_QUEUE_EVENTS = 1

let batchedEvents: Array<Hash<any>> = []

// flushQueue pushes the existing queue of event's metadata into the backend
function flushQueue() {}

// TODO fix the type of the metadata argument
function queueEvent(event: FetchEvent, metadata: any) {
  batchedEvents.push(metadata)

  if (batchedEvents.length > MAX_QUEUE_EVENTS) {
    event.waitUntil(flushQueue())
  }
}

export async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request
  console.log(`Fetching origin ${request.url}`)
  // fetch the original request (i.e proxy)
  const response = await fetch(request)

  let metadata = {
    method: request.method,
    url: request.url,
    cf: request.cf,
    timestamp: new Date().toISOString(),
    status: response.status,
    request: toMetadata(request.headers),
    response: toMetadata(request.headers),
    ip: {},
  }

  let clientIP = metadata.request.cf_connecting_ip || defaultIP
  const ip = await ipInfo(clientIP)

  metadata = { ...metadata, ip }
  console.log(metadata)
  console.log(metadata.ip)

  event.waitUntil(queueEvent(event, metadata))

  return response
}
