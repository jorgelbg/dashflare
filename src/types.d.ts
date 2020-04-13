import { KVNamespace } from '@cloudflare/workers-types'

declare global {
  const myKVNamespace: KVNamespace

  interface Hash<T> {
    [key: string]: T
  }

  // The token is provided by cloudflare workers automatically from the secrets
  let IPINFO_TOKEN: string

  // INSTALL_OPTIONS is provided by cloudflare environment
  let INSTALL_OPTIONS: any | undefined
}
