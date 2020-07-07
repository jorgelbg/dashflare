import { KVNamespace } from '@cloudflare/workers-types'

declare global {
  const myKVNamespace: KVNamespace

  interface Hash<T> {
    [key: string]: T
  }

  // The token is provided by cloudflare workers automatically from the secrets
  let IPINFO_TOKEN: string

  // The client id
  let CLIENT_ID: string

  // Host where loki is hosted.
  // Cannot be an IP address, nor contain a custom port (other than 80/443) since it is currently not
  // supported by Cloudflare workers.
  let LOKI_HOST: string

  // Base key used for calculating the session fingerprint
  let FINGERPRINT: string

  // OPTIONS is fetched from an environment variable set in the worker configuration
  let OPTIONS: any
}
