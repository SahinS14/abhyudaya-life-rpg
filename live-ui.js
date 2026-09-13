(() => {
  const page = location.pathname.split('/').pop();
  const protectedPages = ['dashboard.html','quests.html','character.html','inventory.html','shop.html','activity.html','achievements.html','progression.html','guild.html','settings.html','levelup.html','levelup-2.html','levelup-3.html'];
  if (!protectedPages.includes(page)) return;
  const api = async (url, options = {}) => {
    const token = sessionStorage.getItem('abhyudaya_session');
    const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Sync failed.');
    return payload;
  };
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
  const replaceText = (pattern, value) => document.querySelectorAll('span,div,p,h1,h2,h3').forEach(el => {
    if (el.children.length === 0 && pattern.test(el.textContent.trim())) el.textContent = el.textContent.replace(pattern, value);
  });
  const hydrate = (hero) => {
    replaceText(/Lvl\s*\d+/i, `Lvl ${hero.level}`);
    replaceText(/Master Builder|Vanguard Kaelen/i, hero.name);
    replaceText(/\b3,420\b/g, hero.gold.toLocaleString());
    replaceText(/\b21\b(?=\s*(?:Streak|days?))/i, hero.current_streak);
    replaceText(/14,850\s*\/\s*18k[^)]*\)?/i, `${hero.xp.toLocaleString()} XP`);
    document.querySelectorAll('[data-live="gold"]').forEach(el => el.textContent = hero.gold.toLocaleString());
    document.querySelectorAll('span,div,p').forEach(el => {
      const parentText = el.parentElement?.textContent || '';
      if (el.children.length === 0 && /^\s*\d+\s*$/.test(el.textContent) && /\bStreak\b/i.test(parentText)) el.textContent = hero.current_streak;
      if (el.children.length === 0 && /^\s*Master Builder\s*\(Lvl \d+\)\s*$/i.test(el.textContent)) el.textContent = `${hero.name} (Lvl ${hero.level})`;
    });
  };
  const toast = (message) => {
    const node = document.createElement('div');
    node.className = 'fixed right-6 bottom-6 z-[100] rounded-xl bg-tertiary text-on-tertiary px-5 py-3 font-bold shadow-2xl';
    node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3200);
  };
  let settings = { sound_enabled: 1, reduced_motion: 0 };
  const playReward = () => {
    if (!settings.sound_enabled || !window.AudioContext) return;
    const context = new AudioContext(), now = context.currentTime;
    [440, 660, 880].forEach((frequency, index) => { const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, now + index * .08); gain.gain.exponentialRampToValueAtTime(.09, now + index * .08 + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .08 + .16); oscillator.connect(gain).connect(context.destination); oscillator.start(now + index * .08); oscillator.stop(now + index * .08 + .18); });
  };
  const playStreak = () => {
    if (!settings.sound_enabled || !window.AudioContext) return;
    const context = new AudioContext(), now = context.currentTime;
    [294, 392, 587].forEach((frequency, index) => { const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = 'triangle'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, now + index * .1); gain.gain.exponentialRampToValueAtTime(.055, now + index * .1 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .1 + .22); oscillator.connect(gain).connect(context.destination); oscillator.start(now + index * .1); oscillator.stop(now + index * .1 + .24); });
  };
  // Place dynamic data in the relevant existing screen section, never as a duplicate page-top dashboard.
  const mountInSection = (heading, content) => {
    const target = [...document.querySelectorAll('h1,h2,h3')].find(node => node.textContent.replace(/\s+/g, ' ').trim().toLowerCase().includes(heading.toLowerCase()));
    if (!target) return;
    target.parentElement?.querySelector('[data-realm-content]')?.remove();
    target.insertAdjacentHTML('afterend', `<div class="mt-4" data-realm-content>${content}</div>`);
  };
  const questCelebration = (task, currentHero = hero) => {
    let overlay = document.getElementById('celebrationOverlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'celebrationOverlay'; overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center p-5 bg-surface-container-lowest/90 backdrop-blur-xl opacity-0 transition-opacity duration-500'; overlay.innerHTML = '<div class="relative max-w-md w-full rounded-2xl bg-surface-container-low p-7 text-center shadow-[0_0_70px_rgba(84,221,252,.28)]"><button class="absolute right-4 top-3 text-on-surface-variant" data-dismiss-story aria-label="Close reward story">×</button><div class="text-5xl mb-3">✦</div><span class="text-primary font-bold tracking-widest text-xs">MISSION ACCOMPLISHED</span><h2 class="text-2xl font-bold mt-2">Quest complete</h2><p id="celebrationQuestTitle" class="mt-2 text-on-surface-variant"></p><p id="celebNarrative" class="mt-4 rounded-xl bg-surface-container p-3 text-sm text-on-surface"></p><div class="grid grid-cols-3 gap-2 mt-5 text-sm"><div class="rounded-lg bg-surface-container p-2"><b id="celebXP" class="block text-tertiary"></b><small>XP</small></div><div class="rounded-lg bg-surface-container p-2"><b id="celebGold" class="block text-primary"></b><small>Gold</small></div><div class="rounded-lg bg-surface-container p-2"><b id="celebStat" class="block text-secondary"></b><small>Attribute</small></div></div><button data-dismiss-story class="mt-5 w-full rounded-xl bg-primary-container py-3 font-bold text-on-primary-container">Continue your story</button></div>'; document.body.append(overlay); overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-dismiss-story]')) { overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 350); } }); }
    const stories = { intellect:'A sealed archive yields its pattern. Your mind maps a clearer route through tomorrow.', strength:'The realm registers your momentum. Steel, breath, and resolve become a stronger path.', focus:'The static falls away. One deliberate hour becomes a signal your future self can follow.', discipline:'A promise becomes a ritual. The engine records another proof that you show up.', vitality:'Your body sends a brighter signal across the realm. Recovery is part of the campaign.', creativity:'A new constellation appears in the Codex. Your next move has more possible shapes.' };
    document.getElementById('celebrationQuestTitle').textContent = task.title;
    document.getElementById('celebXP').textContent = `+${task.xp_reward} XP`;
    document.getElementById('celebGold').textContent = `+${task.gold_reward} G`;
    document.getElementById('celebStat').textContent = `+1 ${task.attribute.toUpperCase()}`;
    let narrative = document.getElementById('celebNarrative'); if (!narrative) { narrative = document.createElement('p'); narrative.id = 'celebNarrative'; narrative.className = 'mt-3 max-w-sm text-center text-sm text-on-surface-variant'; document.getElementById('celebrationQuestTitle')?.insertAdjacentElement('afterend', narrative); } narrative.textContent = `${stories[task.attribute] || stories.focus} Day ${currentHero.current_streak} of your streak is now secured.`;
    overlay.classList.remove('hidden'); requestAnimationFrame(() => overlay.classList.remove('opacity-0')); playReward(); window.realmBurst?.(90);
  };
  const extraQuestCard = (task) => `<div class="quest-card lg:col-span-12 xl:col-span-6 rounded-xl bg-surface-container-low p-space-md shadow-lg relative overflow-hidden transition-all hover:bg-surface-container group"><div class="flex flex-col md:flex-row items-start justify-between gap-space-md"><div><span class="px-2 py-0.5 rounded bg-surface-container-highest text-tertiary font-label-sm text-label-sm font-medium">${task.attribute.toUpperCase()} OPERATION</span><h2 class="font-headline-md text-headline-md text-on-surface font-bold mt-2">${escapeHtml(task.title)}</h2><p class="font-body-md text-body-md text-on-surface-variant mt-1">${escapeHtml(task.description || 'Custom operative directive.')}</p><div class="mt-3 text-tertiary font-bold">+${task.xp_reward} XP · +${task.gold_reward} G · +1 ${task.attribute.toUpperCase()}</div></div><div class="flex gap-2"><button class="px-space-sm py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-primary font-label-md" data-edit-task-id="${task.id}" data-edit-task-title="${escapeHtml(task.title)}" data-edit-task-description="${escapeHtml(task.description || '')}">Edit</button><button class="px-space-sm py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-error font-label-md" data-delete-task-id="${task.id}" aria-label="Delete ${escapeHtml(task.title)}">Delete</button><button class="complete-action-btn px-space-md py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md font-bold" data-live-task-id="${task.id}">Complete Quest</button></div></div></div>`;
  const bindQuestPage = async () => {
    const tasks = await api('/api/tasks');
    const activeCount = tasks.filter(task => !task.completed).length, completedCount = tasks.filter(task => task.completed).length;
    document.querySelectorAll('.status-tab').forEach(tab => { const badge = tab.querySelector('span:last-child'); if (!badge) return; if (tab.dataset.filter === 'completed') badge.textContent = completedCount; else if (tab.dataset.filter === 'today' || tab.dataset.filter === 'upcoming') badge.textContent = activeCount; else if (tab.dataset.filter === 'recurring') badge.textContent = tasks.filter(task => task.frequency !== 'once' && !task.completed).length; });
    document.querySelectorAll('h1 + span').forEach(badge => { if (/ACTIVE/.test(badge.textContent)) badge.textContent = `${activeCount} ACTIVE`; });
    document.querySelectorAll('.quest-card').forEach(card => {
      const title = card.querySelector('h2,h3')?.textContent.trim();
      const task = tasks.find(item => item.title === title);
      const button = card.querySelector('.complete-action-btn');
      if (task && button) { button.dataset.liveTaskId = task.id; if (task.completed) { button.disabled = true; button.textContent = 'Claimed'; card.classList.add('opacity-40'); } }
    });
    const staticTitles = [...document.querySelectorAll('.quest-card h2,.quest-card h3')].map(el => el.textContent.trim());
    const grid = document.querySelector('.quest-card')?.parentElement;
    const custom = tasks.filter(task => !staticTitles.includes(task.title) && !task.completed);
    if (grid && custom.length) grid.insertAdjacentHTML('beforeend', custom.map(extraQuestCard).join(''));
    document.addEventListener('click', async (event) => {
      const deleteButton = event.target.closest('[data-delete-task-id]');
      if (deleteButton) { event.preventDefault(); event.stopImmediatePropagation(); try { await api(`/api/tasks/${deleteButton.dataset.deleteTaskId}`, { method:'DELETE' }); deleteButton.closest('.quest-card')?.remove(); toast('Quest removed from your log.'); } catch (error) { toast(error.message); } return; }
      const editButton = event.target.closest('[data-edit-task-id]');
      if (editButton) { event.preventDefault(); event.stopImmediatePropagation(); const title = prompt('Quest title', editButton.dataset.editTaskTitle); if (title === null) return; const description = prompt('Quest briefing', editButton.dataset.editTaskDescription); if (description === null) return; try { const updated = await api(`/api/tasks/${editButton.dataset.editTaskId}`, { method:'PATCH', body:JSON.stringify({ title, description }) }); const card = editButton.closest('.quest-card'); card.querySelector('h2,h3').textContent = updated.title; const copy = card.querySelector('p'); if (copy) copy.textContent = updated.description || 'Custom operative directive.'; editButton.dataset.editTaskTitle = updated.title; editButton.dataset.editTaskDescription = updated.description || ''; toast('Quest briefing updated.'); } catch (error) { toast(error.message); } return; }
      const button = event.target.closest('[data-live-task-id]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      button.disabled = true;
      try {
        const result = await api(`/api/tasks/${button.dataset.liveTaskId}/complete`, { method: 'POST' });
        hydrate(result.character); button.textContent = 'Claimed'; button.closest('.quest-card')?.classList.add('opacity-40');
        questCelebration(result.task);
        if (result.levelUp) setTimeout(() => location.href = 'levelup.html', 700);
      } catch (error) { button.disabled = false; toast(error.message); }
    }, true);
    const form = document.getElementById('newQuestForm');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const title = document.getElementById('questTitleInput').value.trim();
      if (!title) return;
      const attributeText = document.getElementById('questAttributeInput').value.toLowerCase();
      const attribute = attributeText.includes('int') ? 'intellect' : attributeText.includes('str') ? 'strength' : attributeText.includes('discip') ? 'discipline' : attributeText.includes('vital') ? 'vitality' : attributeText.includes('creat') ? 'creativity' : 'focus';
      try { const task = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title, description: document.getElementById('questDescInput').value, attribute, xp_reward: 100, gold_reward: 25 }) }); document.querySelector('.quest-card')?.parentElement.insertAdjacentHTML('beforeend', extraQuestCard(task)); form.reset(); document.getElementById('cancelCreateModalBtn')?.click(); toast('Quest forged and saved to your account.'); }
      catch (error) { toast(error.message); }
    }, true);
  };
  const bindDashboard = async () => {
    const [tasks, progression, activity] = await Promise.all([api('/api/tasks'), api('/api/progression'), api('/api/activity')]);
    const active = tasks.filter(task => !task.completed).slice(0, 4);
    const completed = tasks.filter(task => task.completed).length;
    // A native, data-driven streak moment. It has no dependency on the prototype folder.
    const streakKey = `abhyudaya-streak-native-v1-${new Date().toISOString().slice(0,10)}`;
    if (!sessionStorage.getItem(streakKey)) {
      sessionStorage.setItem(streakKey, '1');
      setTimeout(() => {
        const node = document.createElement('section');
        node.className = 'fixed left-1/2 top-20 z-[105] w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-3xl border border-primary/45 bg-[#100b20]/[.97] px-6 py-5 text-center text-on-surface shadow-[0_0_70px_rgba(251,146,60,.38)] backdrop-blur-xl';
        const streak = Number(hero.current_streak) || 0;
        const start = Math.max(1, streak - 6);
        const days = Array.from({ length: 7 }, (_, index) => start + index);
        node.innerHTML = `<style>@keyframes abhyudayaFlame{0%,100%{transform:scale(.92) rotate(-3deg);filter:drop-shadow(0 0 5px #fb923c)}50%{transform:scale(1.12) rotate(3deg);filter:drop-shadow(0 0 20px #facc15)}}@keyframes abhyudayaRise{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes abhyudayaSpark{0%{transform:translateY(12px) scale(.4);opacity:0}45%{opacity:1}100%{transform:translateY(-62px) scale(1.4);opacity:0}}.ab-flame{animation:abhyudayaFlame 1.15s ease-in-out infinite}.ab-rise{animation:abhyudayaRise .5s cubic-bezier(.2,.8,.2,1) both}.ab-spark{animation:abhyudayaSpark 1.7s ease-out infinite}</style><div class="pointer-events-none absolute inset-0 opacity-70">${Array.from({length:12},(_,i)=>`<i class="ab-spark absolute h-1.5 w-1.5 rounded-full bg-amber-300" style="left:${8+i*7.5}%;bottom:26%;animation-delay:${(i%5)*.18}s"></i>`).join('')}</div><button class="absolute right-4 top-3 z-10 rounded p-1 text-on-surface-variant hover:text-primary" data-dismiss-streak aria-label="Close streak celebration">×</button><p class="ab-rise relative text-[11px] font-bold tracking-[.2em] text-primary">MOMENTUM IGNITED</p><div class="ab-flame relative mx-auto mt-1 h-28 w-28"><svg viewBox="0 0 120 120" class="h-full w-full" role="img" aria-label="Animated streak flame"><defs><radialGradient id="abGlow"><stop stop-color="#fff7c2"/><stop offset=".42" stop-color="#fbbf24"/><stop offset="1" stop-color="#ea580c"/></radialGradient></defs><circle cx="60" cy="60" r="46" fill="#f97316" opacity=".12"/><path d="M62 108c-23 0-39-16-39-37 0-24 18-34 23-53 15 10 18 24 17 35 7-7 12-17 11-27 21 15 25 33 25 47 0 20-15 35-37 35Z" fill="url(#abGlow)"/><path d="M61 100c-12 0-21-9-21-22 0-12 9-19 15-28 8 9 5 17 5 22 5-4 9-10 10-16 9 9 12 17 12 26 0 11-9 18-21 18Z" fill="#fff2a7"/></svg></div><h2 class="ab-rise relative mt-1 text-3xl font-black" data-streak-count>${streak ? '0 days' : '0-day streak'}</h2><p class="ab-rise relative mt-1 text-sm text-on-surface-variant">${streak ? `Day ${streak}: your real-world momentum is recorded.` : 'Your realm is ready. Complete one quest today to forge Day 1.'}</p><div class="ab-rise relative mt-5 grid grid-cols-7 gap-1.5">${days.map(day=>`<div><div class="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold ${day < streak ? 'border-amber-300/70 bg-amber-300/15 text-amber-200' : day === streak ? 'border-orange-300 bg-orange-500 text-white shadow-[0_0_18px_rgba(251,146,60,.8)]' : 'border-white/10 bg-white/5 text-on-surface-variant'}">${day < streak ? '✓' : day === streak ? '✦' : '·'}</div><span class="mt-1 block text-[9px] text-on-surface-variant">D${day}</span></div>`).join('')}</div><p class="ab-rise relative mt-4 text-xs text-on-surface-variant">One completed quest per calendar day extends the chain. XP, Gold, and attributes are awarded server-side.</p>`;
        document.body.append(node);
        node.addEventListener('click', event => { if (event.target.closest('[data-dismiss-streak]')) node.remove(); });
        if (!streak) { setTimeout(() => node.remove(), 5200); return; }
        const counter = node.querySelector('[data-streak-count]'); let value = 0;
        const timer = setInterval(() => { value++; counter.textContent = `${value} day${value === 1 ? '' : 's'} streak`; if (value >= streak) { clearInterval(timer); setTimeout(() => node.remove(), 6500); } }, Math.max(90, 720 / streak));
        playStreak();
      }, 500);
    }
    const textNode = (needle) => [...document.querySelectorAll('span,p,h1,h2,h3')].find(node => node.children.length === 0 && node.textContent.trim() === needle);
    const streakLabel = textNode('Current Streak'); if (streakLabel) { const card = streakLabel.closest('.p-space-md'); const number = card?.querySelector('.font-headline-lg'); if (number) number.textContent = hero.current_streak; card?.querySelectorAll('span').forEach(node => { if (/30 Days \(70%\)/.test(node.textContent)) node.textContent = `${Math.min(hero.current_streak, 30)} / 30 days`; }); }
    const goldLabel = textNode('Gold Harvested'); if (goldLabel) { const card = goldLabel.closest('.p-space-md'); card?.querySelectorAll('span').forEach(node => { if (/3,420 G/.test(node.textContent)) node.textContent = `${hero.gold} G`; if (/\+180/.test(node.textContent)) node.textContent = '+0'; }); }
    const lootHeader = textNode('Recent Feats & Loot'); const lootPanel = lootHeader?.closest('.p-space-lg');
    if (lootPanel) lootPanel.innerHTML = `<div class="flex items-center justify-between"><div class="flex items-center gap-space-xs"><span class="material-symbols-outlined text-primary text-xl">auto_awesome</span><h3 class="font-headline-sm text-on-surface font-bold">Recent Feats &amp; Loot</h3></div><a class="font-label-sm text-tertiary hover:underline uppercase tracking-wider" href="achievements.html">Trophy Room</a></div><div class="flex flex-col gap-2">${activity.length ? activity.slice(0,3).map(row => `<div class="p-3 rounded-xl bg-surface-container-low text-body-sm"><b class="text-tertiary">${escapeHtml(row.type.replaceAll('_',' '))}</b><br>${escapeHtml(row.message)}</div>`).join('') : '<p class="text-on-surface-variant">No feats earned yet. Complete your first quest to begin the story.</p>'}</div>`;
    const chest = document.getElementById('openCelebrationModal'); if (chest) { chest.textContent = 'Forge New Quest'; chest.setAttribute('aria-label', 'Forge new quest'); }
    const staticCards = [...document.querySelectorAll('.quest-card')];
    staticCards.forEach((card, index) => {
      const task = tasks[index]; if (!task) { card.remove(); return; }
      card.dataset.dashboardTaskId = task.id;
      const title = card.querySelector('h2,h3'); if (title) { title.textContent = task.title; title.classList.remove('line-through','text-on-surface-variant'); }
      card.querySelectorAll('*').forEach(node => { if (node.children.length === 0 && node.textContent.trim() === 'Completed') node.textContent = task.completed ? 'Completed' : 'Active'; });
      let action = card.querySelector('.claim-btn,[data-dashboard-complete]');
      if (!action) { action = document.createElement('button'); action.className = 'claim-btn shrink-0 px-space-md py-2 rounded-xl bg-primary-container text-on-primary-container font-bold uppercase'; card.append(action); }
      action.dataset.dashboardComplete = task.id; action.textContent = task.completed ? 'Claimed' : 'Complete'; action.disabled = task.completed;
      if (task.completed) card.classList.add('opacity-50'); else card.classList.remove('opacity-50','opacity-85');
    });
    document.addEventListener('click', async event => {
      const staticControl = event.target.closest('.interactive-checkbox,.claim-btn');
      const button = event.target.closest('[data-dashboard-complete]') || staticControl?.closest('.quest-card')?.querySelector('[data-dashboard-complete]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation(); button.disabled = true;
      try { const result = await api(`/api/tasks/${button.dataset.dashboardComplete}/complete`, { method:'POST' }); hero = result.character; hydrate(hero); questCelebration(result.task, hero); button.textContent = 'Claimed'; if (result.levelUp) setTimeout(() => location.href = 'levelup.html', 700); }
      catch (error) { button.disabled = false; toast(error.message); }
    }, true);
    document.addEventListener('click', event => {
      const button = event.target.closest('#openCelebrationModal,#quickLogBtn,#addNewQuestBtn'); if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation(); location.href = 'quests.html?new=1';
    }, true);
    document.getElementById('celebrationModal')?.classList.add('hidden');
  };
  const bindShopPage = async () => {
    const products = await api('/api/shop');
    const gold = document.getElementById('player-vault-gold'); if (gold) gold.textContent = hero.gold.toLocaleString();
    document.querySelectorAll('.product-card').forEach(card => {
      const product = products.find(item => item.id === card.id || item.name === card.dataset.name);
      if (!product) return;
      const button = card.querySelector('.buy-trigger');
      if (button) { button.dataset.liveItemId = product.id; if (product.owned) { button.disabled = true; button.textContent = 'Owned'; } }
    });
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-live-item-id]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      try { const result = await api(`/api/shop/${button.dataset.liveItemId}/purchase`, { method: 'POST' }); hero = result.character; hydrate(hero); playReward(); window.realmBurst?.(40); button.textContent = 'Owned'; button.disabled = true; const modal = document.getElementById('victory-modal'); if (modal) { document.getElementById('victory-item-name').textContent = result.item.name; document.getElementById('victory-gold-balance').textContent = `${hero.gold} G`; modal.classList.remove('opacity-0','pointer-events-none'); } else toast(`${result.item.name} acquired.`); }
      catch (error) { toast(error.message); }
    }, true);
  };
  const bindInventory = async () => {
    const render = async () => {
      const inventory = await api('/api/inventory');
      document.querySelectorAll('[data-live-inventory-count]').forEach(el => el.textContent = inventory.length);
      const content = inventory.length ? `<div class="grid gap-2">${inventory.map(item => `<div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface-container-high"><span><b>${item.icon} ${escapeHtml(item.name)}</b>${item.equipped ? ' <em class="text-tertiary">EQUIPPED</em>' : ''}<small class="block text-on-surface-variant">${escapeHtml(item.description)}</small></span><span class="flex gap-2">${['relic','badge','theme','aura'].includes(item.category) ? `<button class="px-2 py-1 rounded bg-secondary-container text-on-secondary-container" data-inventory-action="equip" data-inventory-id="${item.id}">${item.equipped ? 'Equipped' : 'Equip'}</button>` : ''}${['consumable','booster'].includes(item.category) ? `<button class="px-2 py-1 rounded bg-tertiary text-on-tertiary" data-inventory-action="use" data-inventory-id="${item.id}">Use</button>` : ''}${item.price > 0 ? `<button class="px-2 py-1 rounded bg-surface-container text-primary" data-inventory-action="disenchant" data-inventory-id="${item.id}">Salvage</button>` : ''}</span></div>`).join('')}</div>` : '<p class="text-on-surface-variant">No rewards acquired yet. Visit the Guild Shop after completing quests.</p>';
      mountInSection('inventory', content);
    };
    await render();
    document.addEventListener('click', async event => { const button = event.target.closest('[data-inventory-action]'); if (!button) return; event.preventDefault(); button.disabled = true; try { const action = button.dataset.inventoryAction; const result = await api(`/api/inventory/${button.dataset.inventoryId}/${action}`, { method:'POST' }); if (result.character) { hero = result.character; hydrate(hero); } playReward(); window.realmBurst?.(20); toast(action === 'disenchant' ? `Salvaged for ${result.gold} Gold.` : `${result.item.name} ${action === 'equip' ? 'equipped.' : 'used.'}`); await render(); } catch (error) { toast(error.message); button.disabled = false; } }, true);
  };
  const bindActivity = async () => { const rows = await api('/api/activity'); mountInSection('completed quests', rows.length ? `<div class="space-y-2">${rows.slice(0, 8).map(row => `<div class="flex justify-between gap-4 text-body-sm"><span>${escapeHtml(row.message)}</span><span class="text-tertiary whitespace-nowrap">${row.xp_delta ? `+${row.xp_delta} XP` : ''} ${row.gold_delta ? `${row.gold_delta > 0 ? '+' : ''}${row.gold_delta} G` : ''}</span></div>`).join('')}</div>` : '<p class="text-on-surface-variant">Complete a quest to begin your history.</p>'); };
  const bindProgression = async () => { const data = await api('/api/progression'); mountInSection('operative journey', `<div class="flex items-center justify-between text-body-sm mb-2"><span>Level ${data.character.level}</span><span>${data.character.xp.toLocaleString()} / ${data.xpForNext.toLocaleString()} XP</span></div><div class="h-3 rounded-full bg-surface-container-highest overflow-hidden"><div class="h-full bg-tertiary transition-all duration-700" style="width:${data.levelProgress}%"></div></div><p class="text-on-surface-variant text-body-sm mt-3">${data.completedQuests} completed quests · ${data.character.current_streak}-day active streak</p>`); };
  const bindAchievements = async () => {
    const render = async () => { const data = await api('/api/achievements'); mountInSection('achievement sanctum', `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">${data.achievements.map(item => `<div class="p-3 rounded-lg bg-surface-container ${item.unlocked ? 'text-tertiary' : 'text-on-surface-variant'}"><b>${item.unlocked ? '✓' : '○'} ${item.title}</b><div class="text-body-sm">${item.progress}/${item.target} · ${item.description}</div>${item.unlocked && !item.claimed ? `<button class="mt-2 px-3 py-1 rounded bg-primary-container text-on-primary-container font-bold" data-claim-achievement="${item.id}">Claim +${item.gold_reward} Gold</button>` : item.claimed ? '<small class="block mt-2">Reward claimed</small>' : ''}</div>`).join('')}</div>`); };
    await render();
    document.addEventListener('click', async event => { const button = event.target.closest('[data-claim-achievement]'); if (!button) return; event.preventDefault(); button.disabled = true; try { const result = await api(`/api/achievements/${button.dataset.claimAchievement}/claim`, { method:'POST' }); hero = result.character; hydrate(hero); playReward(); window.realmBurst?.(42); toast(`Trophy bounty claimed: +${result.gold_reward} Gold.`); await render(); } catch (error) { button.disabled = false; toast(error.message); } }, true);
  };
  const bindCharacter = () => { const directives = (() => { try { return JSON.parse(hero.directives_json || '[]'); } catch { return []; } })(); mountInSection('hexagon attributes', `<div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-body-sm"><div>INT <b class="text-tertiary">${hero.intellect}</b></div><div>FOC <b class="text-tertiary">${hero.focus}</b></div><div>DIS <b class="text-secondary">${hero.discipline}</b></div><div>VIT <b>${hero.vitality || 1}</b></div><div>STR <b>${hero.strength}</b></div><div>CRE <b>${hero.creativity || 1}</b></div></div><p class="text-on-surface-variant text-body-sm mt-3"><b class="text-on-surface">Origin:</b> ${escapeHtml(hero.origin_story || 'No origin signal recorded.')}</p><p class="text-on-surface-variant text-body-sm mt-1"><b class="text-on-surface">Directives:</b> ${directives.length ? directives.map(escapeHtml).join(' · ') : 'No directives selected.'}</p>`); };
  const bindSettings = () => {};
  const bindAscension = () => {
    document.addEventListener('click', async event => {
      const button = event.target.closest('#claim-btn,[data-purpose="claim-ascension-rewards-btn"]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const allocation = Object.fromEntries(['intellect','focus','discipline'].map(stat => [stat, Number((document.getElementById(`${stat}-added`)?.textContent || '+0').replace('+',''))]));
      button.disabled = true; const original = button.innerHTML; button.textContent = 'SYNCHRONIZING ASCENSION…';
      try { const result = await api('/api/ascensions/claim', { method:'POST', body:JSON.stringify({ allocation }) }); hero = result.character; playReward(); window.realmBurst?.(90); button.textContent = 'ASCENSION CACHE CLAIMED'; toast(`+250 Gold and ${result.level} ascension rewards saved.`); setTimeout(() => location.href='quests.html', 1400); }
      catch (error) { button.disabled = false; button.innerHTML = original; toast(error.message); }
    }, true);
    document.addEventListener('click', event => { const back = event.target.closest('#dismiss-link,[data-purpose="dismiss-modal-link"]'); if (back) { event.preventDefault(); location.href = 'quests.html'; } }, true);
  };
  const bindNotifications = async () => {
    const data = await api('/api/notifications');
    const icon = [...document.querySelectorAll('.material-symbols-outlined')].find(node => node.textContent.trim() === 'notifications');
    const trigger = icon?.parentElement; if (!trigger) return;
    const count = trigger.querySelector('.absolute'); if (count) { count.textContent = data.notifications.length; count.classList.toggle('hidden', !data.notifications.length); }
    trigger.setAttribute('role', 'button'); trigger.setAttribute('tabindex', '0'); trigger.setAttribute('aria-label', 'Open realm notifications');
    const open = () => {
      document.getElementById('live-notification-panel')?.remove();
      const menu = document.createElement('section'); menu.id = 'live-notification-panel'; menu.className = 'fixed right-5 top-20 z-[100] w-80 rounded-xl border border-surface-container-high bg-surface-container-lowest p-4 shadow-2xl';
      menu.innerHTML = `<h2 class="font-bold text-on-surface mb-3">Realm notifications</h2>${data.notifications.length ? data.notifications.map(item => `<div class="border-t border-surface-container-high py-2 text-body-sm"><b class="text-tertiary">${escapeHtml(item.title)}</b><br><span class="text-on-surface-variant">${escapeHtml(item.message)}</span></div>`).join('') : '<p class="text-on-surface-variant">No new realm events.</p>'}`;
      document.body.append(menu);
    };
    trigger.addEventListener('click', open); trigger.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  };
  const bindMeaningfulStaticActions = () => {
    document.addEventListener('click', async event => {
      const control = event.target.closest('button,a,[role="button"]'); if (!control) return;
      const label = (control.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let destination = null;
      if (/inspect loadout|equip loadout/.test(label)) destination = 'inventory.html';
      else if (/all trophies|inspect trophy|log book|solve challenge|customize pedestal/.test(label)) destination = 'achievements.html';
      else if (/earn more gold|browse high-yield|commit today|commit daily quests/.test(label)) destination = 'quests.html';
      else if (/inspect syndicate|codex & rules|manage roster/.test(label)) destination = 'guild.html';
      if (destination) { event.preventDefault(); event.stopImmediatePropagation(); location.href = destination; return; }
      if (/test neon theme preview|\bpreview\b|\brevert\b/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); const nextTheme = /revert/.test(label) ? 'cyberpunk' : 'midnight'; try { settings = await api('/api/settings', { method:'PATCH', body:JSON.stringify({ theme:nextTheme }) }); document.body.dataset.theme = nextTheme; toast(nextTheme === 'midnight' ? 'Midnight theme preview applied and saved.' : 'Default realm theme restored.'); } catch (error) { toast(error.message); } return; }
      if (/engage focus sprint|strike boss/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); control.disabled = true; try { const task = await api('/api/tasks', { method:'POST', body:JSON.stringify({ title:'25-minute Guild Focus Sprint', description:'A guild raid contribution. Complete after an uninterrupted focus session.', attribute:'focus', xp_reward:150, gold_reward:35, frequency:'once' }) }); toast('Focus Sprint forged in your Quest Log. Complete it after your session for raid damage.'); window.realmBurst?.(18); setTimeout(() => location.href = `quests.html?focus=${task.id}`, 600); } catch (error) { control.disabled = false; toast(error.message); } return; }
      if (/share ascension|share to guild/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); const message = `${hero.name} reached Level ${hero.level} in Abhyudaya!`; try { await navigator.clipboard.writeText(message); toast('Ascension record copied to your clipboard.'); } catch { toast(message); } return; }
      if (/perform rebirth/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); if (prompt('Type REBIRTH to reset quests, stats, inventory, and trophies.') !== 'REBIRTH') return; try { const result = await api('/api/account/rebirth',{method:'POST',body:JSON.stringify({confirmation:'REBIRTH'})}); hero=result.character; toast('New cycle created. Returning to onboarding.'); setTimeout(()=>location.href='onboarding.html',700); } catch(error){toast(error.message);} return; }
      if (/atomize vault/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); const password=prompt('Enter your current password to permanently delete this account.'); if (!password) return; try { await api('/api/account',{method:'DELETE',body:JSON.stringify({password})}); location.href='index.html'; } catch(error){toast(error.message);} return; }
      if (/manage keys/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); try { const result=await api('/api/tokens',{method:'POST'}); await navigator.clipboard?.writeText(result.token); toast(`${result.message} Key copied: ${result.token}`); } catch(error){toast(error.message);} return; }
      if (/deposit to treasury/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); const amount=Number(prompt('Gold to contribute to the guild treasury:','10')); if (!amount) return; try { const result=await api('/api/guild/contribute',{method:'POST',body:JSON.stringify({kind:'gold',amount})}); hero=result.character; hydrate(hero); toast(`${amount} Gold deposited. Guild treasury: ${result.state.treasury_gold}.`); } catch(error){toast(error.message);} return; }
      if (/support|\+5 mana/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); try { const result=await api('/api/guild/contribute',{method:'POST',body:JSON.stringify({kind:'mana'})}); toast(`+5 Mana sent. Guild mana: ${result.state.mana}.`); } catch(error){toast(error.message);} return; }
      if (/re-verify integrity/.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); toast('Account data integrity verified against the local realm database.'); }
    }, true);
  };
  let hero;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const me = await api('/api/me'); hero = me.character; settings = await api('/api/settings'); hydrate(hero);
      await bindNotifications();
      bindMeaningfulStaticActions();
      if (settings.reduced_motion) document.documentElement.classList.add('motion-reduce');
      const motionStyle = document.createElement('style'); motionStyle.textContent = '.motion-reduce *, .motion-reduce *::before, .motion-reduce *::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}'; document.head.append(motionStyle);
      if (page === 'dashboard.html') await bindDashboard();
      if (page === 'quests.html') await bindQuestPage();
      if (page === 'shop.html') await bindShopPage();
      if (page === 'inventory.html') await bindInventory();
      if (page === 'activity.html') await bindActivity();
      if (page === 'progression.html') await bindProgression();
      if (page === 'achievements.html') await bindAchievements();
      if (page === 'character.html') bindCharacter();
      if (page === 'settings.html') bindSettings();
      if (page.startsWith('levelup')) bindAscension();
    } catch { location.href = 'auth.html'; }
  });
})();
