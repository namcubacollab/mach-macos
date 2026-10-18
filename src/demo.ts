import type { Activity, AppState, Category } from './types';

interface DemoSession {
  title: string;
  alternate?: string;
  alternateUrl?: string;
  minutes: number;
  category: Category;
  app?: string;
  domain?: string;
  url?: string;
  bookmarked?: boolean;
  excerpt?: string;
}

// Illustrative content only. These sessions are generated locally and are never
// presented to the collector as activity from the user's actual computer.
const morning: DemoSession[] = [
  { title: 'Mạch — thiết kế trải nghiệm dòng thời gian', alternate: 'Design system — màu sắc và nhịp điệu', minutes: 32, category: 'work', domain: 'figma.com', url: 'https://www.figma.com/', excerpt: 'Khám phá một giao diện giúp nhìn lại ngày làm việc nhẹ nhàng hơn.' },
  { title: 'Kế hoạch tuần · những điều cần làm', alternate: 'Product notes · ghi chép phỏng vấn', minutes: 10, category: 'work', domain: 'notion.so', url: 'https://www.notion.so/' },
  { title: 'Visual Studio Code', alternate: 'Visual Studio Code', minutes: 28, category: 'work', app: 'Visual Studio Code' },
  { title: 'shadcn/ui — thành phần giao diện đẹp, dễ tiếp cận', alternate: 'radix-ui/primitives — accessible components', alternateUrl: 'https://github.com/radix-ui/primitives', minutes: 10, category: 'work', domain: 'github.com', url: 'https://github.com/shadcn-ui/ui', bookmarked: true },
  { title: 'Thinking in React — chia nhỏ một giao diện', alternate: 'Managing State — giữ luồng dữ liệu rõ ràng', alternateUrl: 'https://react.dev/learn/managing-state', minutes: 20, category: 'learn', domain: 'react.dev', url: 'https://react.dev/learn/thinking-in-react', bookmarked: true, excerpt: 'Bắt đầu với mô hình dữ liệu, rồi xây từng phần của giao diện.' },
  { title: 'Sprint 12 · làm rõ trạng thái trống', alternate: 'Roadmap · ưu tiên cho trải nghiệm đầu tiên', minutes: 8, category: 'work', domain: 'linear.app', url: 'https://linear.app/' },
  { title: 'X · những góc nhìn về thiết kế sản phẩm', alternate: 'X · một vài ý tưởng để bắt đầu ngày', minutes: 8, category: 'social', domain: 'x.com', url: 'https://x.com/' },
  { title: 'Human Interface Guidelines — thiết kế cho macOS', alternate: 'Designing for macOS — tôn trọng nhịp làm việc', minutes: 17, category: 'learn', domain: 'developer.apple.com', url: 'https://developer.apple.com/design/human-interface-guidelines/designing-for-macos', bookmarked: true },
  { title: 'Notes', alternate: 'Notes', minutes: 6, category: 'work', app: 'Notes' },
];

const noon: DemoSession[] = [
  { title: 'Lịch cá nhân · sắp xếp một buổi chiều', minutes: 5, category: 'life', domain: 'calendar.google.com', url: 'https://calendar.google.com/' },
  { title: 'Một chút nhạc trong giờ nghỉ', alternate: 'Playlist · chậm lại một chút', minutes: 10, category: 'life', domain: 'open.spotify.com', url: 'https://open.spotify.com/' },
];

const afternoon: DemoSession[] = [
  { title: 'Mạch — tinh chỉnh dashboard tổng quan', alternate: 'Component library — trạng thái và tương phản', minutes: 34, category: 'work', domain: 'figma.com', url: 'https://www.figma.com/', bookmarked: true },
  { title: 'Đề xuất sản phẩm · ghi lại ít hơn, hiểu sâu hơn', alternate: 'Product brief · một trải nghiệm đủ riêng tư', minutes: 12, category: 'work', domain: 'docs.google.com', url: 'https://docs.google.com/' },
  { title: 'Typography — chữ rõ ràng trên mọi kích thước', alternate: 'Color — ngữ nghĩa của màu sắc trong giao diện', alternateUrl: 'https://developer.apple.com/design/human-interface-guidelines/color', minutes: 12, category: 'learn', domain: 'developer.apple.com', url: 'https://developer.apple.com/design/human-interface-guidelines/typography', excerpt: 'Kích thước, khoảng cách và độ tương phản làm nên sự rõ ràng.' },
  { title: 'Reddit · cộng đồng thiết kế sản phẩm', alternate: 'Reddit · câu chuyện nghề và sản phẩm', minutes: 11, category: 'social', domain: 'reddit.com', url: 'https://www.reddit.com/r/Design/' },
  { title: 'electron/electron — desktop apps với công nghệ web', alternate: 'microsoft/vscode — tìm hiểu một công cụ quen thuộc', alternateUrl: 'https://github.com/microsoft/vscode', minutes: 16, category: 'work', domain: 'github.com', url: 'https://github.com/electron/electron' },
  { title: 'Visual Studio Code', alternate: 'Visual Studio Code', minutes: 21, category: 'work', app: 'Visual Studio Code' },
  { title: 'YouTube · học cách thiết kế chuyển động tinh tế', alternate: 'YouTube · accessibility trong thiết kế sản phẩm', alternateUrl: 'https://www.youtube.com/@AppleDeveloper', minutes: 18, category: 'learn', domain: 'youtube.com', url: 'https://www.youtube.com/@GoogleDesign', bookmarked: true, excerpt: 'Một chuyển động tốt giải thích điều vừa thay đổi, thay vì chỉ trang trí.' },
  { title: 'Dribbble · cảm hứng cho một dashboard tối giản', alternate: 'Dribbble · những cách trình bày dữ liệu thú vị', minutes: 13, category: 'learn', domain: 'dribbble.com', url: 'https://dribbble.com/search/dashboard', bookmarked: true },
  { title: 'Reddit · typography và những cuốn sách đẹp', alternate: 'Reddit · màu sắc từ cuộc sống thường ngày', minutes: 9, category: 'social', domain: 'reddit.com', url: 'https://www.reddit.com/r/typography/' },
  { title: 'Nhật ký sản phẩm · hôm nay đã tiến thêm gì?', alternate: 'Ghi chú tuần · lưu lại những quyết định nhỏ', minutes: 7, category: 'work', domain: 'notion.so', url: 'https://www.notion.so/' },
  { title: 'X · lướt qua những điều đã lưu', alternate: 'X · một cuộc thảo luận về công cụ làm việc', minutes: 7, category: 'social', domain: 'x.com', url: 'https://x.com/' },
  { title: 'Notes', alternate: 'Notes', minutes: 10, category: 'work', app: 'Notes', bookmarked: true },
];

