document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const submit = form?.querySelector('[type="submit"]');
  if (!form || !submit) return;
  const error = document.createElement('p');
  error.className = 'text-error text-sm mt-2'; error.setAttribute('aria-live', 'polite');
  form.append(error);
  const playLogin = () => {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    const context = new (window.AudioContext || window.webkitAudioContext)(), now = context.currentTime;
    [329.63, 493.88, 659.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now + index * .09); gain.gain.exponentialRampToValueAtTime(.09, now + index * .09 + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .09 + .24);
      oscillator.connect(gain).connect(context.destination); oscillator.start(now + index * .09); oscillator.stop(now + index * .09 + .26);
    });
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); event.stopImmediatePropagation(); error.textContent = '';
    const signup = !document.getElementById('field-handle').classList.contains('hidden');
    const inputs = form.querySelectorAll('input');
    const email = [...inputs].find(input => input.type === 'email')?.value;
    const password = document.getElementById('input-password')?.value;
    const name = document.getElementById('field-handle').querySelector('input')?.value;
    submit.disabled = true;
    try {
      const response = await fetch(signup ? '/api/auth/register' : '/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password, name }) });
      const raw = await response.text();
      let payload = {}; try { payload = JSON.parse(raw); } catch { /* Vercel/route errors are often HTML. */ }
      if (!response.ok) throw new Error(payload.error || `Realm request failed (${response.status}). ${raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)}`);
      if (payload.sessionToken) sessionStorage.setItem('abhyudaya_session', payload.sessionToken);
      playLogin();
      submit.textContent = 'REALM LINK ESTABLISHED';
      setTimeout(() => { location.href = payload.character.onboarding_completed ? 'dashboard.html' : 'onboarding.html'; }, 360);
    } catch (problem) { error.textContent = problem.message; submit.disabled = false; }
  }, true);
});
