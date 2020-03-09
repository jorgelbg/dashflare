const MAX_AGE = 86400

export async function ipInfo(ip: string): Promise<Hash<string>> {
  let cache = await caches.open('ips')

  const url = `http://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`

  const key = new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await fetch(url)
  if (res.status == 200) {
    let cachedRes = new Response(res.body, res)
    cachedRes.headers.set('Cache-Control', `max-age=${MAX_AGE}`)
    cache.put(key, cachedRes)

    return res.json()
  }

  return {}
}
