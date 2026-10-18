import { SITE_ORIGINS } from './helpers.mjs';

const $ = id => document.getElementById(id);
let state;
let busy = false;

function feedback(message = '') { $('feedback').textContent = message; $('feedback').hidden = !message; }
function render(next) {
  state = next;
  $('pair-section').hidden = next.paired;
  $('connected-section').hidden = !next.paired;
  $('status-title').textContent = !next.paired ? 'Chưa ghép nối' : !next.connected ? 'Đang ngắt kết nối' : next.recording ? 'Đang ghi hoạt động' : 'Đã kết nối · đang tạm dừng';
  $('status-dot').classList.toggle('active', next.connected && next.recording);
  $('status-detail').textContent = next.recording ? 'Chỉ tính thời gian tab đang xem khi trình duyệt ở phía trước và bạn còn hoạt động.' : next.connected ? 'Mở Cài đặt trong Mạch để bật ghi. Bạn luôn có thể tạm dừng bất kỳ lúc nào.' : next.lastError || 'Mở ứng dụng Mạch trên máy Mac này để kết nối.';
  $('tabs-state').textContent = next.grantedTabs ? 'Đã cấp quyền' : 'Chưa cấp quyền';
  $('grant-tabs').hidden = next.grantedTabs;
  $('social-toggle').checked = next.socialOptIn;
  $('social-settings').hidden = !next.socialOptIn;
  $('social-hint').textContent = next.desktopSocial ? 'Chọn website bạn muốn cho phép bên dưới.' : 'Bật “Ghi tương tác mạng xã hội” trong Cài đặt của Mạch để bắt đầu.';
  for (const site of ['x', 'reddit']) $(`grant-${site}`).querySelector('span').textContent = next.grantedSites?.[site] ? 'Tắt' : 'Bật';
}

async function send(message) {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply || reply.error) throw new Error(reply?.error || 'Extension chưa sẵn sàng. Hãy thử mở lại.');
  return reply;
}

async function run(action) {
  if (busy) return;
  busy = true;
  feedback();
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  try { render(await action()); }
  catch (error) { feedback(error.message || 'Không thực hiện được thao tác.'); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => button.disabled = false); }
}

$('pair-form').addEventListener('submit', event => {
  event.preventDefault();
  const token = $('pairing-token').value.trim();
  if (!/^[A-Za-z0-9_=-]{16,256}$/.test(token)) { feedback('Dán đầy đủ mã ghép nối từ Cài đặt của Mạch.'); return; }
  // Permission request stays directly inside the user's gesture.
  const permission = chrome.permissions.request({permissions: ['tabs']});
  void run(async () => {
    if (!await permission) throw new Error('Cần quyền đọc tab để ghi những trang bạn đang xem.');
    const next = await send({type: 'PAIR', token});
    $('pairing-token').value = '';
    return next;
  });
});
$('grant-tabs').addEventListener('click', () => {
  const permission = chrome.permissions.request({permissions: ['tabs']});
  void run(async () => { await permission; return send({type: 'PERMISSIONS_CHANGED'}); });
});
$('social-toggle').addEventListener('change', () => void run(() => send({type: 'SET_SOCIAL', enabled: $('social-toggle').checked})));
for (const site of ['x', 'reddit']) {
  $(`grant-${site}`).addEventListener('click', () => {
    const permission = state.grantedSites?.[site]
      ? chrome.permissions.remove({origins: SITE_ORIGINS[site]})
      : chrome.permissions.request({origins: SITE_ORIGINS[site]});
    void run(async () => { await permission; return send({type: 'PERMISSIONS_CHANGED'}); });
  });
}
$('refresh').addEventListener('click', () => void run(() => send({type: 'GET_STATE'})));
$('unpair').addEventListener('click', () => void run(() => send({type: 'UNPAIR'})));
void run(() => send({type: 'GET_STATE'}));
