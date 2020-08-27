import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { ipInfo } from '../src/ipinfo'

fetchMock.mock(`http://ipinfo.io/17.110.220.180/json?token=test-token`, {
  ip: '17.110.220.180',
  city: 'Cupertino',
  region: 'California',
  country: 'US',
  loc: '37.3230,-122.0322',
  org: 'AS714 Apple Inc.',
  postal: '95014',
  timezone: 'America/Los_Angeles',
})

fetchMock.mock(`http://ipinfo.io/203.0.113.0/json?token=test-token`, 429)

describe('enabled geolocation', async () => {
  it('fetch the ip information', async () => {
    let res = await ipInfo('17.110.220.180')
    expect(res).to.deep.include({
      ip: '17.110.220.180',
      country: 'US',
      loc: '37.3230,-122.0322',
    })
  })

  it('ip info gets cached', async () => {
    let res = await ipInfo('17.110.220.180')
    let cache = await caches.open('ips')
    const url = `http://ipinfo.io/17.110.220.180/json?token=${IPINFO_TOKEN}`
    expect(await cache.match(url)).to.include({ url })
  })

  it('quota limit reached', (done) => {
    ipInfo('203.0.113.0').catch((e) => {
      try {
        expect(e)
          .to.be.an('error')
          .and.have.property(
            'message',
            'You have exceeded the number of requests per month. Visit https://ipinfo.io/account to see your API limits.',
          )
      } catch (error) {
        done(error)
        return
      }

      done()
    })
  })
})

describe('disabled geolocation', async () => {
  let oldToken = IPINFO_TOKEN

  before(() => {
    IPINFO_TOKEN = ''
  })

  after(() => {
    IPINFO_TOKEN = oldToken
  })

  it('empty result', async () => {
    let res = await ipInfo('17.110.220.180')
    expect(res).to.be.empty
  })
})