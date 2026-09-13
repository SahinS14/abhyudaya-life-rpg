const $ = (selector) => document.querySelector(selector);
const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
};
const esc = (value) => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
let hero;
function paintHero(character) {
  hero = character;
  $('#hero-name').textContent = `Welcome, ${character.name}`;
  $('#hero-class').textContent = `${character.class_name} · Every completed quest shapes your legend.`;
  ['level','gold','strength','intellect','focus','discipline'].forEach(key => { $(`#${key}`).textContent = character[key]; });
  $('#xp').textContent = `${character.xp} XP`;
  $('#streak').textContent = `${character.current_streak} day${character.current_streak === 1 ? '' : 's'}`;
}
async function refresh() {
  const [me, tasks, shop, activity] = await Promise.all([api('/api/me'), api('/api/tasks'), api('/api/shop'), api('/api/activity')]);
  paintHero(me.character);
  $('#task-list').innerHTML = tasks.length ? tasks.map(task => `<article class="quest"><div><h3>${esc(task.title)}</h3><p>${esc(task.description || 'No briefing attached.')}</p><div class="tags"><span class="tag">${esc(task.attribute)} +1</span><span class="tag">+${task.xp_reward} XP</span><span class="tag">+${task.gold_reward} gold</span>${task.completed ? '<span class="tag">completed</span>' : ''}</div></div>${task.completed ? '<button class="subtle" disabled>Complete</button>' : `<button class="complete" data-complete="${task.id}">Complete</button>`}</article>`).join('') : '<p class="empty">No active quests. Forge your first operation.</p>';
  $('#shop-list').innerHTML = shop.map(item => `<div class="shop-item"><span class="icon">${item.icon}</span><div><b>${esc(item.name)}</b><small>${item.price} gold · ${esc(item.category)}</small></div>${item.owned ? '<button class="subtle" disabled>Owned</button>' : `<button data-buy="${item.id}">Buy</button>`}</div>`).join('');
  $('#activity-list').innerHTML = activity.length ? activity.slice(0, 8).map(entry => `<div class="activity"><b>${esc(entry.message)}</b> <span>${entry.xp_delta ? `+${entry.xp_delta} XP` : ''} ${entry.gold_delta ? `${entry.gold_delta > 0 ? '+' : ''}${entry.gold_delta} gold` : ''}</span></div>`).join('') : '<p class="empty">Your legend begins with a completed quest.</p>';
  $('#status').textContent = 'Realm synchronized';
}
document.addEventListener('click', async (event) => {
  const complete = event.target.closest('[data-complete]');
  const buy = event.target.closest('[data-buy]');
  if (!complete && !buy) return;
  const button = complete || buy; button.disabled = true;
  try {
    $('#status').textContent = complete ? 'Resolving quest…' : 'Acquiring reward…';
    const result = complete ? await api(`/api/tasks/${complete.dataset.complete}/complete`, { method: 'POST' }) : await api(`/api/shop/${buy.dataset.buy}/purchase`, { method: 'POST' });
    if (result.character) paintHero(result.character);
    if (result.levelUp) alert(`Level up! You are now level ${result.character.level}.`);
    await refresh();
  } catch (error) { button.disabled = false; alert(error.message); }
});
$('#new-quest').addEventListener('click', () => $('#quest-dialog').showModal());
$('#close-dialog').addEventListener('click', () => $('#quest-dialog').close());
$('#cancel-dialog').addEventListener('click', () => $('#quest-dialog').close());
$('#quest-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const xp = Number(form.get('difficulty'));
  try { await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: form.get('title'), description: form.get('description'), attribute: form.get('attribute'), xp_reward: xp, gold_reward: Math.max(5, Math.round(xp / 3)) }) }); event.currentTarget.reset(); $('#quest-dialog').close(); await refresh(); }
  catch (error) { $('#form-error').textContent = error.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = 'auth.html'; });
(async () => { try { await refresh(); } catch { location.href = 'auth.html'; } })();
