export function toMetadata(headers: any, prefix: string): Hash<string> {
  let metadata: Hash<string> = {}

  Array.from(headers).forEach(([key, value]: any) => {
    key = key.replace(/-/g, '_')
    value = value.replace(/"/g, '')
    metadata[`${prefix}_${key}`] = value
  })

  return metadata
}
