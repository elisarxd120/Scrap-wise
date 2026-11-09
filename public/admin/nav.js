async function initializeAdminNav() {
  const mount = document.getElementById('admin-nav');
  if (!mount) return;

  const response = await fetch('/admin/nav.html');
  mount.innerHTML = await response.text();

  document.getElementById('mobile-menu').addEventListener('click', () => document.body.classList.add('menu-open'));
  document.getElementById('sidebar-close').addEventListener('click', () => document.body.classList.remove('menu-open'));
  document.getElementById('sidebar-overlay').addEventListener('click', () => document.body.classList.remove('menu-open'));

  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
    if (path.startsWith(`/admin/${link.dataset.page}`)) link.classList.add('active');
  });

  try {
    const navResponse = await fetch('/admin/api/nav');
    if (navResponse.ok) {
      const nav = await navResponse.json();
      document.getElementById('admin-name').textContent = nav.adminName;
      setBadge(document.getElementById('pending-badge'), nav.pendingApprovals);
      setBadge(document.getElementById('unread-badge'), nav.unreadAlerts);
    }
  } catch (error) { console.error('Unable to load navigation data', error); }

  const dropdown = document.getElementById('notification-dropdown');
  document.getElementById('notification-bell').addEventListener('click', async () => {
    dropdown.classList.toggle('hidden');
    document.getElementById('notification-bell').setAttribute('aria-expanded', String(!dropdown.classList.contains('hidden')));
    await loadNotifications();
  });
  document.getElementById('mark-all-read').addEventListener('click', async () => {
    await fetch('/admin/api/alerts/read-all', { method: 'POST' });
    await loadNotifications();
    document.getElementById('unread-badge').classList.add('hidden');
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.body.classList.remove('menu-open');
    dropdown.classList.add('hidden');
    document.getElementById('notification-bell').setAttribute('aria-expanded', 'false');
  });
}

function setBadge(element, count) {
  element.textContent = count;
  element.classList.toggle('hidden', count === 0);
}

async function loadNotifications() {
  const list = document.getElementById('notification-list');
  try {
    const response = await fetch('/admin/api/alerts');
    if (!response.ok) return;
    const alerts = await response.json();
    if (!alerts.length) { list.innerHTML = '<p class="notification-empty">No notifications.</p>'; return; }
    list.innerHTML = alerts.map(alert => `<button type="button" class="notification-item ${alert.is_read ? '' : 'unread'}" data-alert-id="${Number(alert.id)}"><span>${escapeHtml(alert.message)}</span><small>${escapeHtml(alert.created_at)}</small></button>`).join('');
    list.querySelectorAll('.notification-item').forEach(item => item.addEventListener('click', async () => {
      await fetch(`/admin/api/alerts/${Number(item.dataset.alertId)}/read`, { method: 'POST' });
      item.classList.remove('unread');
    }));
  } catch (error) { list.innerHTML = '<p class="notification-empty">Unable to load alerts.</p>'; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}

initializeAdminNav();
