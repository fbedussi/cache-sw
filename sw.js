const CACHE_NAME = 'api';

const cachedUrls = [
  "https://catfact.ninja/fact"
]

const ttlMap = {}

const getKey = request => {
  return request.url + request.method + request.body
}

const isValid = function (request, response) {
  if (!response) {
    return false
  }

  const key = getKey(request)
  const ttl = ttlMap[key] ?? 1000 * 60 * 60 * 2

  const fetched = response.headers.get('sw-fetched-on')

  return fetched && (parseFloat(fetched) + (ttl)) > new Date().getTime()
};


const cloneResponse = async (response, extraHeaders) => {
  if (!response) {
    return
  }

  const init = {
    status: response.status,
    statusText: response.statusText,
    headers: extraHeaders || {},
  }

  response.headers.forEach(function (val, key) {
    init.headers[key] = val
  })

  const blob = await response.blob()

  return new Response(blob, init)
}

self.addEventListener('message', async (event) => {
  if (event.data?.type === 'TTL') {
    const key = getKey(event.data.req)
    ttlMap[key] = event.data.req.ttl
  }

  if (event.data?.type === 'INVALIDATE_CACHE_ENTRY') {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    const matchingKeys = keys.filter((request) => {
      return request.url === event.data.req.url &&
        request.method === event.data.req.method &&
        request.body === JSON.parse(event.data.req.body)
    })
    await Promise.all(matchingKeys.map(request => cache.delete(request)))
    // delete pending[getKey(event.data.req)]


    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    })

    clients?.forEach(client => {
      client.postMessage({
        type: 'CACHE_ENTRY_INVALIDATED',
        req: event.data.req,
      })
    })
  }
})

const addTimestamp = async response => {
  var copy = response.clone()
  var headers = new Headers(copy.headers)
  headers.append('sw-fetched-on', new Date().getTime())
  const body = await copy.blob()
  const responseWithTimestamp = new Response(body, {
    status: copy.status,
    statusText: copy.statusText,
    headers: headers
  })

  return responseWithTimestamp
}

const pending = {}

const applyCacheFirstStrategy = (event) => {
  const key = getKey(event.request)

  const pendingResponse = pending[key]

  if (pendingResponse) {
    console.log('waiting pending response', key)
    event.respondWith(pendingResponse.then(res => {
      console.log('resolving pending response', key)
      return res.clone()
    }))
    return
  }

  const response = caches.open(CACHE_NAME).then(async cache => {
    try {
      const cachedResponse = await cache.match(event.request)

      if (isValid(event.request, cachedResponse)) {
        console.log('responding with cached response', key)
        delete pending[key]
        return cachedResponse;
      }
      const fetchedResponse = await fetch(event.request)

      //  Add the network response to the cache for later visits
      const responseWithTimestamp = await addTimestamp(fetchedResponse)
      cache.put(event.request, responseWithTimestamp).then(() => {
        console.log('deleting pending response', key)
        delete pending[key]
      })

      console.log('returning fetched response', key)
      return fetchedResponse
    } catch (err) {
      // Otherwise, make a fresh API call
      return caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || caches.match('/offline.json');
      });
    }
  })

  pending[key] = response.then(res => res.clone())

  event.respondWith(response)
}

const applyNetworkFirstStrategy = async event => {
  try {
    const cache = await caches.open(CACHE_NAME)
    const fetchedResponse = await fetch(event.request.url)
    const clonedResponse = await cloneResponse(fetchedResponse, {'sw-fetched-on': new Date().getTime()})
    cache.put(event.request, clonedResponse)
    // Go to the network first
    event.respondWith(fetchedResponse)
  } catch (err) {
    return cache.match(event.request.url)
  }
}

self.addEventListener('fetch', async (event) => {
  if (event.type !== 'fetch' || !cachedUrls.includes(event.request.url)) {
    return
  }

  if (event.request.cache === 'default') {
    applyCacheFirstStrategy(event)
  } else {
    applyNetworkFirstStrategy(event)
  }
})
