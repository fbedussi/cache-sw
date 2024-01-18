import {render, html} from 'https://cdn.jsdelivr.net/npm/uhtml/preactive.js'
import {createGetCatFactQuery, createAddCatFactMutation, invalidateCacheEntry} from './service.js'

customElements.define('cat-fact', class extends HTMLElement {
  constructor() {
    super()
    this.cleanups = []
  }

  connectedCallback() {
    this.catFact = createGetCatFactQuery(this.cleanups)
    const [postNewFact, postNewFactResult] = createAddCatFactMutation()
    this.postNewFact = postNewFact
    this.postNewFactResult = postNewFactResult
    render(this, this.render)
  }

  disconnectedCallback() {
    this.cleanups.forEach(cleanup => cleanup())
  }

  render = () => html`
      <div>
        <h1>Cat fact of the day</h1>
        <p>${this.catFact.value.isLoading ? 'loading...' : this.catFact.value.data?.fact}</p>
        <button onclick=${() => invalidateCacheEntry('cat')}>change cat fact</button>
        <button onclick=${() => {
          this.postNewFact({
            id: '1',
            text: 'hi',
          })
        }}>
          Post a new fact
        </button>
        ${this.postNewFactResult.value.error 
          ? html`<div>${this.postNewFactResult.value.error}</div>` 
          : ''}
      </div>
  `
})
