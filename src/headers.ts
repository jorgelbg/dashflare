export function toMetadata(headers: any): Hash<string> {
  let metadata: Hash<string> = {}

  Array.from(headers).forEach(([key, value]: any) => {
    metadata[key] = value
  })

  return metadata
}
