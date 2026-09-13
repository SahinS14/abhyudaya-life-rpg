(() => {
  if (location.protocol === 'file:') {
    location.replace(`http://localhost:3000/${location.pathname.split('/').pop() || 'index.html'}`);
    return;
  }
  const routes = {
    home: 'index.html', 'landing-page': 'index.html', dashboard: 'dashboard.html', quests: 'quests.html',
    character: 'character.html', inventory: 'inventory.html', shop: 'shop.html',
    achievements: 'achievements.html', activity: 'activity.html', progression: 'progression.html',
    settings: 'settings.html', guild: 'guild.html', 'guild-and-raids': 'guild.html', 'guild-raids': 'guild.html',
    auth: 'auth.html', 'sign-in': 'auth.html', onboarding: 'onboarding.html', 'get-started': 'auth.html',
    levelup: 'levelup.html', rewards: 'inventory.html', 'rpg-progression': 'progression.html',
    achievements: 'achievements.html', 'hall-of-fame': 'achievements.html', features: 'dashboard.html',
    'how-it-works': 'quests.html', codex: 'character.html', pricing: 'shop.html',
    'seasonal-bosses': 'guild.html', 'creator-guild': 'guild.html', 'discord-tavern': 'guild.html',
    'patch-notes': 'activity.html', 'privacy-policy': 'index.html', 'terms-of-service': 'index.html',
    'code-of-chivalry': 'index.html'
  };

  const go = (route) => { window.location.href = routes[route] || route; };
  window.lifeQuestGo = go;

  document.addEventListener('DOMContentLoaded', () => {
    if (location.pathname.endsWith('index.html') || location.pathname === '/') {
      const publicNav = document.querySelector('header nav');
      if (publicNav) publicNav.innerHTML = '<a class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors" href="#how-it-works">How it works</a><a class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors" href="auth.html">Sign in</a>';
      ['features', 'rpg-progression', 'rewards'].forEach(id => document.getElementById(id)?.remove());
      document.querySelectorAll('span').forEach(node => { if (node.textContent.trim() === 'Real operatives') node.closest('.p-space-sm')?.remove(); });
    }
    // Every authenticated screen uses the same navigation and screen order.
    const sideNav = document.querySelector('aside nav[data-active-classes]');
    if (sideNav) {
      const current = ({ 'dashboard.html':'dashboard', 'quests.html':'quests', 'character.html':'character', 'inventory.html':'inventory', 'shop.html':'shop', 'achievements.html':'achievements', 'activity.html':'activity', 'progression.html':'progression', 'guild.html':'guild', 'settings.html':'settings' })[location.pathname.split('/').pop()] || 'dashboard';
      const entries = [['dashboard','dashboard','Dashboard'],['quests','swords','Quests'],['character','person','Character'],['inventory','backpack','Inventory'],['shop','storefront','Shop'],['achievements','military_tech','Trophy Room'],['activity','insights','Activity'],['progression','auto_graph','Progression'],['guild','groups','Guild & Raids'],['settings','settings','System Settings']];
      sideNav.innerHTML = entries.map(([path, icon, label]) => `<a data-path="${path}" href="${routes[path]}" ${current === path ? 'aria-current="page"' : ''} class="flex items-center gap-space-sm px-space-md py-2.5 rounded-lg ${current === path ? 'bg-surface-container-high text-primary font-bold shadow-inner' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'} transition-all group font-label-md text-label-md tracking-wider uppercase"><span class="material-symbols-outlined text-primary text-xl">${icon}</span>${label}</a>`).join('');
      const crest = document.querySelector('aside img'); if (crest) { crest.src = 'logo.png'; crest.alt = 'Abhyudaya crest'; }
      document.querySelectorAll('aside span').forEach(node => { if (node.textContent.trim() === 'LIFEQUEST') node.textContent = 'ABHYUDAYA'; });
    }
    document.querySelectorAll('a[data-path]').forEach((link) => {
      const destination = routes[link.dataset.path];
      if (destination) link.href = destination;
    });

    // Make common prototype actions lead to the next meaningful screen.
    document.addEventListener('click', (event) => {
      const control = event.target.closest('a, button, [role="button"]');
      if (!control || control.dataset.wired || control.closest('form')) return;
      const label = (control.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let destination = null;
      if (/sign in|log in/.test(label)) destination = 'auth';
      else if (/enter realm|continue as/.test(label)) destination = 'dashboard';
      else if (/sign up|create account|get started|begin your quest|start your quest/.test(label)) destination = 'auth';
      else if (/save.*character|enter the realm|begin adventure|complete.*genesis/.test(label)) destination = 'dashboard';
      else if (/quick quest|forge new quest|create quest/.test(label)) destination = 'quests';
      // Reward claims are intentionally handled by their owning screen and API; routing them
      // away here would discard the user's real reward action.
      else if (/continue.*quest|return.*quest|view.*quest/.test(label)) destination = 'quests';
      else if (/view.*progress|ascension path/.test(label)) destination = 'progression';
      else if (/guild|raid hub/.test(label)) destination = 'guild';
      else if (/achievement|trophy/.test(label)) destination = 'achievements';
      else if (/settings/.test(label)) destination = 'settings';
      if (destination) {
        event.preventDefault();
        go(destination);
      }
    });

    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('a[href]').forEach((link) => {
      if (link.getAttribute('href') === '#') link.setAttribute('href', 'index.html');
    });
    document.querySelectorAll('a[data-path]').forEach((link) => {
      if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
    });
  });
})();
