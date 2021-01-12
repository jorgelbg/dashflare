const limitErrorMessage: string = 'You have exceeded the number of requests'
const MAX_AGE = 86400

interface IGeoData {
  readonly city: string
  readonly country: string
  readonly lat: number
  readonly lon: number
}

function toGeoData(res: Promise<Hash<any>>): Promise<IGeoData> {
  return res
    .then((ip) => {
      return <IGeoData>{
        city: '',
        country: ip.alpha2,
        lat: ip.geo.latitude,
        lon: ip.geo.longitude,
      }
    })
    .catch(() => <IGeoData>{})
}

async function ipInfo(ip: string): Promise<IGeoData> {
  // If the IPINFO variable is empty we assume that the geolocation has been disabled by the
  // user and avoid requesting any info from the API
  if (IPINFO.trim().length === 0 || IPINFO.trim().toLowerCase() == 'false') {
    return <IGeoData>{}
  }

  let cache = await caches.open('ips')

  const url = `https://api.ipgeolocationapi.com/geolocate/${ip}`
  const key = new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  let cachedResponse = await cache.match(key)

  if (cachedResponse) {
    return toGeoData(cachedResponse.clone().json())
  }

  const res = await fetch(url)
  // in this case we can predict the size of the payload (which it is not large)
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
  } else {
    throw new Error(`Unexpected response: ${res.text()}`)
  }

  return <IGeoData>{}
}

export { ipInfo, IGeoData as GeoData }
