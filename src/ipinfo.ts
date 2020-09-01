const limitErrorMessage: string =
  'You have exceeded the number of requests per month. Visit https://ipinfo.io/account to see your API limits.'
const MAX_AGE = 86400

interface IGeoData {
  readonly city: string
  readonly country: string
  readonly lat: number
  readonly lon: number
}

function toGeoData(res: Promise<Hash<string>>): Promise<IGeoData> {
  return res
    .then((ip) => {
      let [lat, lon] = ip.loc.split(',').map((n) => parseFloat(n))

      return <IGeoData>{
        city: ip.city,
        country: ip.country,
        lat,
        lon,
      }
    })
    .catch(() => <IGeoData>{})
}

async function ipInfo(ip: string): Promise<IGeoData> {
  // If the IPINFO_TOKEN variable is empty we asssume that the geolocation has been disabled by the
  // user and avoid requesting any info from ipinfo.io
  if (IPINFO_TOKEN.trim().length === 0) {
    return <IGeoData>{}
  }

  let cache = await caches.open('ips')

  const url = `http://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`
  const key = new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  let cachedResponse = await cache.match(key)

  if (cachedResponse) {
    return toGeoData(cachedResponse.clone().json())
  }

  const res = await fetch(url)
  // ince in this case we can predict the size of the payload (which it is not large)
  // we're going for the pragmatic solution of reading the entire body both in production
  // and testing.
  // see https://github.com/zackargyle/service-workers/issues/135

  let str = await res.clone().text()

  if (res.status == 200) {
    let cachedRes = new Response(str, res)
    cachedRes.headers.set('Cache-Control', `max-age=${MAX_AGE}`)
    cache.put(key, cachedRes.clone())

    return toGeoData(cachedRes.json())
  } else if (res.status === 429) {
    // Quota limit reached
    // Any other error might be retriable
    throw new Error(limitErrorMessage)
  }

  return <IGeoData>{}
}

export { ipInfo, IGeoData as GeoData }
