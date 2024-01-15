const tags = {}

export const getCatFact = async (signal, tag, cleanups) => {
  return navigator.serviceWorker.ready
    .then((registration) => {
      const cb = (event) => {
        if (event.data.type === 'CACHE_ENTRY_INVALIDATED') {
          placeCall()
        }
      }

      const cleanup = () => {
        navigator.serviceWorker.removeEventListener('message', cb)
      }
      cleanup()
      cleanups.push(cleanup)

      navigator.serviceWorker.startMessages()
      navigator.serviceWorker.addEventListener('message', cb)

      const placeCall = () => {
        const req = new Request('https://catfact.ninja/fact', {
          method: 'GET'
        })

        tags[tag] = {
          url: req.url,
          method: req.method,
          body: JSON.stringify(req.body),
          ttl: 1000 * 60 * 60,
        }

        registration.active.postMessage({
          type: 'TTL',
          req: tags[tag],
        });

        fetch(req)
          .then(res => {
            return res.json()
          })
          .then(res => {
            signal.value = res.fact
          })
      }

      placeCall()
    });
}

export const invalidateCacheEntry = (tag) => {
  navigator.serviceWorker.ready.then((registration) => {
    registration.active.postMessage({
      type: 'INVALIDATE_CACHE_ENTRY',
      req: tags[tag],
    });
  })
}
