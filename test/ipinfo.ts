import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { ipInfo } from '../src/ipinfo'
import { captureRejectionSymbol } from 'events'

describe('enabled geolocation', async () => {
  after(() => fetchMock.restore())
  // mock a successfull request to the ipinfo.io API
  fetchMock.mock(`https://api.ipgeolocationapi.com/geolocate/17.110.220.180`, {
    continent: 'North America',
    address_format:
      '{{recipient}}\n{{street}}\n{{city}} {{region_short}} {{postalcode}}\n{{country}}',
    alpha2: 'US',
    alpha3: 'USA',
    country_code: '1',
    international_prefix: '011',
    ioc: 'USA',
    gec: 'US',
    name: 'United States of America',
    national_destination_code_lengths: [3],
    national_number_lengths: [10],
    national_prefix: '1',
    number: '840',
    region: 'Americas',
    subregion: 'Northern America',
    world_region: 'AMER',
    un_locode: 'US',
    nationality: 'American',
    postal_code: true,
    unofficial_names: [
      'United States',
      'Vereinigte Staaten von Amerika',
      'États-Unis',
      'Estados Unidos',
      'アメリカ合衆国',
      'Verenigde Staten',
    ],
    languages_official: ['en'],
    languages_spoken: ['en'],
    geo: {
      latitude: 37.09024,
      latitude_dec: '39.44325637817383',
      longitude: -95.712891,
      longitude_dec: '-98.95733642578125',
      max_latitude: 71.5388001,
      max_longitude: -66.885417,
      min_latitude: 18.7763,
      min_longitude: 170.5957,
      bounds: {
        northeast: {
          lat: 71.5388001,
          lng: -66.885417,
        },
        southwest: {
          lat: 18.7763,
          lng: 170.5957,
        },
      },
    },
    currency_code: 'USD',
    start_of_week: 'sunday',
  })

  // mock a request to the ipinfo.io API that returns a 429 Too Many Requests
  fetchMock.mock(`https://api.ipgeolocationapi.com/geolocate/203.0.113.0`, 429)

  it('fetch the ip information', async () => {
    let res = await ipInfo('17.110.220.180')

    expect(res).to.deep.include({
      country: 'US',
      lat: 37.09024,
      lon: -95.712891,
    })
  })

  it('ip info gets cached', async () => {
    await ipInfo('17.110.220.180')
    let cache = await caches.open('ips')
    const url = `https://api.ipgeolocationapi.com/geolocate/17.110.220.180`
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
  after(() => fetchMock.restore())
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
    expect(fetchMock.calls()).to.be.empty
  })
})
