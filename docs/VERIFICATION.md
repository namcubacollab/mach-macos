# Kết quả xác minh bản bàn giao

Ngày tổng hợp: **18/10/2026** (Asia/Saigon). Môi trường chuẩn bị: **Linux x86_64**, **Node.js 24.19.0**, **npm 11.9.0**.

Bản bàn giao gồm mã nguồn ứng dụng macOS, tiện ích Chromium và bản HTML khám phá giao diện. Tệp HTML và ảnh chụp giao diện sử dụng dữ liệu minh họa được tạo tại chỗ; chúng không thể hiện lịch sử thật thu thập từ máy của người dùng.

## Kết quả thực thi

| Lệnh / luồng | Kết quả |
| --- | --- |
| `npm run build` | Đạt: TypeScript và Vite production build. |
| `npm run build:preview` | Đạt: giao diện gói trong một tệp HTML khoảng 372 KB. |
| `npm test` | **55/55** bài kiểm thử qua: phân tích, lưu trữ, xác thực, HTTP cục bộ, thời gian hoạt động và MV3 mô phỏng. |
| `npm run test:e2e` | **15/15** bài kiểm thử qua trong Chromium; không có console error hay uncaught exception trong các luồng kiểm tra. |
| Giao diện | Kiểm tra 6 màn hình ở 1440×1080 và 390×844; tìm kiếm, lọc, lưu/xóa, CSV/JSON, thiết lập, focus timer và xác nhận xóa. |
| Dữ liệu | Kiểm tra chống cộng trùng, cắt theo giờ/ngày/khoảng ngày, xuất hơn 20.000 bản ghi, xóa chống tái xuất hiện, tách phiên sau khi worker nghỉ. |

Bản preview được nạp từ HTTP cục bộ rồi ngắt mạng: điều hướng, thống kê và khôi phục mẫu hoạt động; không phát sinh yêu cầu tới máy chủ bên ngoài. Việc mở trực tiếp `file://` bị chính sách Chromium của môi trường này chặn nên chưa xác minh đường mở tệp đó ở đây.

Thử khởi chạy Electron Linux bằng nền headless không thành công (SIGSEGV/socket hang up trong môi trường không có desktop session); không coi đây là kiểm chứng Electron hoặc macOS. Hệ Chromium quản lý cũng không tải được unpacked extension worker trong headless, nên bộ kiểm thử extension là mô phỏng Chrome API và HTTP, không phải thử thật trên Mac.

## Kiểm tra cấu hình phân phối

| Kiểm tra | Kết quả |
| --- | --- |
| `bash -n scripts/install-macos.command` | Đạt: cú pháp shell hợp lệ. |
| Parse `.github/workflows/verify-and-build.yml` | Đạt: YAML hợp lệ, có các job kiểm tra, build unsigned và build ký theo lựa chọn. |
| Đối chiếu `package.json` và mục gốc của `package-lock.json` | Đạt: dependencies, devDependencies và yêu cầu Node.js khớp nhau; cài bằng `npm ci`. |
| Đường dẫn bằng chứng Playwright trong CI | Khớp `work/test-results/` của cấu hình dự án. |

## Chưa được xác minh trong môi trường này

- Biên dịch Swift/AppKit helper bằng Xcode, chạy bộ ghi nhận ứng dụng thật, idle/lock/sleep và thanh menu trên macOS.
- Ghép nối trình duyệt và thu thập tương tác trên các website thật từ Mac; kiểm thử mô phỏng không chứng minh khả năng tương thích với mọi giao diện X/Reddit.
- Tạo và chạy `.dmg`/`.app` trên Apple Silicon/Intel; mở bản đóng gói trên Mac không có công cụ phát triển.
- Chữ ký Developer ID, notarization, Gatekeeper và việc chạy workflow trong một repository GitHub thật.

Chưa có bản cài đặt Mac đã ký trong bàn giao này. Workflow là cấu hình để người nhận chạy tiếp; không phải bằng chứng rằng gói macOS đã được build hoặc Apple đã chấp nhận. Các bước kiểm tra còn lại được mô tả ở [TESTING.md](TESTING.md) và [RELEASE.md](RELEASE.md).
