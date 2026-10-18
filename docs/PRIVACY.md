# Dữ liệu và quyền riêng tư

Mạch được thiết kế để bạn tự nhìn lại hoạt động của mình. Ghi nhận mặc định tắt; tương tác mạng xã hội mặc định tắt riêng. Bạn có thể tạm dừng hoặc xóa dữ liệu trong ứng dụng.

## Dữ liệu được ghi

| Nguồn | Nội dung có thể lưu | Điều kiện |
| --- | --- | --- |
| Ứng dụng macOS | Tên ứng dụng, thời điểm, thời lượng sử dụng, nhóm hoạt động | Mạch đang chạy và bạn bật ghi nhận |
| Tab trình duyệt | Tiêu đề trang, URL đã lọc tham số, tên miền, trình duyệt, thời điểm, thời lượng | Tiện ích đã ghép nối, tab thường ở cửa sổ đang có focus, trình duyệt ở phía trước |
| Tương tác mạng xã hội | Loại hành động đã quan sát, liên kết/nội dung mô tả ngắn của bài nếu bộ nhận diện tìm được, thời điểm | Bạn bật tính năng và cấp quyền website tương ứng |
| Cài đặt | Trạng thái ghi nhận, danh sách loại trừ, mục tiêu, thời gian lưu giữ | Bạn cập nhật trong ứng dụng |
| Ghép nối | Token ngẫu nhiên, origin extension và bundle ID trình duyệt ghép nối | Khi khởi tạo ứng dụng/kết nối tiện ích |

Mạch không thu thập phím gõ, giá trị biểu mẫu, mật khẩu, ảnh chụp màn hình, âm thanh, clipboard hoặc nội dung tin nhắn. Nó không yêu cầu quyền Accessibility hay Screen Recording. Tab ẩn danh bị bỏ qua. Tiện ích không lấy toàn bộ lịch sử trình duyệt có sẵn từ trước khi cài đặt.

Query và fragment của URL được bỏ, với một ngoại lệ: đường dẫn `/watch` trên YouTube giữ riêng tham số `v` khi đó là mã video hợp lệ gồm đúng 11 ký tự chữ, số, `_` hoặc `-`. Nhờ vậy liên kết có thể mở lại đúng video; các tham số theo dõi, playlist, thời điểm phát và tham số khác vẫn bị bỏ.

**URL và tiêu đề vẫn có thể chứa thông tin nhạy cảm.** Ví dụ đường dẫn `/documents/hop-dong-khach-hang` còn nguyên dù `?token=...` được loại bỏ. Loại trừ tên miền công việc nhạy cảm, cổng ngân hàng hoặc ứng dụng bạn không muốn lưu. Đừng coi việc lọc tham số là cơ chế ẩn danh hóa hoàn toàn.

## Dữ liệu được lưu ở đâu

Ứng dụng desktop lưu `activity.sqlite` trong thư mục `app.getPath('userData')`. Trên macOS, vị trí thường là:

```text
~/Library/Application Support/<tên ứng dụng>/activity.sqlite
~/Library/Application Support/<tên ứng dụng>/pairing.json
```

Ứng dụng đặt tên là `Mạch`, nên đường dẫn thường là `~/Library/Application Support/Mạch/`; một bản phát triển hoặc cấu hình Electron khác có thể chọn tên thư mục khác. Có thể tìm `activity.sqlite` trong `~/Library/Application Support/` nếu cần sao lưu thủ công. SQLite có thể tạo thêm các tệp `-wal` và `-shm`; hãy thoát Mạch trước khi sao chép cả thư mục.

Database **không được mã hóa ở tầng ứng dụng**. Quyền tệp giới hạn truy cập thông thường; FileVault giúp bảo vệ ổ đĩa khi máy bị mất. Phần mềm chạy dưới cùng tài khoản macOS vẫn có thể tiếp cận dữ liệu hoặc token nếu có quyền đọc tệp. Phiên bản này chưa sử dụng Keychain hoặc một khóa mã hóa riêng.

Tiện ích lưu token ghép nối trong vùng lưu trữ cục bộ của extension, không dùng Chrome Sync. Menu thanh trạng thái **Ngắt ghép nối tiện ích…** tạo token mới và vô hiệu hóa token cũ. Không đưa token vào kho Git, ảnh chụp, báo lỗi công khai hoặc dữ liệu chia sẻ. Bản xem trước web lưu trạng thái demo riêng trong trình duyệt và không được nối với database desktop.

## Dữ liệu có ra khỏi máy không

Không có analytics bên thứ ba, tài khoản đám mây, tải lên server hoặc lời gọi mô hình AI trong chức năng ghi nhận/phân tích của phiên bản này. Tiện ích gửi dữ liệu tới `http://127.0.0.1:43821`, chỉ trong máy của bạn, bằng token Bearer.

Việc tải dependency khi cài đặt và mở lại liên kết vẫn dùng mạng như bình thường. Nhấn một liên kết trong Mạch mở website gốc, và website đó áp dụng chính sách riêng. Tệp xuất dữ liệu là bản sao nằm ở vị trí bạn chọn; ứng dụng không kiểm soát việc đồng bộ thư mục đó qua iCloud/Dropbox hoặc phần mềm sao lưu.

## Tạm dừng, loại trừ và xóa

- **Tạm dừng** ngăn dữ liệu mới được ghi. Lịch sử đang có được giữ lại.
- **Loại trừ** ứng dụng/tên miền giúp chặn dữ liệu mới thuộc phạm vi đó. Để loại bỏ dữ liệu đã có, xóa mục tương ứng hoặc xóa toàn bộ lịch sử.
- **Thời gian lưu giữ** mặc định 30 ngày. Dữ liệu quá hạn được dọn khi khởi động, đọc trạng thái, đổi cài đặt và trong tác vụ dọn mỗi giờ; dấu sao không miễn trừ thời hạn lưu giữ.
- **Xóa lịch sử** xóa các bản ghi khỏi database hiện tại. Nó không thu hồi các tệp bạn từng xuất hoặc bản sao lưu của hệ điều hành. SQLite và ổ SSD cũng không cung cấp cam kết xóa vật lý từng byte.
- **Gỡ tiện ích** dừng nguồn dữ liệu trình duyệt. **Thoát Mạch** dừng nguồn dữ liệu desktop. Gỡ ứng dụng không nhất thiết tự xóa thư mục Application Support; có thể xóa thư mục dữ liệu sau khi thoát ứng dụng nếu muốn gỡ hoàn toàn.

## Giới hạn bảo mật

API chỉ nghe trên loopback, kiểm tra token, nguồn extension đã ghép, danh tính trình duyệt, kích thước JSON và cấu trúc dữ liệu. Đây là các lớp phòng vệ cho tiện ích cục bộ, không phải biên cách ly khỏi mọi phần mềm độc hại đang chạy bằng chính tài khoản của bạn.

Social adapter nhận diện nút và bài viết trong cấu trúc trang hiện tại. Nó có thể bỏ sót hoặc gán nhầm khi website thay đổi. Không dùng các sự kiện này để xác nhận một người đã bình luận, đã gửi chia sẻ hay đã thích thành công. Trong bản này, chúng chỉ phản ánh thao tác bấm quan sát được trên thiết bị đã bật ghi nhận.
