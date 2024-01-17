import {signal} from 'https://cdn.jsdelivr.net/npm/uhtml/preactive.js'
//@ts-check

const tagsMap = {}

const DEFAULT_TTL = 1000 * 60 * 60

const querySignal = signal()

const getQuerySignalCreator = ({
  tags,
  ttl = DEFAULT_TTL,
  query,
  baseUrl,
  fetchFn,
}) => (cleanups, args) => {

  navigator.serviceWorker.ready
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

      const queryData = query(args)
      const url = `${baseUrl}${queryData.url}`
      const requestInfo = structuredClone(queryData)
      delete requestInfo.url

      const tagInfo = {
        url,
        method: queryData.method || 'GET',
        ttl,
        body: queryData.body ? JSON.stringify(queryData.body) : null,
      }
      tags.forEach(tag => {
        tagsMap[tag] = tagInfo
      })

      registration.active?.postMessage({
        type: 'TTL',
        req: tagInfo,
      });

      const placeCall = () => {
        const request = new Request(url, requestInfo)

        fetchFn(request)
          .then(res => res.json())
          .then(data => {
            querySignal.value = {
              data
            }
          })
          .catch(error => {
            querySignal.value = {error}
          })
      }

      placeCall()
    })

  return querySignal
}

const createApi = ({baseQuery, endpoints}) => {
  const {
    baseUrl,
    fetchFn,
  } = baseQuery

  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({
        type: 'HANDLE_URL',
        url: baseUrl,
      })
    })

  const getBuilder = () => ({
    query: ({query, providesTags, ttl}) => endpointName => {
      return {
        name: `create${endpointName}QuerySignal`,
        signalCreator: getQuerySignalCreator({
          tags: providesTags,
          ttl,
          query,
          baseUrl,
          fetchFn,
        }),
      }
    },
  })

  const signalCreators = Object.entries(endpoints(getBuilder()))
    .reduce((result, [endpointName, endpointFn]) => {
      const endpointData = endpointFn(endpointName)
      result[endpointData.name] = endpointData.signalCreator
      return result
    }, {})

  return signalCreators
}

const fetchBaseQuery = ({baseUrl}) => ({
  baseUrl,
  fetchFn: window.fetch,
})

const catService = createApi({
  baseQuery: fetchBaseQuery({baseUrl: 'https://catfact.ninja'}),

  endpoints: builder => ({
    GetCatFact: builder.query({
      query: () => ({
        url: `/fact`
      }),
      providesTags: ['cat'],
      ttl: DEFAULT_TTL,
    })
  })
})

export const {createGetCatFactQuerySignal} = catService

export const invalidateCacheEntry = (tag) => {
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({
      type: 'INVALIDATE_CACHE_ENTRY',
      req: tagsMap[tag],
    })
  })
}
