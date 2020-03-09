import { toMetadata } from './headers'
import { ipInfo } from './ipinfo'

const defaultIP = '17.110.220.180'

export async function handleRequest(request: Request): Promise<Response> {
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

  return response
}
