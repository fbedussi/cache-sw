import {render, html, signal} from 'https://cdn.jsdelivr.net/npm/uhtml/preactive.js'
import {getCatFact, invalidateCacheEntry} from './service.js'

customElements.define('cat-fact', class extends HTMLElement {
  constructor() {
    super()
    this.cleanups = []
  }

  connectedCallback() {
    this.catFact = signal('')
    getCatFact(this.catFact, 'cat', this.cleanups)
    render(this, this.render)
  }

  disconnectedCallback() {
    this.cleanups.forEach(cleanup => cleanup())
  }

  render = () => html`
      <div>
        <h1>Cat fact of the day</h1>
        <p>${this.catFact.value}</p>
        <button onclick=${() => {
      invalidateCacheEntry('cat')
    }}>change cat fact</button>
      </div>
  `
})
