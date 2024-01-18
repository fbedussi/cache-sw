//@ts-check
import './cat-fact.js'

const registerSw = async () => {
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {scope: "./"})
    registration.update();
    console.log("Service worker registration succeeded:", registration)
  } catch (error) {
    console.error(`Service worker registration failed: ${error}`)
  }
}

registerSw()

// reload if page is not controlled as a workaround to the fact that when the page is force reloaded 
// the SW doesn't work
// https://github.com/mswjs/msw/issues/98
if (!navigator.serviceWorker.controller) {
  location.reload()
}
