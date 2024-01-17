import {render, html} from 'https://cdn.jsdelivr.net/npm/uhtml/preactive.js'
import {createGetCatFactQuerySignal, invalidateCacheEntry} from './service.js'

customElements.define('cat-fact', class extends HTMLElement {
  constructor() {
    super()
    this.cleanups = []
  }

  connectedCallback() {
    this.catFact = createGetCatFactQuerySignal(this.cleanups)
    render(this, this.render)
  }

  disconnectedCallback() {
    this.cleanups.forEach(cleanup => cleanup())
  }

  render = () => html`
      <div>
        <h1>Cat fact of the day</h1>
        <p>${this.catFact.value?.data?.fact}</p>
        <button onclick=${() => {
      invalidateCacheEntry('cat')
    }}>change cat fact</button>
      </div>
  `
})
