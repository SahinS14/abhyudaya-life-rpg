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
  const mobileStyle = document.createElement('style');
  mobileStyle.textContent = `
    *,*::before,*::after{box-sizing:border-box}
    img,svg,video{max-width:100%;height:auto}
    button,a,input,select,textarea{touch-action:manipulation}
    .ab-account-menu{position:absolute;right:0;top:calc(100% + .75rem);z-index:120;width:14rem;overflow:hidden;border:1px solid rgba(255,193,116,.3);border-radius:.75rem;padding:.35rem;background:#060e20;box-shadow:0 20px 45px rgba(0,0,0,.52);backdrop-filter:blur(18px)}.ab-account-menu.hidden{display:none}.ab-account-link{display:flex;width:100%;align-items:center;border:0;border-radius:.55rem;padding:.7rem .8rem;background:transparent;color:#d8c3ad;cursor:pointer;text-align:left;font-size:.75rem;font-weight:700;letter-spacing:.04em;text-decoration:none;transition:background .16s,color .16s}.ab-account-link:hover,.ab-account-link:focus{outline:0;background:#222a3d;color:#ffc174}.ab-account-logout{color:#ffb4ab}.ab-account-logout:disabled{opacity:.6;cursor:wait}
    @media(max-width:767px){
      html{font-size:15px} body{min-width:0;overflow-x:hidden;padding-bottom:5.75rem}
      aside.fixed,aside[class*="fixed"]{display:none!important}
      .pl-64,.pl-72,.ml-64,.ml-72{padding-left:0!important;margin-left:0!important}
      header.fixed{left:0!important;right:0!important;height:auto!important;min-height:4.25rem!important;padding:.65rem .9rem!important}
      header.fixed .hidden{display:none!important}
      main{padding:5.3rem 1rem 1.5rem!important;min-width:0!important}
      main>div{min-width:0!important}
      .grid{grid-template-columns:repeat(1,minmax(0,1fr))!important}
      .grid.grid-cols-2,.grid.grid-cols-3,.grid.grid-cols-4,.grid.grid-cols-5,.grid.grid-cols-6,.grid.grid-cols-7{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .lg\\:grid-cols-12,.xl\\:grid-cols-12,.md\\:grid-cols-2,.md\\:grid-cols-3,.md\\:grid-cols-4{grid-template-columns:repeat(1,minmax(0,1fr))!important}
      .lg\\:col-span-12,.xl\\:col-span-6,.col-span-2,.col-span-3,.col-span-4,.col-span-5,.col-span-6,.col-span-7,.col-span-8{grid-column:span 1/span 1!important}
      [class*="w-\\["]{max-width:100%!important}
      .text-headline-xl,.font-headline-xl{font-size:clamp(1.8rem,8vw,2.6rem)!important;line-height:1.08!important}
      .text-headline-lg,.font-headline-lg{font-size:clamp(1.45rem,6vw,2rem)!important;line-height:1.15!important}
      .flex-row{flex-wrap:wrap}.justify-between{gap:.65rem}
      input,select,textarea{font-size:16px!important}
      dialog{width:calc(100vw - 1.5rem)!important;max-width:34rem!important;margin:auto!important}
      .ab-mobile-nav{position:fixed;z-index:1000;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:.45rem .3rem max(.55rem,env(safe-area-inset-bottom));background:rgba(6,14,32,.96);border-top:1px solid rgba(255,193,116,.22);backdrop-filter:blur(18px)}
      .ab-mobile-nav a{min-width:0;text-align:center;padding:.35rem .1rem;color:#d8c3ad;font-size:9px;font-weight:700;letter-spacing:.03em;text-decoration:none;text-transform:uppercase}
      .ab-mobile-nav a[aria-current="page"]{color:#ffc174}.ab-mobile-nav .material-symbols-outlined{display:block;font-size:21px;margin:0 auto .1rem}
      .ab-mobile-menu{position:fixed;z-index:999;inset:auto .6rem 5.35rem .6rem;padding:.7rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem;border:1px solid rgba(255,193,116,.25);border-radius:1rem;background:#101a30;box-shadow:0 18px 42px rgba(0,0,0,.45)}
      .ab-mobile-menu[hidden]{display:none}.ab-mobile-menu a{padding:.7rem;border-radius:.65rem;background:#171f33;color:#dae2fd;text-decoration:none;font-size:.78rem;font-weight:700}
      body:has(form) main{padding-left:1rem!important;padding-right:1rem!important}
    }
    @media(min-width:768px){.ab-mobile-nav,.ab-mobile-menu{display:none!important}}
  `;
  document.head.append(mobileStyle);

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
      const dockItems = [['dashboard','dashboard','Home'],['quests','swords','Quests'],['character','person','Hero'],['shop','storefront','Shop'],['settings','menu','More']];
      const dock = document.createElement('nav'); dock.className = 'ab-mobile-nav'; dock.setAttribute('aria-label','Mobile navigation');
      dock.innerHTML = dockItems.map(([key,icon,label]) => `<a href="${routes[key]}" ${current===key?'aria-current="page"':''} data-mobile-route="${key}"><span class="material-symbols-outlined">${icon}</span>${label}</a>`).join('');
      document.body.append(dock);
      const menu = document.createElement('nav'); menu.className='ab-mobile-menu'; menu.hidden=true; menu.setAttribute('aria-label','More screens');
      menu.innerHTML = [['inventory','Inventory'],['achievements','Trophy Room'],['activity','Activity'],['progression','Progression'],['guild','Guild & Raids'],['settings','System Settings']].map(([key,label])=>`<a href="${routes[key]}">${label}</a>`).join(''); document.body.append(menu);
      dock.querySelector('[data-mobile-route="settings"]')?.addEventListener('click', event => { event.preventDefault(); menu.hidden=!menu.hidden; });
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

    // Turn the repeated visual-only profile cluster into a real, keyboard-accessible account menu.
    const profileImage = [...document.querySelectorAll('header img[alt="Profile"]')][0];
    if (profileImage) {
      const profileTrigger = profileImage.closest('div');
      if (profileTrigger && !profileTrigger.dataset.accountMenu) {
        profileTrigger.dataset.accountMenu = 'true';
        profileTrigger.setAttribute('role', 'button');
        profileTrigger.setAttribute('tabindex', '0');
        profileTrigger.setAttribute('aria-haspopup', 'menu');
        profileTrigger.setAttribute('aria-expanded', 'false');
        profileTrigger.setAttribute('aria-label', 'Open account menu');
        profileTrigger.style.position = 'relative';
        const accountMenu = document.createElement('div');
        accountMenu.className = 'ab-account-menu hidden absolute right-0 top-full z-[120] mt-3 w-56 overflow-hidden rounded-xl border border-primary/30 bg-surface-container-lowest p-1.5 shadow-2xl backdrop-blur-xl';
        accountMenu.setAttribute('role', 'menu');
        accountMenu.innerHTML = '<a href="character.html" role="menuitem" class="ab-account-link">Character</a><a href="settings.html" role="menuitem" class="ab-account-link">System settings</a><div class="my-1 border-t border-surface-container-high"></div><button type="button" role="menuitem" class="ab-account-link ab-account-logout">Log out</button>';
        profileTrigger.append(accountMenu);
        const setOpen = open => { accountMenu.classList.toggle('hidden', !open); profileTrigger.setAttribute('aria-expanded', String(open)); };
        profileTrigger.addEventListener('click', event => { if (event.target.closest('.ab-account-menu')) return; setOpen(accountMenu.classList.contains('hidden')); });
        profileTrigger.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(accountMenu.classList.contains('hidden')); } if (event.key === 'Escape') setOpen(false); });
        document.addEventListener('click', event => { if (!profileTrigger.contains(event.target)) setOpen(false); });
        accountMenu.querySelector('.ab-account-logout').addEventListener('click', async () => {
          const logout = accountMenu.querySelector('.ab-account-logout'); logout.disabled = true; logout.textContent = 'Signing out…';
          try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } finally { sessionStorage.removeItem('abhyudaya_session'); location.href = 'index.html'; }
        });
      }
    }
  });
})();
