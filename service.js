import {signal} from 'https://cdn.jsdelivr.net/npm/uhtml/preactive.js'
//@ts-check

const tagsMap = {}

const DEFAULT_TTL = 1000 * 60 * 60

const getQuerySignalCreator = ({
  tags,
  ttl = DEFAULT_TTL,
  query,
  baseUrl,
  fetchFn,
}) => (cleanups, args) => {
  const querySignal = signal({
    isLoading: false,
    data: undefined,
    error: undefined,
  })

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

        querySignal.value = {
          ...querySignal.value,
          isLoading: true,
        }
        fetchFn(request)
          .then(res => res.json())
          .then(data => {
            querySignal.value = {
              data,
              isLoading: false,
            }
          })
          .catch(error => {
            querySignal.value = {
              error,
              isLoading: false
            }
          })
      }

      placeCall()
    })

  return querySignal
}

const getMutationCreator = ({
  invalidatesTags,
  query,
  baseUrl,
  fetchFn,
}) => {
  const resultSignal = signal({
    isLoading: false,
    data: undefined,
    error: undefined,
  })

  const placeCall = (args) => {
    const mutationData = query(args)
    const url = `${baseUrl}${mutationData.url}`
    delete mutationData.url
    if (mutationData.body) {
      mutationData.body = JSON.stringify(mutationData.body)
    }

    const request = new Request(url, mutationData)

    resultSignal.value = {
      ...resultSignal.value,
      isLoading: true,
    }

    fetchFn(request)
      .then(async res => {
        if (res.ok) {
          const data = await res.json()
          resultSignal.value = {
            data: {
              code: res.status,
              statusText: res.statusText,
              data,
            },
            isError: false,
            isSuccess: true,
            isLoading: false,
          }
          invalidatesTags.forEach(tag => invalidateCacheEntry(tag))
        } else {
          const data = await res.text()
          resultSignal.value = {
            error: {
              code: res.status,
              statusText: res.statusText,
              message: data,
            },
            isError: true,
            isSuccess: false,
            isLoading: false
          }
        }
      })
  }

  return {
    mutationFn: (args) => navigator.serviceWorker.ready.then(() => {
      placeCall(args)
    }),
    resultSignal,
  }
}

const capitalize = (str) => {
  return str.split('').map((c, i) => i === 0 ? c.toUpperCase() : c).join('')
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
        type: 'query',
        name: `create${capitalize(endpointName)}Query`,
        signalCreator: getQuerySignalCreator({
          tags: providesTags,
          ttl,
          query,
          baseUrl,
          fetchFn,
        }),
      }
    },
    mutation: ({query, invalidatesTags}) => endpointName => {
      const {mutationFn, resultSignal} = getMutationCreator({
        query,
        invalidatesTags,
        baseUrl,
        fetchFn
      })
      return {
        type: 'mutation',
        name: `create${capitalize(endpointName)}Mutation`,
        mutationFn,
        resultSignal,
      }
    }
  })

  const signalCreators = Object.entries(endpoints(getBuilder()))
    .reduce((result, [endpointName, endpointFn]) => {
      const endpointData = endpointFn(endpointName)
      result[endpointData.name] = endpointData.type === 'query' ? endpointData.signalCreator : () => [endpointData.mutationFn, endpointData.resultSignal]
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
    getCatFact: builder.query({
      query: () => ({
        url: `/fact`
      }),
      providesTags: ['cat'],
      ttl: DEFAULT_TTL,
    }),
    addCatFact: builder.mutation({
      query: (body) => ({
        url: `/fact`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['cat'],
    })
  })
})

export const {
  createGetCatFactQuery,
  createAddCatFactMutation,
} = catService

export const invalidateCacheEntry = (tag) => {
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({
      type: 'INVALIDATE_CACHE_ENTRY',
      req: tagsMap[tag],
    })
  })
}
