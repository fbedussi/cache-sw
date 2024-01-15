import './cat-fact.js'

navigator.serviceWorker.register("/sw.js", {scope: "./"}).then(
  (registration) => {
    registration.update();

    console.log("Service worker registration succeeded:", registration);
  },
  (error) => {
    console.error(`Service worker registration failed: ${error}`);
  })
