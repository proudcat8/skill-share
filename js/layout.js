function getMockUser() {
  const name = localStorage.getItem('ss_username') || 'Guest';
  return { id: 'mock-user-1', display_name: name, email: '' };
}

function buildLayout() {
  const name = localStorage.getItem('ss_username');
  if (!name) { window.location.href = 'auth.html'; return; }

  const loc = window.location.pathname.split('/').pop() || 'feed.html';
  const links = [
    { href: 'feed.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', label: 'Feed' },
    { href: 'profile.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Profile' },
    { href: 'messages.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', label: 'Messages' },
    { href: 'schedule.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', label: 'Schedule' },
  ];

  const user = getMockUser();
  const initials = getInitials(user.display_name);
  const navLinks = links.map(l => `<a href="${l.href}" class="sidebar-link ${loc === l.href ? 'active' : ''}">${l.icon}<span>${l.label}</span></a>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header"><div class="logo">Skill<span>Share</span></div></div>
      <div class="sidebar-nav">${navLinks}</div>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar">${initials}</div>
          <div class="user-info"><div class="name">${user.display_name}</div></div>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="localStorage.removeItem('ss_username');window.location.href='auth.html'">Change Username</button>
      </div>
    </div>
    <div class="mobile-overlay" id="mobile-overlay" onclick="closeSidebar()"></div>
    <div class="main-content">
      <div class="topbar">
        <button class="mobile-toggle" onclick="openSidebar()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <div class="topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search skills, people...">
        </div>
      </div>
      <div class="page-content" id="app-content"></div>
    </div>`;
}

function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('mobile-overlay').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.remove('open'); }
