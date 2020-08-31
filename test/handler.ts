import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { handleRequest } from '../src/handler'

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
        'geohash=9q9hr46y5',
        'country_name=United States of America',
        'method=GET',
        'status=200',
        'domain=example.com',
      ].every((bit) => string.includes(bit)),
    )
    expect(body).to.not.include('17.110.220.180')
  })
})
