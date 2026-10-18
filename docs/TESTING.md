# Kiểm thử và phạm vi xác minh

Cần phân biệt tính đúng của logic/giao diện với khả năng tích hợp thật trên macOS. Linux có thể chạy build, unit test và Playwright; nó không xác minh thanh menu AppKit, bộ đọc foreground hoặc Gatekeeper.

## Kiểm tra tự động

```bash
npm ci
npm test
npm run build
npm run build:preview
npx playwright install chromium
npm run test:e2e
```

Trên Linux, cài phụ thuộc trình duyệt bằng `npx playwright install --with-deps chromium` nếu môi trường cần. Playwright khởi động web server theo cấu hình dự án; không cần mở Electron để kiểm tra demo.

Để kiểm tra bản xem trước tự chứa, mở `dist-preview/index.html` trực tiếp từ ổ đĩa, thử điều hướng/tìm kiếm và xác nhận giao diện vẫn hiển thị khi mất mạng. Mở DevTools → Network sẽ không thấy yêu cầu tải font, CSS, JavaScript hoặc ảnh bên ngoài. Việc bấm mở website gốc là hành động riêng và vẫn cần mạng. Dấu trang/cài đặt demo chỉ được giữ qua lần tải lại nếu trình duyệt cho phép local storage đối với tệp cục bộ.

Các nhóm kiểm tra chính:

- **Thời gian và phân tích:** chống đếm trùng, ưu tiên page/app, chia theo giờ và nửa đêm, chuỗi focus, khoảng nghỉ, dữ liệu không hợp lệ.
- **Đầu vào:** URL/giao thức, lọc query/fragment (giữ riêng mã video YouTube hợp lệ), miền con loại trừ, token/origin, cấu trúc hoạt động và giới hạn thời lượng.
- **SQLite:** cùng ID cập nhật thay vì cộng trùng, dấu trang, lưu cài đặt, thời hạn lưu giữ và xóa dữ liệu.
- **Tiện ích:** quy tắc thời lượng, lọc tab, phân loại, xác thực/sanitization và giao tiếp service worker theo các test có trong `tests/`.
- **Giao diện:** các luồng chính của bản demo như điều hướng, lọc/tìm kiếm, cài đặt, đánh dấu, xuất và hộp xác nhận xóa.

Test mô phỏng không khẳng định adapter tương thích với mọi phiên bản website. Test HTTP có thể xác minh xác thực/validation nhưng không thay được kiểm tra trình duyệt foreground thật.

## Checklist trên Mac thật

Chạy bằng một tài khoản thử và dữ liệu không nhạy cảm. Ghi lại macOS, kiến trúc CPU, phiên bản trình duyệt và commit/build khi báo lỗi.

| Bước | Kết quả cần thấy |
| --- | --- |
| Mở ứng dụng với thư mục dữ liệu mới | Ghi nhận và tương tác đều tắt; không có lịch sử được tự tạo. |
| Bật ghi nhận, chuyển Finder → TextEdit trong khoảng một phút | Có tên ứng dụng và thời lượng gần đúng; không có nội dung cửa sổ hoặc văn bản nhập. |
| Đóng cửa sổ và mở lại từ thanh menu | Trạng thái/cài đặt còn đúng; ứng dụng không tạo hai tiến trình ghi nhận. |
| Ghép extension bằng token sai, sau đó token đúng | Token sai bị từ chối; token đúng hiển thị đã kết nối. |
| Duyệt trang A, mở B ở nền, rồi chuyển sang B | A được tính trước, B chỉ được tính khi chuyển sang; không cộng cả hai cùng lúc. |
| Để trình duyệt mở rồi chuyển sang TextEdit | Thời gian trang không tiếp tục cộng khi trình duyệt không ở phía trước. |
| Không dùng máy trên 60 giây, khóa màn hình và sleep/wake | Không có một phiên dài tính cả thời gian bỏ máy, khóa hoặc ngủ. |
| Mở tab ẩn danh, trang `chrome://`, URL có query/fragment | Tab ẩn danh/trang nội bộ bị bỏ; tham số/fragment bị loại, chỉ giữ mã video YouTube `v` hợp lệ để mở lại video. |
| Thêm miền vào loại trừ và dùng miền con | Các dữ liệu mới của miền/miền con bị chặn; dữ liệu cũ không tự biến mất. |
| Bật tương tác nhưng không cấp quyền site | Không có dữ liệu tương tác từ site đó. |
| Cấp X/Reddit, bấm một nút bài công khai | Có sự kiện bấm nếu adapter nhận diện; không có văn bản bình luận đã nhập. |
| Vào vùng tin nhắn riêng của site được cấp quyền | Không ghi nội dung tin nhắn hoặc tương tác trong luồng riêng. |
| Tắt ghi nhận trong ứng dụng trong khi trang vẫn mở | Không có sự kiện mới sau khi trạng thái tắt được áp dụng. |
| Bỏ ghép nối/gỡ extension | Dừng dữ liệu trang; bộ ghi nhận app vẫn hoạt động nếu bật. |
| Đánh dấu, đổi cài đặt, khởi động lại | Dữ liệu và cài đặt được giữ. |
| Xuất JSON và CSV | Tệp đọc được, chỉ có dữ liệu hiện có; không chứa token ghép nối. CSV mở đúng tiếng Việt và không thực thi ô có nội dung giống công thức. |
| Xóa một mục rồi xóa lịch sử | Mục bị xóa không bị heartbeat cũ khôi phục; xóa lịch sử giữ cài đặt. |
| Xung đột cổng 43821 | Ứng dụng báo lỗi kết nối rõ ràng và không giả vờ tiện ích đã kết nối. |

## Kiểm tra gói phân phối

Chạy `npm run dist:mac` trên Mac hoặc workflow macOS. Kiểm tra riêng gói arm64 và x64 trên kiến trúc phù hợp:

1. Mở `.dmg`, chép ứng dụng vào Applications và chạy từ đó.
2. Xác nhận helper được đóng gói, có quyền thực thi và đúng kiến trúc bằng `lipo -info`.
3. Xác nhận tất cả luồng cốt lõi trên bảng trên hoạt động ở bản đóng gói, không chỉ development.
4. Với bản đã ký, kiểm tra `codesign --verify --deep --strict`, `spctl --assess` và staple notarization theo [RELEASE.md](RELEASE.md).
5. Thử mở trên một Mac không có Node.js/Xcode. Bản `.app` đã đóng gói phải có Electron và helper sẵn; các công cụ build chỉ dành cho máy phát triển.

## Trạng thái xác minh của bản bàn giao

Mã nguồn được chuẩn bị trong môi trường Linux. Kết quả kiểm tra cụ thể được ghi trong [VERIFICATION.md](VERIFICATION.md); chỉ coi một lệnh là đã chạy nếu có kết quả được báo lại. Các bước tích hợp macOS, ký Developer ID và notarization **chưa được xác nhận bởi việc build/test trên Linux**.

Workflow được cung cấp để người nhận có thể lặp lại kiểm tra và tạo gói trên runner macOS. Việc có workflow trong repository không có nghĩa workflow đó đã chạy, có chữ ký Apple hoặc đã thử nghiệm trên phần cứng của người dùng.
