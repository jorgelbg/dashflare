// set up global namespace for worker environment
import { default as makeServiceWorkerEnv } from 'service-worker-mock'
declare var global: any
declare global {
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

var DEFAULT_OPTIONS = {
  IPINFO_TOKEN: 'test-token',
  CLIENT_ID: 'client-id',
  LOKI_HOST: 'localhost',
  FINGERPRINT: 'some-uuid',
  OPTIONS: JSON.stringify({
    css: false,
    images: false,
    js: false,
    ip: false,
  }),
}

Object.assign(global, makeServiceWorkerEnv())
Object.assign(global, DEFAULT_OPTIONS)
