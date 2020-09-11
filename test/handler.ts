import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { handleRequest, levelFromStatus } from '../src/handler'

describe('request handler', () => {
  fetchMock.mock(`http://example.com/`, 200)
  fetchMock.mock(`http://loki:3100/api/prom/push`, 200)

  it('sends payload to storage', async () => {
    const headers: HeadersInit = new Headers({
      'x-forwarded-proto': 'https',
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '17.110.220.180',
      host: 'some.google.host',
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
    expect(body).to.satisfy((string) =>
      [
        'os=Mac OS',
        'device_type=desktop',
        'country=US',
        'geohash=9yegjbpfr',
        'country_name=United States of America',
        'method=GET',
        'status=200',
        'domain=example.com',
      ].every((bit) => string.includes(bit)),
    )
    expect(body).to.not.include('17.110.220.180')
  })

  it('avoid fetching upstream when the URL is forwarded', async () => {
    const headers: HeadersInit = new Headers({
      'x-forwarded-proto': 'https',
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '17.110.220.180',
      host: 'dashflare.test.workers.dev',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9',
      'x-original-url': 'https://example.com',
      referer: 'https://t.co/gJV9DEbJVy',
    })

    const event = new FetchEvent('fetch', {
      request: new Request('https://dashflare.test.workers.dev?forward=true', {
        headers,
      }),
    })

    const res = await handleRequest(event)
    expect(await res.text()).to.equal('ok')

    let body = fetchMock.calls('http://loki:3100/api/prom/push')[1][1].body
    expect(body).to.satisfy((string) =>
      [
        'status=200',
        // domain is extracted from the x-original-url header
        'domain=example.com',
        // the referer of the original request is detected and parsed
        'network=twitter',
        'type=social',
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
