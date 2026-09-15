import { registerSW } from 'virtual:pwa-register'
import { renderApp } from './app/app'
import './app/styles.css'

renderApp(document.querySelector<HTMLDivElement>('#app'))

type UpdateCheckResult = 'available' | 'current' | 'offline' | 'unsupported' | 'error'

let serviceWorkerRegistration: ServiceWorkerRegistration | undefined
let updateAvailable = false
let lastAutomaticCheck = 0

function announceUpdate(): void {
  updateAvailable = true
  window.dispatchEvent(
    new CustomEvent('app-update-available', {
      detail: () => updateServiceWorker(true)
    })
  )
}

const updateServiceWorker = registerSW({
  onNeedRefresh: announceUpdate,
  onRegisteredSW(_serviceWorkerUrl, registration) {
    serviceWorkerRegistration = registration
    void checkForUpdate(false)
  }
})

async function waitForInstallation(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing
  if (!worker || worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') return
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 5000)
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed' && worker.state !== 'activated' && worker.state !== 'redundant') return
      window.clearTimeout(timeout)
      resolve()
    })
  })
}

async function checkForUpdate(manual: boolean): Promise<UpdateCheckResult> {
  if (!('serviceWorker' in navigator) || !serviceWorkerRegistration) return 'unsupported'
  if (!navigator.onLine) return 'offline'
  if (!manual && Date.now() - lastAutomaticCheck < 5 * 60 * 1000) return updateAvailable ? 'available' : 'current'

  lastAutomaticCheck = Date.now()
  try {
    await serviceWorkerRegistration.update()
    await waitForInstallation(serviceWorkerRegistration)
    if (serviceWorkerRegistration.waiting || updateAvailable) {
      announceUpdate()
      return 'available'
    }
    return 'current'
  } catch {
    return 'error'
  }
}

window.addEventListener('app-check-for-update', ((event: CustomEvent<(result: UpdateCheckResult) => void>) => {
  void checkForUpdate(true).then(event.detail)
}) as EventListener)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForUpdate(false)
})
window.addEventListener('online', () => void checkForUpdate(false))
window.setInterval(() => void checkForUpdate(false), 60 * 60 * 1000)
