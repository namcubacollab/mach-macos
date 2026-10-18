# Mạch

**Một nhật ký số riêng tư cho macOS: hôm nay bạn đã đi qua đâu, dành thời gian cho điều gì, và điều gì đáng quay lại.**

Mạch kết hợp ứng dụng ở thanh menu với một tiện ích trình duyệt. Ứng dụng ghi nhận phần mềm đang ở phía trước; tiện ích bổ sung trang web đang được sử dụng và những lần bấm tương tác trên mạng xã hội khi bạn bật riêng tính năng đó. Dữ liệu được lưu trên máy, sau đó tổng hợp thành dòng thời gian và thống kê.

Đây là bộ mã nguồn có thể chạy và đóng gói. Bản xem trước trên trình duyệt sử dụng dữ liệu mẫu; việc ghi nhận thật cần chạy ứng dụng trên macOS và kết nối tiện ích. Gói cài đặt có chữ ký Apple chưa được cung cấp.

## Khám phá ngay, không cần cài đặt

Mở tệp **Mach-preview.html** đi kèm bản bàn giao bằng Chrome, Edge hoặc Safari để thử giao diện, tìm kiếm, bộ lọc, đánh dấu và thống kê từ dữ liệu mẫu. Tệp chứa sẵn mã giao diện, biểu tượng và kiểu chữ hệ thống; không cần web server hay tải tài nguyên mạng. Chỉ thao tác mở lại một liên kết mới đưa bạn tới website bên ngoài.

Bản khám phá **không ghi nhận hoạt động trên máy**. Dữ liệu mẫu được tạo tại chỗ; các trạng thái demo lưu riêng trong trình duyệt khi trình duyệt cho phép. Muốn ghi nhận thật, làm theo bước cài trên Mac bên dưới.

## Bắt đầu trên Mac

Cần **macOS 12 trở lên**, **Node.js 22.13+** (khuyến nghị Node.js 24 LTS) và **Xcode Command Line Tools**. Nếu thiếu bộ công cụ Apple, chạy `xcode-select --install` và chờ cài xong.

Mở Terminal trong thư mục mã nguồn:

```bash
npm ci
npm run desktop
```

Hoặc chạy trình hướng dẫn có kiểm tra điều kiện:

```bash
bash scripts/install-macos.command
```

Ghi nhận mặc định **tắt**. Mở phần cài đặt trong Mạch để chủ động bật. Để có URL và hoạt động trên tab, tải tiện ích trong thư mục `extension/`, ghép nối với ứng dụng và cấp quyền cần dùng. Hướng dẫn đầy đủ: [Cài đặt và ghép nối](docs/INSTALL.md).

## Bạn nhận được gì

- Dòng thời gian ứng dụng và trang web, tìm kiếm lại nội dung đã ghé, đánh dấu mục muốn giữ và mở lại liên kết.
- Thống kê thời lượng theo ứng dụng, tên miền, nhóm hoạt động và từng khung giờ; mục tiêu tập trung có thể điều chỉnh.
- Ghi nhận tương tác mạng xã hội theo lựa chọn của bạn, với giới hạn được trình bày rõ trong [hướng dẫn sử dụng](docs/USER_GUIDE.md).
- Tìm nhanh bằng ⌘K, bộ đếm tập trung 25/45/60 phút và thư viện những dấu vết đã lưu.
- Tạm dừng ghi nhận, loại trừ ứng dụng/tên miền, đặt thời gian lưu giữ, xóa lịch sử và xuất JSON/CSV.
- Mọi phân tích trong bản này chạy trên thiết bị. Không cần tài khoản, máy chủ phân tích hay API AI.

Mạch chỉ biết những gì các bộ ghi nhận có thể quan sát. Một lần bấm “Thích” là **lần bấm đã quan sát**, chưa xác nhận hành động thành công trên máy chủ. Các tab nền, chế độ ẩn danh, nội dung nhập, tin nhắn và ảnh chụp màn hình không được thu thập.

## Chạy và phát triển

```bash
npm run dev          # Giao diện demo trên trình duyệt; không theo dõi máy tính
npm run desktop:dev  # Electron + cập nhật giao diện khi sửa mã, trên macOS
npm test             # Kiểm thử logic và biên bảo mật
npm run build        # Kiểm tra TypeScript và tạo giao diện production
npm run build:preview # Tạo dist-preview/index.html: một tệp HTML tự chứa để mở trực tiếp
npm run test:e2e     # Kiểm thử giao diện bằng Playwright
npm run dist:mac     # Tạo .dmg/.zip cho Apple Silicon và Intel trên macOS
```

Trước lần chạy Playwright đầu tiên: `npx playwright install chromium`. Trên Linux CI cần thêm các thư viện hệ thống (`npx playwright install --with-deps chromium`). Lệnh đóng gói tạo kết quả trong `release/`; xem [đóng gói và ký](docs/RELEASE.md) trước khi phân phối.

## Tài liệu

| Nội dung | Tài liệu |
| --- | --- |
| Cài trên Mac, kết nối Chrome/Edge/Brave, xử lý sự cố | [INSTALL.md](docs/INSTALL.md) |
| Cách đọc thời lượng, tương tác, bộ lọc và giới hạn | [USER_GUIDE.md](docs/USER_GUIDE.md) |
| Dữ liệu nào được ghi, lưu ở đâu, xóa như thế nào | [PRIVACY.md](docs/PRIVACY.md) |
| Luồng dữ liệu, ranh giới bảo mật và cấu trúc mã | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Kiểm thử tự động và checklist trên macOS thật | [TESTING.md](docs/TESTING.md) |
| Kết quả kiểm tra cụ thể của bản bàn giao | [VERIFICATION.md](docs/VERIFICATION.md) |
| Gói unsigned, ký Developer ID và notarization | [RELEASE.md](docs/RELEASE.md) |

## Phạm vi của phiên bản này

Ứng dụng hướng tới việc nhìn lại **hoạt động của chính bạn trên máy của bạn**. Đây không phải công cụ giám sát người khác. Chưa có đồng bộ nhiều máy, nhận diện ngữ nghĩa bằng mô hình AI, bộ chuyển đổi Safari/Firefox hay bảo đảm tương thích với mọi thay đổi giao diện mạng xã hội.

Mã và giao diện có thể được kiểm thử trong môi trường Linux; các quyền hệ điều hành, thanh menu, bộ ghi nhận native, Gatekeeper và gói `.dmg` cần kiểm chứng trên macOS thật. [TESTING.md](docs/TESTING.md) phân biệt rõ hai lớp kiểm tra này.
