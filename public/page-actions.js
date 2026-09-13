(() => {
  const labelOf = node => (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach(button => {
      const label = labelOf(button);
      if (/quick quest/.test(label)) button.addEventListener('click', () => location.href = 'quests.html?new=1');
      if (/json/.test(label)) button.addEventListener('click', () => location.href = '/api/export.json');
      if (/csv logs/.test(label)) button.addEventListener('click', () => location.href = '/api/export.csv');
      if (/return to realm|return to command dashboard/.test(label) && !button.id) button.addEventListener('click', () => location.href = 'quests.html');
    });
    if (location.pathname.endsWith('quests.html') && new URLSearchParams(location.search).has('new')) document.getElementById('openCreateModalBtn')?.click();
  });
})();
