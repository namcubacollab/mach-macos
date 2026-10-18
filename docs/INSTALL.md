# Cài đặt Mạch

## Xem thử trước khi cài

Tệp `Mach-preview.html` trong bản bàn giao mở trực tiếp bằng trình duyệt, không cần Node.js hay kết nối mạng để hiển thị giao diện. Đây là bản demo có dữ liệu minh họa; nó không theo dõi ứng dụng, tab hoặc tương tác thật. Nếu chỉ có mã nguồn, chạy `npm ci` rồi `npm run build:preview` để tạo tệp tương đương tại `dist-preview/index.html`.

## 1. Chuẩn bị

- Mac dùng Apple Silicon hoặc Intel, chạy macOS 12 Monterey trở lên.
- Node.js 22.13+; Node.js 24 LTS là lựa chọn khuyến nghị. Kiểm tra bằng `node -v` và `npm -v`.
- Xcode Command Line Tools để biên dịch helper đọc tên ứng dụng. Kiểm tra bằng `xcrun --find swiftc`; nếu chưa có, chạy `xcode-select --install` rồi hoàn tất cửa sổ cài đặt của Apple.
- Kết nối mạng trong lúc `npm ci` tải dependency và Electron. Việc ghi nhận/đọc thống kê sau đó không cần dịch vụ đám mây.

Giải nén **toàn bộ** thư mục mã nguồn vào vị trí bạn quản lý. Trong Terminal, dùng `cd` tới thư mục có `package.json`.

```bash
npm ci
npm run desktop
```

Lệnh thứ hai biên dịch giao diện và helper native rồi mở Electron. Cách tương đương có kiểm tra điều kiện trước khi chạy:

```bash
bash scripts/install-macos.command
```

Trình hướng dẫn không cài Node.js hoặc công cụ toàn hệ thống. Nếu cần sửa điều kiện, đọc thông báo, cài công cụ rồi chạy lại. Nếu Finder không cho mở tệp `.command`, dùng lệnh Terminal ở trên.

## 2. Bật ghi nhận trên máy

Khi mở lần đầu, ghi nhận ứng dụng và ghi nhận tương tác mạng xã hội đều tắt. Bật ghi nhận trong Mạch khi bạn sẵn sàng.

Bộ ghi nhận native đọc danh tính ứng dụng ở phía trước bằng `NSWorkspace`. Nó không đọc nội dung cửa sổ, bàn phím hay màn hình. Bản này không cần quyền Accessibility, Screen Recording hoặc Automation cho việc đọc danh tính ứng dụng. Đừng cấp các quyền đó nếu một hướng dẫn khác yêu cầu nhưng chức năng hiện tại không cần.

Giữ ứng dụng Mạch chạy khi muốn ghi nhận. Kiểm tra biểu tượng ở thanh menu và trạng thái ghi nhận trong giao diện. Thoát ứng dụng sẽ dừng thu thập; đóng cửa sổ có thể chỉ ẩn giao diện để ứng dụng tiếp tục ở thanh menu.

## 3. Kết nối trình duyệt

Tiện ích dùng Manifest V3, cần Chrome 120+ hoặc phiên bản Chromium tương ứng. Hỗ trợ Chrome bản ổn định, Edge và Brave. Safari, Firefox, Arc và Chrome Canary chưa được hỗ trợ cho nguồn dữ liệu tab trong phiên bản này; danh tính ứng dụng vẫn có thể được ghi ở cấp macOS.

1. Mở `chrome://extensions` (hoặc `edge://extensions`, `brave://extensions`).
2. Bật **Developer mode / Chế độ dành cho nhà phát triển**.
3. Chọn **Load unpacked / Tải tiện ích đã giải nén**, trỏ tới thư mục `extension/` trong mã nguồn.
4. Trong phần kết nối của Mạch, lấy mã ghép nối. Đây là khóa truy cập dữ liệu cục bộ; không gửi cho người khác hoặc chụp vào ảnh công khai.
5. Mở popup của tiện ích, nhập mã và kết nối. Mạch cần đang chạy; dịch vụ ghép nối chỉ nghe tại `127.0.0.1:43821`.
6. Bật ghi nhận trong Mạch. Mở một trang bình thường, đặt cửa sổ trình duyệt ở phía trước, sử dụng một lúc rồi kiểm tra dòng thời gian.

