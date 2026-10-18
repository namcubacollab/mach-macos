import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const referenceTime = new Date('2026-10-18T11:30:00Z');
const browserErrors = new WeakMap<Page, string[]>();

async function navigate(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click();
}

async function settings(page: Page) {
  await navigate(page, 'Thiết lập');
  await expect(page.getByRole('heading', { name: 'Những gì Mạch ghi lại' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(new Date(referenceTime.getTime() + 1000));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Một ngày, nhiều điều hay.' })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || [], 'No browser console errors or uncaught exceptions').toEqual([]);
});

test('overview displays real sample totals, date navigation, and category drill-down', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Bản xem thử' })).toBeVisible();
  await expect(page.locator('.metric-card')).toHaveCount(4);
  const values = await page.locator('.metric-value').allTextContents();
  expect(values.every(value => /[1-9]/.test(value))).toBeTruthy();
  await expect(page.getByRole('img', { name: /^Phân bố/ })).toBeVisible();
  await expect(page.locator('.hour-bar')).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Ngày sau', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ngày trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ngày sau', exact: true })).toBeEnabled();
  await expect(page.locator('.date-label')).not.toContainText('Hôm nay');
  await page.getByRole('button', { name: 'Ngày sau', exact: true }).click();
  await expect(page.locator('.date-label')).toContainText('Hôm nay');
  await page.locator('.category-list').getByRole('button', { name: /Học hỏi/ }).click();
  await expect(page.getByRole('heading', { name: 'Ngày của bạn, kể lại.' })).toBeVisible();
  await expect(page.locator('.filter-tabs').getByRole('button', { name: 'Học hỏi', exact: true })).toHaveClass('selected');
  await expect(page.locator('.activity-row .category-tag').first()).toHaveText('Học hỏi');
  expect(await page.locator('.activity-row').count()).toBeGreaterThan(0);
});

test('timeline combines category filters, Vietnamese search, and empty states', async ({ page }) => {
  await navigate(page, 'Dòng thời gian');
  const allCount = await page.locator('.activity-row').count();
  expect(allCount).toBeGreaterThan(20);
  await page.locator('.filter-tabs').getByRole('button', { name: 'Học hỏi', exact: true }).click();
  const learningCount = await page.locator('.activity-row').count();
  expect(learningCount).toBeGreaterThan(0);
  expect(learningCount).toBeLessThan(allCount);
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).fill('thiet ke');
  expect(await page.locator('.activity-row').count()).toBeGreaterThan(0);
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).fill('no-such-activity-79b278');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy dấu vết này' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).clear();
  await page.locator('.filter-tabs').getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(page.locator('.activity-row')).toHaveCount(allCount);
});

test('global keyboard search finds unaccented Vietnamese text across days and opens details', async ({ page }) => {
  await page.keyboard.press('Control+k');
  const searchDialog = page.getByRole('dialog', { name: 'Tìm lại một dấu vết' });
  await expect(searchDialog).toBeVisible();
  await searchDialog.getByRole('textbox', { name: 'Tìm kiếm mọi hoạt động' }).fill('thiet ke');
  await expect(searchDialog.locator('.search-results > button').first()).toBeVisible();
  expect(await searchDialog.locator('.search-results > button').count()).toBeGreaterThan(1);
  await expect(searchDialog).toContainText('Tìm trên tất cả các ngày');
  const firstTitle = await searchDialog.locator('.search-results > button strong').first().innerText();
  await searchDialog.locator('.search-results > button').first().click();
  const detail = page.getByRole('dialog', { name: 'Chi tiết dấu vết' });
  await expect(detail.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible();
  await expect(searchDialog).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).not.toBeVisible();
  await page.keyboard.press('Control+k');
  await searchDialog.getByRole('textbox', { name: 'Tìm kiếm mọi hoạt động' }).fill('zz-no-match-1930');
  await expect(searchDialog.getByRole('heading', { name: 'Không tìm thấy dấu vết', exact: true })).toBeVisible();
  await searchDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
});

