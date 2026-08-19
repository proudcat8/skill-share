function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(date) {
  if (!date) return '';
  const d = date.includes('T') ? new Date(date) : new Date(date + 'Z');
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
  return d.toLocaleDateString();
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  t.onclick = () => dismiss(t);
  setTimeout(() => dismiss(t), 3000);
}

function dismiss(el) {
  el.classList.add('removing');
  setTimeout(() => el.remove(), 200);
}

function formatSessionDate(d) {
  return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSessionTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.anim, .stagger').forEach(el => observer.observe(el));
}
