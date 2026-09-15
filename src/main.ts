import { registerSW } from 'virtual:pwa-register'
import { renderApp } from './app/app'
import './app/styles.css'

renderApp(document.querySelector<HTMLDivElement>('#app'))

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('app-update-available', { detail: updateServiceWorker })
    )
  }
})

