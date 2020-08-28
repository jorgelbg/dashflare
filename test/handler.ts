import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { handleRequest } from '../src/handler'

describe('request handler', () => {
  fetchMock.mock(`http://example.com/`, 200)
  fetchMock.mock(`http://localhost/api/prom/push`, 200)

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
    let lokiPOST = fetchMock.calls('http://localhost/api/prom/push')[0][1].body
    expect(lokiPOST).to.be.include('geohash=\\"9q9hr46y5\\"')
  })
})
