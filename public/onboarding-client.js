document.addEventListener('DOMContentLoaded', async () => {
  const api = async (url, options = {}) => { const token = sessionStorage.getItem('abhyudaya_session'); const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || 'Unable to synchronize your character. Start the local server and try again.'); return payload; };
  try { const me = await api('/api/me'); if (me.character.onboarding_completed) { location.href = 'dashboard.html'; return; } }
  catch { location.href = 'auth.html'; return; }
  const button = document.getElementById('btn-forge-character');
  if (!button) return;
  button.addEventListener('click', async (event) => {
    event.preventDefault(); event.stopImmediatePropagation();
    const name = document.getElementById('hero-callsign-input')?.value || 'New Operative';
    const label = document.getElementById('hero-display-class-badge')?.textContent || 'Technomancer';
    const className = /paladin/i.test(label) ? 'Cyber Paladin' : /rogue/i.test(label) ? 'Neural Rogue' : /alchemist/i.test(label) ? 'Chrono Alchemist' : 'Technomancer';
    const stats = Object.fromEntries(['int','foc','dis','vit','str','cre'].map(key => [key, Number(document.getElementById(`val-${key}`)?.textContent || 1)]));
    const directives = [...document.querySelectorAll('.goal-card[data-active="true"]')].map(card => card.dataset.goalId);
    const protocol = document.querySelector('.diff-card[data-selected="true"]')?.dataset.diff || [...document.querySelectorAll('.diff-card')].find(card => card.classList.contains('border-primary/80'))?.dataset.diff || 'balanced';
    const origin_story = document.getElementById('origin-story-input')?.value || '';
    button.disabled = true;
    try { await api('/api/onboarding/complete', { method: 'POST', body: JSON.stringify({ name, class_name: className, stats, directives, protocol, origin_story }) }); button.textContent = 'OPERATIVE FORGED — ENTERING REALM'; setTimeout(() => location.href = 'dashboard.html', 700); }
    catch (error) { button.disabled = false; alert(error.message); }
  }, true);
});
