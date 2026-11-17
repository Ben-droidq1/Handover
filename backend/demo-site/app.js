const CART_KEY = 'northwind.cart'

function readCart() {
  try {
    const value = Number(window.localStorage.getItem(CART_KEY))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function writeCart(count) {
  try {
    window.localStorage.setItem(CART_KEY, String(count))
  } catch {
    /* storage disabled */
  }
  renderCart()
}

function renderCart() {
  const count = readCart()
  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = String(count)
  })
}

let toastTimer
function toast(message) {
  let node = document.querySelector('.toast')
  if (!node) {
    node = document.createElement('div')
    node.className = 'toast'
    document.body.appendChild(node)
  }
  node.textContent = message
  node.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200)
}

renderCart()

document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
  button.addEventListener('click', () => {
    writeCart(readCart() + 1)
    toast(`${button.dataset.addToCart} added to your cart`)
  })
})

const signupForm = document.querySelector('#signup-form')
if (signupForm) {
  signupForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const email = signupForm.querySelector('#email').value.trim()
    const password = signupForm.querySelector('#password').value
    const error = document.querySelector('#signup-error')

    if (!email.includes('@') || password.length < 8) {
      if (error) {
        error.textContent = 'Enter a valid email address and a password of at least 8 characters.'
        error.hidden = false
      }
      return
    }
    window.location.href = `dashboard.html?email=${encodeURIComponent(email)}`
  })
}

const dashboardEmail = document.querySelector('[data-account-email]')
if (dashboardEmail) {
  const email = new URLSearchParams(window.location.search).get('email')
  dashboardEmail.textContent = email || 'you@example.com'
}

// ---------------------------------------------------------------------------
// Demo bug: this button never triggers a download. It is intentionally broken
// so the "invoice PDF downloads" acceptance criterion fails during the demo.
// ---------------------------------------------------------------------------
const invoiceButton = document.querySelector('#download-invoice')
if (invoiceButton) {
  invoiceButton.addEventListener('click', () => {
    invoiceButton.textContent = 'Preparing invoice…'
    toast('Preparing your invoice…')
    setTimeout(() => {
      invoiceButton.textContent = 'Download invoice'
    }, 2500)
  })
}

const yearNode = document.querySelector('[data-year]')
if (yearNode) yearNode.textContent = String(new Date().getFullYear())
