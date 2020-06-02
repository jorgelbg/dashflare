const SKIP_HEADERS: string[] = [
  'accept-ranges',
  'age',
  'cache-control',
  'date',
  'etag',
  'expires',
  'host',
  'hostname',
  'referer',
  'server',
  'user-agent',
  'vary',
  'x-cache',
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
