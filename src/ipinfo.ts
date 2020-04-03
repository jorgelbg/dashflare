import Geohash from 'latlon-geohash'

const MAX_AGE = 86400

export async function ipInfo(ip: string): Promise<Hash<string>> {
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
  }

  return {}
}
