// We load the referers database using webpack's js-yaml-loader
// @ts-ignore
import * as source from '../referers-latest.yaml'

interface RefererInfo {
  known: Boolean
  referer?: string
  medium?: string
  params?: string[]
  terms?: string
}

interface RefererData {
  name: string
  medium: string
  params: Array<string>
}

let REFERERS: Hash<RefererData> = {}
for (const medium in source) {
  let list = source[medium]

  for (const name in list) {
    let config = list[name]
    let params = null

    if (config.parameters) {
      params = config.parameters.map(function (p: string) {
        return p.toLowerCase()
      })
    }

    for (const idx in config.domains) {
      if (config.domains.hasOwnProperty(idx)) {
        const domain: string = config.domains[idx]

        // console.log({ name, medium, params, domain })
        REFERERS[domain] = {
          name,
          medium,
          params,
        }
      }
    }
  }
}

function lookup(hostname: string, path?: string): RefererData | null {
  let referer = REFERERS[hostname]

  if (path != null) {
    referer = REFERERS[hostname + path]
  }

  // heuristic ported from
  // https://github.com/snowplow-referer-parser/nodejs-referer-parser/blob/develop/index.js#L102-L113
  https: if (referer == null && path != null) {
    let parts = path.split('/')
    if (parts.length > 0) {
      referer = REFERERS[`${hostname}/${parts[1]}`]
    }
  }

  // heuristic ported from
  // https://github.com/snowplow-referer-parser/nodejs-referer-parser/blob/develop/index.js#L115-L129
  if (referer == null) {
    let idx = hostname.indexOf('.')
    if (idx != -1) {
      let newHost = hostname.slice(idx + 1)
      return lookup(newHost, path)
    }
  }

  return referer
}

export function parse(url: string, domain?: string): RefererInfo | null {
  let uri = new URL(url)
  let ref: RefererInfo = {
    medium: 'unknown',
    known: Boolean(~['http:', 'https:'].indexOf(uri.protocol)),
  }

  // TODO: return empty RefererInfo?
  if (!ref.known) {
    return null
  }

  // handle internal referers
  // if (domain && domain == uri.hostname) {
  //   ref.medium = 'internal'
  //   return ref
  // }

  // fetch the data from the domain/path of the URI
  let data = lookup(uri.hostname)
  if (data != null) {
    ref.medium = data.medium
    ref.referer = data.name
  }

  // TODO: populate params and terms

  return ref
}
