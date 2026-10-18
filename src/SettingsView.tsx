import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleCheck, Copy, Database, Fingerprint, Globe2, HardDrive, Info, KeyRound, Link2, LoaderCircle, LockKeyhole, Plus, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { AppState, Settings } from './types';
import './settings.css';

interface SettingsViewProps {
  state: AppState;
  isDemo: boolean;
  onUpdate: (partial: Partial<Settings>) => Promise<void>;
  onClear: () => Promise<void>;
  onExport: () => void;
  notify: (message: string) => void;
}

function SettingSwitch({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: () => void; label: string }) {
  return <button type="button" className="settings-switch" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}><span /></button>;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function SettingsView({ state, isDemo, onUpdate, onClear, onExport, notify }: SettingsViewProps) {
  const { settings, collector } = state;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [app, setApp] = useState('');
  const [focusGoal, setFocusGoal] = useState(String(settings.focusGoalMinutes));
  const [token, setToken] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const clearDialog = useRef<HTMLDialogElement>(null);
  const cancelClear = useRef<HTMLButtonElement>(null);

  useEffect(() => { setFocusGoal(String(settings.focusGoalMinutes)); }, [settings.focusGoalMinutes]);
  useEffect(() => {
    const dialog = clearDialog.current;
    if (clearOpen && dialog && !dialog.open) { dialog.showModal(); cancelClear.current?.focus(); }
    if (!clearOpen && dialog?.open) dialog.close();
  }, [clearOpen]);
  useEffect(() => { if (!copied) return; const id = window.setTimeout(() => setCopied(false), 2000); return () => window.clearTimeout(id); }, [copied]);

  async function update(partial: Partial<Settings>, message = 'Đã lưu cài đặt') {
    setSaving(true); setError('');
    try { await onUpdate(partial); notify(isDemo ? `${message} cho bản khám phá` : message); return true; }
    catch (cause) { setError(errorMessage(cause)); return false; }
    finally { setSaving(false); }
  }

  async function addDomain(event: FormEvent) {
    event.preventDefault();
    const input = domain.trim();
    if (!input) return;
    let hostname: string;
    try {
      const parsed = new URL(input.includes('://') ? input : `https://${input}`);
      hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
      if (!['http:', 'https:'].includes(parsed.protocol) || !hostname.includes('.') || /[\s*]/.test(hostname)) throw new Error();
    } catch { setError('Nhập tên miền hợp lệ, ví dụ: mail.google.com.'); return; }
    if (settings.excludedDomains.includes(hostname)) { setError('Tên miền này đã có trong danh sách.'); return; }
    if (await update({ excludedDomains: [...settings.excludedDomains, hostname] }, 'Đã thêm trang web loại trừ')) setDomain('');
  }

  async function addApp(event: FormEvent) {
    event.preventDefault();
    const name = app.trim();
    if (!name) return;
    if (settings.excludedApps.some(item => item.toLowerCase() === name.toLowerCase())) { setError('Ứng dụng này đã có trong danh sách.'); return; }
    if (await update({ excludedApps: [...settings.excludedApps, name] }, 'Đã thêm ứng dụng loại trừ')) setApp('');
  }

  async function revealToken() {
    if (!window.mach || isDemo) { notify('Mở ứng dụng Mạch trên macOS để lấy mã ghép nối thật.'); return; }
    setTokenBusy(true); setError('');
    try { setToken(await window.mach.getPairingToken()); }
    catch (cause) { setError(`Chưa lấy được mã ghép nối: ${errorMessage(cause)}`); }
    finally { setTokenBusy(false); }
  }

  async function copyToken() {
    try { await navigator.clipboard.writeText(token); setCopied(true); }
    catch { setError('Chưa sao chép được. Bạn có thể chọn và sao chép mã thủ công.'); }
  }

  async function clearHistory() {
    setClearing(true); setClearError('');
    try { await onClear(); setClearOpen(false); notify(isDemo ? 'Đã xóa lịch sử của bản khám phá' : 'Đã xóa toàn bộ lịch sử'); }
    catch (cause) { setClearError(errorMessage(cause)); }
    finally { setClearing(false); }
  }

  const connected = !isDemo && collector.extensionConnected;
  const isMac = collector.platform === 'darwin';
  return <div className="settings-page">
    <div className="settings-heading">
      <div><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Cài đặt & quyền riêng tư<span>.</span></h1><p>Ghi lại vừa đủ. Mọi thứ trong tầm kiểm soát.</p></div>
      <span className="settings-local-badge"><ShieldCheck size={15} /> Lưu trên máy của bạn</span>
    </div>

    {isDemo && <div className="settings-demo-note"><Info size={17} /><p><strong>Bạn đang ở bản khám phá.</strong> Cài đặt chỉ áp dụng cho dữ liệu mẫu trong trình duyệt này. Để ghi nhận hoạt động thật, hãy mở ứng dụng macOS và kết nối tiện ích.</p></div>}
    {error && <div className="settings-error" role="alert"><Info size={17} /><span>{error}</span><button aria-label="Đóng thông báo lỗi" onClick={() => setError('')}><X size={16} /></button></div>}

    <div className="settings-layout">
      <div className="settings-main">
        <section className="panel settings-card" aria-labelledby="recording-heading">
          <div className="settings-card-heading"><span className="settings-icon-tile"><SlidersHorizontal size={20} /></span><div><h2 id="recording-heading">Những gì Mạch ghi lại</h2><p>Bạn chọn phạm vi, Mạch tôn trọng lựa chọn đó.</p></div></div>
          <div className="settings-row">
            <div><h3>Ghi nhận hoạt động</h3><p>Ứng dụng đang dùng, trang đang mở và thời gian hoạt động.</p><span className={`settings-inline-status ${settings.recording ? 'is-on' : ''}`}><i />{settings.recording ? 'Đang bật ghi nhận' : 'Đang tạm dừng'}</span></div>
            <SettingSwitch label="Ghi nhận hoạt động" checked={settings.recording} disabled={saving} onChange={() => void update({ recording: !settings.recording })} />
          </div>
          <div className="settings-row">
            <div><h3>Tương tác trên mạng xã hội <span className="settings-small-tag">TÙY CHỌN</span></h3><p>Ghi nhận liên kết bài viết và lần bấm thích, bình luận, lưu, chia sẻ trên X và Reddit.</p><p className="settings-fine-print">Cần bật và cấp quyền từng trang trong tiện ích. Lượt bấm không xác nhận thao tác đã thành công. Không đọc nội dung bạn gõ hay tin nhắn riêng.</p></div>
            <SettingSwitch label="Ghi nhận tương tác trên mạng xã hội" checked={settings.captureSocial} disabled={saving} onChange={() => void update({ captureSocial: !settings.captureSocial })} />
          </div>
          <div className="settings-row">
            <div><h3>Mục tiêu tập trung mỗi ngày</h3><p>Dùng để theo dõi tiến độ trong tổng quan của bạn.</p></div>
            <form className="settings-goal-input" onSubmit={event => {
              event.preventDefault(); const value = Number(focusGoal);
              if (!Number.isInteger(value) || value < 15 || value > 720) { setError('Mục tiêu tập trung cần từ 15 đến 720 phút mỗi ngày.'); return; }
              void update({ focusGoalMinutes: value }, 'Đã lưu mục tiêu tập trung');
            }}>
              <label className="settings-input-unit"><input aria-label="Mục tiêu tập trung, số phút mỗi ngày" type="number" min="15" max="720" step="1" value={focusGoal} onChange={event => setFocusGoal(event.target.value)} /><span>phút</span></label>
              <button type="submit" className="button ghost settings-small-button" disabled={saving || focusGoal === String(settings.focusGoalMinutes)}>Lưu</button>
            </form>
          </div>
        </section>

        <section className="panel settings-card" aria-labelledby="exclusions-heading">
          <div className="settings-card-heading"><span className="settings-icon-tile"><Fingerprint size={20} /></span><div><h2 id="exclusions-heading">Một khoảng riêng tư</h2><p>Các mục dưới đây sẽ không được ghi nhận từ lúc bạn lưu.</p></div></div>
          <div className="settings-exclusion-block">
            <label className="settings-field-label" htmlFor="excluded-domain">Trang web loại trừ</label>
            <form className="settings-add-form" onSubmit={event => void addDomain(event)}><div className="settings-text-input"><Globe2 size={16} /><input id="excluded-domain" value={domain} onChange={event => setDomain(event.target.value)} placeholder="Ví dụ: mail.google.com" autoComplete="off" spellCheck={false} maxLength={253} /></div><button className="button ghost" type="submit" disabled={saving || !domain.trim()}><Plus size={16} />Thêm</button></form>
            <div className="settings-chips">{settings.excludedDomains.length ? settings.excludedDomains.map(value => <span className="settings-chip" key={value}>{value}<button type="button" aria-label={`Bỏ loại trừ ${value}`} disabled={saving} onClick={() => void update({ excludedDomains: settings.excludedDomains.filter(item => item !== value) })}><X size={12} /></button></span>) : <p className="settings-empty-note">Chưa có trang web loại trừ.</p>}</div>
          </div>
          <div className="settings-exclusion-block">
            <label className="settings-field-label" htmlFor="excluded-app">Ứng dụng loại trừ</label>
            <form className="settings-add-form" onSubmit={event => void addApp(event)}><div className="settings-text-input"><HardDrive size={16} /><input id="excluded-app" value={app} onChange={event => setApp(event.target.value)} placeholder="Tên ứng dụng, ví dụ: 1Password" autoComplete="off" maxLength={100} /></div><button className="button ghost" type="submit" disabled={saving || !app.trim()}><Plus size={16} />Thêm</button></form>
            <div className="settings-chips">{settings.excludedApps.length ? settings.excludedApps.map(value => <span className="settings-chip" key={value}>{value}<button type="button" aria-label={`Bỏ loại trừ ${value}`} disabled={saving} onClick={() => void update({ excludedApps: settings.excludedApps.filter(item => item !== value) })}><X size={12} /></button></span>) : <p className="settings-empty-note">Chưa có ứng dụng loại trừ.</p>}</div>
          </div>
        </section>

        <section className="panel settings-card" aria-labelledby="data-heading">
          <div className="settings-card-heading"><span className="settings-icon-tile"><Database size={20} /></span><div><h2 id="data-heading">Dữ liệu thuộc về bạn</h2><p>Giữ những gì hữu ích, xóa khi không còn cần thiết.</p></div></div>
          <div className="settings-row"><div><h3>Thời gian lưu lịch sử</h3><p>Tự động xóa các hoạt động cũ hơn khoảng thời gian này.</p></div><label className="settings-select"><span className="settings-sr-only">Thời gian lưu lịch sử</span><select value={settings.retentionDays} disabled={saving} onChange={event => void update({ retentionDays: Number(event.target.value) })}>{[7, 30, 90].map(days => <option key={days} value={days}>{days} ngày</option>)}</select><ChevronDown size={14} /></label></div>
          <div className="settings-row"><div><h3>Xuất dữ liệu</h3><p>Tải bản sao lịch sử hiện có dưới dạng JSON.</p></div><button type="button" className="button ghost settings-data-action" onClick={() => { try { onExport(); } catch (cause) { setError(errorMessage(cause)); } }}><ArrowDownToLine size={16} />Xuất dữ liệu</button></div>
          <div className="settings-row"><div><h3>Xóa toàn bộ lịch sử</h3><p>Xóa {state.events.length.toLocaleString('vi-VN')} hoạt động hiện có. Không thể hoàn tác.</p></div><button type="button" className="button ghost settings-danger-button settings-data-action" onClick={() => { setClearError(''); setClearOpen(true); }} disabled={!state.events.length}><Trash2 size={15} />Xóa lịch sử</button></div>
        </section>
      </div>

      <aside className="settings-aside">
        <section className="settings-privacy-card" aria-labelledby="privacy-heading"><div className="settings-privacy-symbol"><ShieldCheck size={29} strokeWidth={1.5} /></div><span className="eyebrow">RIÊNG TƯ TỪ THIẾT KẾ</span><h2 id="privacy-heading">Một cuốn nhật ký.<br />Chỉ dành cho bạn.</h2><p>Mạch giúp bạn hiểu cách mình sử dụng thời gian. Bạn luôn quyết định khi nào ghi và điều gì được lưu.</p><ul><li><Check size={15} />Dữ liệu lưu cục bộ trên thiết bị</li><li><Check size={15} />Không cần tài khoản</li><li><Check size={15} />Không ghi chế độ ẩn danh</li><li><Check size={15} />Không chụp màn hình hay ghi phím</li></ul><div className="settings-privacy-footnote"><LockKeyhole size={14} /><p>Cơ sở dữ liệu SQLite chưa được Mạch mã hóa. FileVault giúp bảo vệ ổ đĩa khi máy bị mất; người có quyền truy cập tài khoản vẫn có thể đọc dữ liệu.</p></div></section>

        <section className="panel settings-connection-card" aria-labelledby="connection-heading"><div className="settings-connection-title"><Link2 size={18} /><h2 id="connection-heading">Kết nối thiết bị</h2></div><div className="settings-connection-item"><div><strong>Ứng dụng macOS</strong><span>{isDemo ? 'Bản khám phá trên trình duyệt' : isMac ? 'Ghi ứng dụng đang hoạt động' : 'Cần macOS để ghi ứng dụng'}</span></div><span className={`settings-connection-dot ${!isDemo && isMac && !collector.error ? 'is-connected' : ''}`} /></div><div className="settings-connection-item"><div><strong>Tiện ích trình duyệt</strong><span>{connected ? 'Đã kết nối với Mạch' : 'Chưa kết nối'}</span></div><span className={`settings-connection-dot ${connected ? 'is-connected' : ''}`} /></div>{collector.error && !isDemo && <p className="settings-collector-error" role="status">{collector.error}</p>}
          <details className="settings-setup"><summary>Thiết lập trình duyệt<ChevronDown size={15} /></summary><div className="settings-setup-content"><p>Hỗ trợ Chrome và trình duyệt Chromium có tiện ích tương thích.</p><ol><li>Mở trang quản lý tiện ích: <code>chrome://extensions</code>.</li><li>Bật <strong>Developer mode</strong>, chọn <strong>Load unpacked</strong> và mở thư mục <code>extension</code> đi kèm Mạch.</li><li>Mở tiện ích, dán mã ghép nối bên dưới rồi kết nối. Giữ ứng dụng Mạch đang mở.</li></ol>{isDemo ? <div className="settings-pairing-demo"><Info size={15} /><p>Mã ghép nối chỉ có trong ứng dụng desktop. Bản khám phá không kết nối hay thu thập hoạt động thật.</p></div> : token ? <div className="settings-pairing"><label>Mã ghép nối riêng của thiết bị</label><code tabIndex={0}>{token}</code><div><button className="button ghost settings-small-button" type="button" onClick={() => void copyToken()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Đã sao chép' : 'Sao chép'}</button><button className="settings-text-button" onClick={() => setToken('')} type="button">Ẩn mã</button></div><p>Chỉ nhập mã này vào tiện ích Mạch của bạn.</p></div> : <button type="button" className="button ghost settings-pair-button" disabled={tokenBusy} onClick={() => void revealToken()}>{tokenBusy ? <LoaderCircle size={15} className="settings-spinner" /> : <KeyRound size={15} />}Lấy mã ghép nối<ArrowUpRight size={14} /></button>}</div></details>
        </section>
        <p className="settings-bottom-note"><CircleCheck size={14} />Thay đổi được lưu ngay trên thiết bị.</p>
      </aside>
    </div>

    <dialog ref={clearDialog} className="settings-clear-dialog" aria-labelledby="clear-dialog-title" aria-describedby="clear-dialog-description" onCancel={event => { if (clearing) event.preventDefault(); else setClearOpen(false); }} onClose={() => setClearOpen(false)}>
      <span className="settings-delete-icon"><Trash2 size={23} /></span><h2 id="clear-dialog-title">Xóa toàn bộ lịch sử?</h2><p id="clear-dialog-description">{state.events.length.toLocaleString('vi-VN')} hoạt động{isDemo ? ' mẫu' : ''}, bao gồm các mục đã lưu, sẽ bị xóa. Cài đặt được giữ lại. Thao tác này không thể hoàn tác.</p>{clearError && <p className="settings-dialog-error" role="alert">{clearError}</p>}<div className="settings-dialog-actions"><button ref={cancelClear} type="button" className="button ghost" disabled={clearing} onClick={() => setClearOpen(false)}>Giữ lại lịch sử</button><button type="button" className="button settings-confirm-delete" disabled={clearing} onClick={() => void clearHistory()}>{clearing && <LoaderCircle size={16} className="settings-spinner" />}{clearing ? 'Đang xóa…' : 'Xóa toàn bộ'}</button></div>
    </dialog>
  </div>;
}