test('bookmarking a timeline item persists and makes it searchable in the library', async ({ page }) => {
  const title = 'electron/electron — desktop apps với công nghệ web';
  await navigate(page, 'Dòng thời gian');
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).fill('electron/electron');
  await expect(page.locator('.activity-row')).toHaveCount(1);
  await page.getByRole('button', { name: `Lưu ${title}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Bỏ lưu ${title}`, exact: true })).toBeVisible();
  await navigate(page, 'Đã lưu');
  await page.getByRole('textbox', { name: 'Tìm trong thư viện' }).fill('electron/electron');
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await expect(page.locator('.saved-card .card-title-button')).toHaveText(title);
  await page.reload();
  await navigate(page, 'Đã lưu');
  await page.getByRole('textbox', { name: 'Tìm trong thư viện' }).fill('electron/electron');
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.getByRole('button', { name: `Bỏ lưu ${title}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa tìm thấy ý tưởng này' })).toBeVisible();
});

test('deleting one activity removes it from the timeline and survives reload', async ({ page }) => {
  await navigate(page, 'Dòng thời gian');
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).fill('electron/electron');
  await page.locator('.activity-row .activity-main').click();
  const detail = page.getByRole('dialog', { name: 'Chi tiết dấu vết' });
  await expect(detail).toContainText('https://github.com/electron/electron');
  await detail.getByRole('button', { name: 'Xóa dấu vết này' }).click();
  await expect(detail).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Không tìm thấy dấu vết này' })).toBeVisible();
  await page.reload();
  await navigate(page, 'Dòng thời gian');
  await page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' }).fill('electron/electron');
  await expect(page.locator('.activity-row')).toHaveCount(0);
});

test('JSON and CSV downloads contain the activity history', async ({ page }) => {
  await page.getByRole('button', { name: 'Xuất dữ liệu', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Mang nhật ký của bạn theo' });
  const expectedCount = Number((await exportDialog.locator('.modal-description strong').innerText()).match(/\d+/)?.[0]);
  expect(expectedCount).toBeGreaterThan(100);
  const jsonDownload = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: /Dữ liệu JSON/ }).click();
  const jsonFile = await jsonDownload;
  expect(jsonFile.suggestedFilename()).toMatch(/^mach-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile((await jsonFile.path())!, 'utf8'));
  expect(exported.app).toBe('Mạch');
  expect(exported.events).toHaveLength(expectedCount);
  expect(exported.events.some((event: { url?: string }) => event.url?.includes('github.com'))).toBeTruthy();
  await expect(exportDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Xuất dữ liệu', exact: true }).click();
  const csvDownload = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: /Bảng tính CSV/ }).click();
  const csvFile = await csvDownload;
  expect(csvFile.suggestedFilename()).toMatch(/\.csv$/);
  const csv = await readFile((await csvFile.path())!, 'utf8');
  expect(csv).toContain('"Thời điểm","Ứng dụng","Tiêu đề","URL"');
  expect(csv).toContain('https://github.com/');
  expect(csv.trim().split('\r\n')).toHaveLength(expectedCount + 1);
});

test('analytics can change its period and social filters expose honest interaction details', async ({ page }) => {
  await navigate(page, 'Thống kê');
  await expect(page.getByRole('heading', { name: 'Bảy ngày, một nhịp riêng.' })).toBeVisible();
  await expect(page.locator('.week-day')).toHaveCount(7);
  const weeklyTotal = await page.locator('.metric-value').first().innerText();
  await page.getByRole('button', { name: 'Ngày đã chọn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nhịp hoạt động trong ngày' })).toBeVisible();
  await expect(page.locator('.metric-value').first()).not.toHaveText(weeklyTotal);
  await expect(page.locator('.hour-bar')).toHaveCount(24);
  await navigate(page, 'Không gian social');
  await page.locator('.social-toolbar').getByRole('button', { name: '𝕏 / Twitter', exact: true }).click();
  const cards = page.locator('.social-card');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const source of await cards.locator('.social-card-top strong').allTextContents()) expect(source).toBe('x.com');
  await cards.filter({ has: page.locator('.action-tag.interaction') }).first().getByRole('button', { name: 'Xem dấu vết' }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết dấu vết' })).toContainText('không xác nhận hành động đã thành công');
  await page.keyboard.press('Escape');
  await page.locator('.social-toolbar').getByRole('button', { name: 'Reddit', exact: true }).click();
  expect(await cards.count()).toBeGreaterThan(0);
  for (const source of await cards.locator('.social-card-top strong').allTextContents()) expect(source).toBe('reddit.com');
  await page.locator('.social-toolbar').getByRole('button', { name: 'LinkedIn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Một khoảng lặng trên social' })).toBeVisible();
});

test('settings save recording, social consent, retention, and a daily focus goal', async ({ page }) => {
  await settings(page);
  const recording = page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true });
  const social = page.getByRole('switch', { name: 'Ghi nhận tương tác trên mạng xã hội', exact: true });
  await expect(recording).not.toBeChecked();
  await expect(social).not.toBeChecked();
  await recording.click();
  await expect(recording).toBeChecked();
  await social.click();
  await expect(social).toBeChecked();
  await page.getByRole('combobox', { name: 'Thời gian lưu lịch sử' }).selectOption('7');
  await page.getByRole('spinbutton', { name: 'Mục tiêu tập trung, số phút mỗi ngày' }).fill('180');
  await page.locator('.settings-goal-input').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.locator('.settings-goal-input').getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled();
  await page.reload();
  await settings(page);
  await expect(recording).toBeChecked();
  await expect(social).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Thời gian lưu lịch sử' })).toHaveValue('7');
  await expect(page.getByRole('spinbutton', { name: 'Mục tiêu tập trung, số phút mỗi ngày' })).toHaveValue('180');
  await expect(page.locator('.settings-demo-note')).toContainText('dữ liệu mẫu');
});

test('privacy exclusions validate, normalize, persist, and can be removed', async ({ page }) => {
  await settings(page);
  const domainInput = page.getByRole('textbox', { name: 'Trang web loại trừ', exact: true });
  const domainForm = page.locator('.settings-add-form').filter({ has: domainInput });
  await domainInput.fill('not a domain');
  await domainForm.getByRole('button', { name: 'Thêm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nhập tên miền hợp lệ');
  await domainInput.fill('https://Example.com/private?not-stored=yes');
  await domainForm.getByRole('button', { name: 'Thêm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ example.com', exact: true })).toBeVisible();
  await expect(domainInput).toHaveValue('');
  const appInput = page.getByRole('textbox', { name: 'Ứng dụng loại trừ', exact: true });
  await appInput.fill('Secret Diary');
  await page.locator('.settings-add-form').filter({ has: appInput }).getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.reload();
  await settings(page);
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ example.com', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ Secret Diary', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ loại trừ example.com', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ example.com', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Bỏ loại trừ Secret Diary', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ Secret Diary', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Bỏ loại trừ 1Password', exact: true })).toBeVisible();
});

test('clearing history requires confirmation, supports cancellation, and preserves settings', async ({ page }) => {
  await settings(page);
  await page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa lịch sử', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Xóa toàn bộ lịch sử?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', { name: 'Giữ lại lịch sử' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  await page.getByRole('button', { name: 'Xóa lịch sử', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Giữ lại lịch sử' }).click();
  await expect(page.getByRole('button', { name: 'Xóa lịch sử', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Xóa lịch sử', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Xóa toàn bộ', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa lịch sử', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true })).toBeChecked();
  await page.reload();
  await navigate(page, 'Dòng thời gian');
  await expect(page.getByRole('heading', { name: 'Chưa có hoạt động phù hợp' })).toBeVisible();
  await navigate(page, 'Đã lưu');
  await expect(page.getByRole('heading', { name: 'Thư viện chờ những điều hay' })).toBeVisible();
  await settings(page);
  await expect(page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Khôi phục dữ liệu mẫu', exact: true }).click();
  await navigate(page, 'Dòng thời gian');
  expect(await page.locator('.activity-row').count()).toBeGreaterThan(20);
  await page.reload();
  await navigate(page, 'Dòng thời gian');
  expect(await page.locator('.activity-row').count()).toBeGreaterThan(20);
});

test('focus sessions persist over reload, can end early, and complete after the selected time', async ({ page }) => {
  await page.getByRole('button', { name: 'Bắt đầu tập trung', exact: true }).click();
  const setup = page.getByRole('dialog', { name: 'Dành chỗ cho sự tập trung' });
  await setup.locator('.focus-options').getByRole('button', { name: /45/ }).click();
  await setup.getByRole('button', { name: 'Bắt đầu 45 phút', exact: true }).click();
  await expect(page.locator('.focus-top')).toHaveText('45:00');
  await page.clock.fastForward(30_000);
  await expect(page.locator('.focus-top')).toHaveText('44:30');
  await page.reload();
  await expect(page.locator('.focus-top')).toHaveText('44:30');
  await page.locator('.focus-top').click();
  await page.getByRole('dialog', { name: 'Một khoảng thời gian cho bạn' }).getByRole('button', { name: 'Kết thúc phiên', exact: true }).click();
  await expect(page.locator('.focus-top')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Bắt đầu tập trung', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu tập trung', exact: true }).click();
  await setup.getByRole('button', { name: 'Bắt đầu 25 phút', exact: true }).click();
  await page.clock.fastForward(25 * 60_000 + 1000);
  await expect(page.locator('.focus-top')).not.toBeVisible();
  await expect(page.getByRole('status')).toContainText('Hoàn thành phiên tập trung');
  expect(await page.evaluate(() => localStorage.getItem('mach-focus-end'))).toBeNull();
});

test('pairing secret is requested only after an explicit action in the native app', async ({ page }) => {
  await page.addInitScript(() => {
    const state = {
      events: [],
      settings: { recording: false, captureSocial: false, retentionDays: 30, excludedDomains: [], excludedApps: [], focusGoalMinutes: 120 },
      collector: { platform: 'darwin', extensionConnected: false },
    };
    const host = window as unknown as { mach: unknown; __pairCalls: number };
    host.__pairCalls = 0;
    host.mach = {
      getState: async () => structuredClone(state),
      updateSettings: async (partial: object) => { Object.assign(state.settings, partial); return structuredClone(state); },
      clearHistory: async () => structuredClone(state),
      deleteEvent: async () => structuredClone(state),
      bookmark: async () => structuredClone(state),
      getPairingToken: async () => { host.__pairCalls++; return 'test-only-local-pairing-code'; },
      openExternal: async () => {},
      onStateChanged: () => () => {},
    };
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đã tạm dừng', exact: true })).toBeVisible();
  await settings(page);
  expect(await page.evaluate(() => (window as unknown as { __pairCalls: number }).__pairCalls)).toBe(0);
  await page.locator('.settings-setup summary').click();
  await expect(page.getByRole('button', { name: 'Lấy mã ghép nối' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pairCalls: number }).__pairCalls)).toBe(0);
  await page.getByRole('button', { name: 'Lấy mã ghép nối' }).click();
  await expect(page.locator('.settings-pairing code')).toHaveText('test-only-local-pairing-code');
  expect(await page.evaluate(() => (window as unknown as { __pairCalls: number }).__pairCalls)).toBe(1);
  await page.getByRole('button', { name: 'Ẩn mã', exact: true }).click();
  await expect(page.locator('.settings-pairing code')).not.toBeVisible();
});

test('compact layout remains navigable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const noHorizontalOverflow = async () => {
    expect(await page.locator('.main-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  };
  await noHorizontalOverflow();
  await navigate(page, 'Dòng thời gian');
  await expect(page.getByRole('textbox', { name: 'Tìm trong dòng thời gian' })).toBeVisible();
  await page.locator('.filter-tabs').getByRole('button', { name: 'Cá nhân', exact: true }).click();
  await expect(page.locator('.filter-tabs').getByRole('button', { name: 'Cá nhân', exact: true })).toHaveClass('selected');
  await expect(page.locator('.activity-row .category-tag').first()).toHaveText('Cá nhân');
  await noHorizontalOverflow();
  await navigate(page, 'Đã lưu');
  await expect(page.getByRole('textbox', { name: 'Tìm trong thư viện' })).toBeVisible();
  await noHorizontalOverflow();
  await settings(page);
  await noHorizontalOverflow();
  await page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Ghi nhận hoạt động', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Xóa lịch sử', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Xóa toàn bộ lịch sử?' })).toBeVisible();
  await page.getByRole('button', { name: 'Giữ lại lịch sử', exact: true }).click();
});

for (const viewport of [{ width: 1440, height: 1080 }, { width: 390, height: 844 }]) {
  test(`all six views are usable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
    const directory = process.env.MACH_QA_DIR || 'work/qa';
    await mkdir(directory, { recursive: true });
    for (const [name, slug] of [
      ['Tổng quan', 'overview'], ['Dòng thời gian', 'timeline'], ['Thống kê', 'analytics'],
      ['Không gian social', 'social'], ['Đã lưu', 'saved'], ['Thiết lập', 'settings'],
    ]) {
      await navigate(page, name);
      await page.locator('.main-content').evaluate(element => element.scrollTo(0, 0));
      expect.soft(await page.locator('.main-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${name}: main content does not overflow horizontally`).toBeTruthy();
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: document does not overflow horizontally`).toBeTruthy();
      await page.screenshot({ path: `${directory}/${slug}-${viewport.width}x${viewport.height}.png`, animations: 'disabled' });
    }
  });
}
