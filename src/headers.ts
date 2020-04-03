const SKIP_HEADERS: string[] = [
  'age',
  'etag',
  'server',
  'expires',
  'x-cache',
  'cache-control',
  'host',
  'referer',
  'vary',
  'accept-ranges',
  'date',
  'user-agent',
  'x-forwarded-proto',
]

export function toMetadata(headers: any, prefix: string): Hash<string> {
  let metadata: Hash<string> = {}

  Array.from(headers).forEach(([key, value]: any) => {
    if (SKIP_HEADERS.includes(key)) return
    key = key.replace(/-/g, '_')
    value = value.replace(/"/g, '')
    metadata[`${prefix}_${key}`] = value
  })

  return metadata
}
