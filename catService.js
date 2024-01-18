//@ts-check
import {createApi, fetchBaseQuery} from './swQuery.js'

const catService = createApi({
  baseQuery: fetchBaseQuery({baseUrl: 'https://catfact.ninja'}),

  endpoints: builder => ({
    getCatFact: builder.query({
      query: () => ({
        url: `/fact`
      }),
      providesTags: ['cat'],
      // ttl: DEFAULT_TTL,
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
  // @ts-ignore
  createGetCatFactQuery,
  // @ts-ignore
  createAddCatFactMutation,
} = catService
