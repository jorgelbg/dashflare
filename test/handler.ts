import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { handleRequest, levelFromStatus } from '../src/handler'

/**
 * StoragePayload is a test only utility for dynamically accessing any property present in
 * the JSON payload sent to our storage layer as key (string) to value (any).
 *
 * TODO: jorgelbg: perhaps create a dedicated type/class for this
 */
interface StoragePayload {
  [key: string]: any
}

describe('request handler', () => {
  fetchMock.mock(`http://example.com/`, 200)
  fetchMock.mock(`http://loki:3100/api/prom/push`, 200)

  it('sends payload to storage', async () => {
    const headers: HeadersInit = new Headers({
      host: 'some.google.host',
      'x-forwarded-proto': 'https',
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '17.110.220.180',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
    })

    const event = new FetchEvent('fetch', {
      request: new Request('http://example.com', {
        headers,
      }),
    })

    const res = await handleRequest(event)
    let body = fetchMock.calls('http://loki:3100/api/prom/push')[0][1].body

    var bodyObj: StoragePayload
    bodyObj = JSON.parse(body.toString())

    expect(bodyObj.streams[0].entries[0].line).to.satisfy((string) =>
      [
        'os="Mac OS"',
        'device_type=desktop',
        'country=US',
        'geohash=9yegjbpfr',
        'country_name="United States of America"',
        'method=GET',
        'status=200',
        'domain=example.com',
      ].every((bit) => string.includes(bit)),
    )
    expect(bodyObj.streams[0].entries[0].line).to.not.include('17.110.220.180')
  })

  it('avoid fetching upstream when the URL is forwarded', async () => {
    const headers: HeadersInit = new Headers({
      host: 'dashflare.test.workers.dev',
      'x-forwarded-proto': 'https',
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '17.110.220.180',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
      'x-original-url': 'https://example.com',
      referer: 'https://t.co/gJV9DEbJVy',
    })

    const event = new FetchEvent('fetch', {
      request: new Request('https://dashflare.test.workers.dev', {
        headers,
      }),
    })

    const res = await handleRequest(event)
    expect(await res.text()).to.equal('ok')

    let body = fetchMock.calls('http://loki:3100/api/prom/push')[1][1].body

    var bodyObj: StoragePayload
    bodyObj = JSON.parse(body.toString())

    expect(bodyObj.streams[0].entries[0].line).to.satisfy((string) =>
      [
        'status=200',
        // domain is extracted from the x-original-url header
        'domain=example.com',
        // the referer of the original request is detected and parsed
        'network=twitter',
        'type=social',
        'referer_domain=t.co',
      ].every((bit) => string.includes(bit)),
    )
  })

  it('uses the x-original-ip header when the URL is forwarded', async () => {
    const headers: HeadersInit = new Headers({
      host: 'dashflare.test.workers.dev',
      'x-forwarded-proto': 'https',
      'cf-ipcountry': 'US',
      // 1.1.1.1 is an example IP set by cloudflare when the request is forwarded
      'cf-connecting-ip': '1.1.1.1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
      'x-original-url': 'https://example.com',
      'x-original-ip': '17.110.220.180',
      referer: 'https://t.co/gJV9DEbJVy',
    })

    const event = new FetchEvent('fetch', {
      request: new Request('https://dashflare.test.workers.dev', {
        headers,
      }),
    })

    const res = await handleRequest(event)
    expect(await res.text()).to.equal('ok')

    let body = fetchMock.calls('http://loki:3100/api/prom/push')[2][1].body
    var bodyObj: StoragePayload
    bodyObj = JSON.parse(body.toString())

    expect(bodyObj.streams[0].entries[0].line).to.satisfy((string) =>
      [
        'status=200',
        // domain is extracted from the x-original-url header
        'domain=example.com',
        // the referer of the original request is detected and parsed
        'network=twitter',
        'type=social',
        'geohash=9yegjbpfr',
      ].every((bit) => string.includes(bit)),
    )
  })
})

describe('preprocessing', () => {
  it('translate the status code into a log level', () => {
    expect(levelFromStatus(100)).to.equal('trace')
    expect(levelFromStatus(102)).to.equal('trace')

    expect(levelFromStatus(200)).to.equal('info')
    expect(levelFromStatus(202)).to.equal('info')

    expect(levelFromStatus(300)).to.equal('warn')
    expect(levelFromStatus(302)).to.equal('warn')

    expect(levelFromStatus(400)).to.equal('error')
    expect(levelFromStatus(404)).to.equal('error')

    expect(levelFromStatus(500)).to.equal('error')
    expect(levelFromStatus(522)).to.equal('error')
  })
})
