import Geohash from 'latlon-geohash'

const limitErrorMessage: string =
  'You have exceeded 50,000 requests per month. Visit https://ipinfo.io/account to see your API limits.'
const MAX_AGE = 86400

export async function ipInfo(ip: string): Promise<Hash<string>> {
  // If the IPINFO_TOKEN variable is empty we asssume that the geolocation has been disabled by the
  // user and avoid requesting any info from ipinfo.io
  if (IPINFO_TOKEN.trim().length === 0) {
    return {}
  }

  let cache = await caches.open('ips')

  const url = `http://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`
  const key = new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  let cachedResponse = await cache.match(key)

  if (cachedResponse) {
    return cachedResponse.json()
  }

  const res = await fetch(url)

  if (res.status == 200) {
    let cachedRes = new Response(res.body, res)
    cachedRes.headers.set('Cache-Control', `max-age=${MAX_AGE}`)
    cache.put(key, cachedRes.clone())

    return cachedRes.json()
  } else if (res.status === 429) {
    // Quota limit reached
    // Any other error might be retriable
    throw new Error(limitErrorMessage)
  }

  return {}
}