const samplePosts = [
  { title: 'Chi tiết nhỏ làm nên một sản phẩm dễ dùng', excerpt: 'Nội dung minh họa: một nút bấm đúng chỗ có thể tiết kiệm rất nhiều lần suy nghĩ.', action: 'like' as const },
  { title: 'Một thư viện tham khảo về typography', excerpt: 'Nội dung minh họa: tổng hợp tài nguyên về chữ, khoảng cách và nhịp điệu.', action: 'save' as const },
  { title: 'Bạn giữ tập trung khi mở nhiều tab như thế nào?', excerpt: 'Nội dung minh họa: cuộc thảo luận về thói quen làm việc với trình duyệt.', action: 'comment' as const },
  { title: 'Thiết kế chậm lại để hiểu vấn đề rõ hơn', excerpt: 'Nội dung minh họa: quan sát và thử nghiệm trước khi thêm tính năng.', action: 'click' as const },
  { title: 'Một góc làm việc có nhiều ánh sáng', excerpt: 'Nội dung minh họa: một lời nhắc dành chỗ cho những khoảng nghỉ.', action: 'like' as const },
  { title: 'Những sản phẩm nhỏ được làm thật cẩn thận', excerpt: 'Nội dung minh họa: các dự án cá nhân xoay quanh một nhu cầu cụ thể.', action: 'share' as const },
  { title: 'Bảng màu lấy cảm hứng từ một buổi chiều', excerpt: 'Nội dung minh họa: xanh xám, kem và một điểm nhấn màu cam.', action: 'save' as const },
  { title: 'Từ một ghi chú đến một ý tưởng sản phẩm', excerpt: 'Nội dung minh họa: cách lưu lại ý tưởng để tìm thấy chúng khi cần.', action: 'click' as const },
];

/** A repeatable, seven-day fixture relative to the local date. No user data. */
export function createDemoState(referenceDate: Date = new Date()): AppState {
  const events: Activity[] = [];
  const scales = [.77, 1.12, .94, 1.16, .87, 1.04, 1];
  for (let day = 0; day < 7; day++) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - (6 - day));
    date.setHours(0, 0, 0, 0);
    let sessionIndex = 0;
    let socialIndex = 0;
    const groups = [
      { sessions: morning, hour: 9, minute: day === 6 ? 0 : (day * 7) % 25 },
      { sessions: noon, hour: 12, minute: 32 },
      { sessions: afternoon, hour: 13, minute: 20 },
    ];
    for (const group of groups) {
      const cursorDate = new Date(date);
      cursorDate.setHours(group.hour, group.minute, 0, 0);
      let cursor = cursorDate.getTime();
      for (const session of group.sessions) {
        const duration = Math.round(session.minutes * scales[day] * 60);
        const id = `demo-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${sessionIndex++}`;
        const event: Activity = {
          id,
          title: day % 2 === 0 || !session.alternate ? session.title : session.alternate,
          kind: session.domain ? 'page' : 'app',
          startedAt: cursor,
          duration,
          category: session.category,
          app: session.app || 'Google Chrome',
          ...(session.domain && { domain: session.domain, url: day % 2 !== 0 && session.alternateUrl ? session.alternateUrl : session.url }),
          ...(session.bookmarked && (day === 6 || (day + sessionIndex) % 3 === 0) && { bookmarked: true }),
          ...(session.excerpt && { excerpt: session.excerpt }),
        };
        events.push(event);
        if (session.category === 'social') {
          const count = socialIndex % 2 === 0 ? 3 : 2;
          for (let index = 0; index < count; index++) {
            const post = samplePosts[(socialIndex * 2 + index + day) % samplePosts.length];
            events.push({
              id: `${id}-interaction-${index}`,
              ...post,
              kind: 'interaction',
              startedAt: cursor + Math.round(duration * (index + 1) / (count + 1)) * 1000,
              duration: 0,
              category: 'social',
              app: 'Google Chrome',
              domain: session.domain,
              url: session.url,
              ...(post.action === 'save' && { bookmarked: true }),
            });
          }
          socialIndex++;
        }
        cursor += duration * 1000;
      }
    }
  }
  return {
    events: events.sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id)),
    settings: {
      recording: false,
      captureSocial: false,
      retentionDays: 30,
      excludedDomains: ['mail.google.com', 'accounts.google.com', 'banking.vietcombank.com.vn'],
      excludedApps: ['1Password', 'Passwords'],
      focusGoalMinutes: 240,
    },
    collector: { platform: 'demo', extensionConnected: false },
  };
}
