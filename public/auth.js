document.querySelectorAll('.show-button').forEach(button => {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('login-error');
    const data = Object.fromEntries(new FormData(loginForm));
    message.textContent = '';
    try {
      const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) return message.textContent = result.error;
      window.location.href = result.redirect;
    } catch (error) { message.textContent = 'Unable to log in. Please try again.'; }
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('register-message');
    const data = Object.fromEntries(new FormData(registerForm));
    try {
      const response = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { message.className='form-message error'; return message.textContent=result.error; }
      registerForm.classList.add('hidden');
      message.className='form-message';
      message.textContent=result.message;
      document.getElementById('back-login').classList.remove('hidden');
    } catch (error) { message.className='form-message error'; message.textContent='Unable to submit registration. Please try again.'; }
  });
}