Tiện ích có thể yêu cầu quyền đọc tab và quyền truy cập máy chủ cục bộ để truyền URL. Quyền đọc nội dung mạng xã hội được cấp riêng khi bật tính năng tương tác. Xem thông báo quyền trước khi chấp nhận. Tiện ích khai báo không cho chạy ở chế độ ẩn danh; bộ thu thập cũng chủ động bỏ qua tab ẩn danh.

Để có dữ liệu tương tác, cần bật **Tương tác trên mạng xã hội** trong ứng dụng, bật công tắc tương ứng trong popup tiện ích và cấp quyền riêng cho **X/Twitter** hoặc **Reddit**. Việc chỉ ghép nối không tự động bật tính năng này. Xem [tài liệu tiện ích](../extension/README.md) để biết phạm vi adapter.

Mỗi token gắn với origin của extension và danh tính trình duyệt đầu tiên ghép nối thành công. Bản này ghép một trình duyệt/profile tại một thời điểm. Nếu chuyển sang bản tiện ích có ID khác hoặc cần thu hồi kết nối, mở menu Mạch ở thanh trạng thái → **Ngắt ghép nối tiện ích…**, xác nhận rồi lấy mã mới trong Cài đặt. Lịch sử không bị xóa. Tùy chọn **Hủy ghép nối** trong popup chỉ xóa token ở profile trình duyệt đó.

## 4. Tạo ứng dụng để mở từ Applications

Trên macOS, sau `npm ci`:

```bash
npm run dist:mac
```

Hoặc `bash scripts/install-macos.command build`. Gói Apple Silicon (`arm64`) và Intel (`x64`) nằm trong `release/`. Chọn đúng kiến trúc; kiểm tra máy tại Apple menu → About This Mac.

Bản tự đóng gói chưa ký có thể bị Gatekeeper chặn. Nếu đây là mã nguồn bạn đã kiểm tra và chính bạn biên dịch, vào **System Settings → Privacy & Security → Open Anyway** khi hệ điều hành cung cấp lựa chọn đó. Không tắt Gatekeeper toàn hệ thống. Để phân phối cho người khác, ký Developer ID và notarize theo [RELEASE.md](RELEASE.md).

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
| --- | --- |
| Chỉ thấy dữ liệu demo | Bạn đang mở Vite trong trình duyệt. Chạy `npm run desktop` trên Mac để dùng bộ thu thập thật. |
| Không ghi nhận ứng dụng | Trạng thái ghi nhận đã bật; Mạch chưa bị thoát; máy không đang khóa/ngủ/nhàn rỗi trên 60 giây. Thử đổi sang ứng dụng khác trong vài giây. |
| Tiện ích chưa kết nối | Mạch đang chạy; token đúng; không có phiên Mạch khác chiếm cổng 43821. Mở lại popup và thử kết nối. |
| Có tên Chrome nhưng không có URL | Bộ ghi nhận ứng dụng hoạt động; tiện ích chưa ghép nối, chưa được cấp quyền hoặc đang mất kết nối. |
| Không thấy tương tác xã hội | Cần bật riêng tính năng, cấp quyền tên miền và dùng website được hỗ trợ. Cấu trúc nút thay đổi, ngôn ngữ hoặc phiên bản giao diện có thể khiến bộ nhận diện bỏ sót. |
| `xcrun` báo không tìm thấy compiler | Cài Command Line Tools; nếu đã cài nhiều bản Xcode, kiểm tra `xcode-select -p` trỏ tới bản hợp lệ. |
| Node báo không có `node:sqlite` | Nâng Node lên ít nhất 22.13. Electron sử dụng Node đi kèm; Node ngoài máy dùng cho test và build tooling. |
| Thời lượng nhỏ hơn thời gian mở tab | Mạch chỉ tính thời gian tab đang được dùng ở cửa sổ có focus; tab nền, lúc idle, màn hình khóa hoặc máy ngủ bị loại. |

Sau khi sửa mã tiện ích, bấm **Reload** ở trang quản lý extension và tải lại các trang xã hội đang mở. Khi sửa mã desktop, khởi động lại ứng dụng để nạp phần main/preload.
