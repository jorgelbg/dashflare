import { handleRequest } from './handler'

addEventListener('fetch', event => {
  event.passThroughOnException()
  event.respondWith(handleRequest(event))
})
