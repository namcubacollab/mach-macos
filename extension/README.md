# Mạch — extension đồng hành

Extension Manifest V3 cho Chrome 120+, Edge và Brave bản ổn định trên macOS. Kết nối trực tiếp tới ứng dụng Mạch tại `http://127.0.0.1:43821`; không có máy chủ bên ngoài, tài khoản hoặc thư viện tải từ mạng. Extension xác định trình duyệt qua client hints/Brave API và gửi `X-Mach-Browser`; desktop đối chiếu đúng bundle ID của ứng dụng đang ở phía trước. Không xác định được thì dừng kết nối. Arc, Chromium không thương hiệu, Chrome Canary và các trình duyệt khác chưa được hỗ trợ.

## Cài đặt và ghép nối

1. Mở ứng dụng desktop Mạch trên Mac. Vào **Cài đặt**, sao chép mã ghép nối.
2. Chrome: mở `chrome://extensions`; Edge: `edge://extensions`; Brave: `brave://extensions`. Bật **Developer mode / Chế độ dành cho nhà phát triển**.
3. Chọn **Load unpacked / Tải tiện ích đã giải nén**, rồi chọn thư mục `extension` chứa `manifest.json` này.
4. Ghim Mạch trên thanh công cụ. Mở popup, dán mã và bấm **Ghép nối với Mạch**. Chấp thuận quyền đọc tên/địa chỉ tab nếu muốn ghi hoạt động duyệt web.
5. Trong ứng dụng Mạch, bật ghi hoạt động. Popup hiện **Đang ghi hoạt động** và huy hiệu `ON`. Khi ứng dụng tạm dừng, popup hiện trạng thái tương ứng; khi không kết nối được, huy hiệu `!` và lý do được hiển thị.

Mã ghép nối lưu trong `chrome.storage.local` của profile trình duyệt này. Không chia sẻ mã. Hủy ghép nối trong popup để xóa mã và tắt ghi tương tác; quyền website đã cấp có thể thu hồi ở trang quản lý extension. Không đồng bộ mã qua Chrome Sync.

## Cách tính thời gian

- Chỉ tab đang chọn trong cửa sổ trình duyệt đang có focus; bỏ qua tab nền, cửa sổ ẩn danh, trang nội bộ và trang đang tải.
- `chrome.idle` dừng thời gian sau 60 giây không hoạt động; 60 giây đầu là ngưỡng phát hiện của trình duyệt. Desktop còn kiểm tra ứng dụng ở phía trước và trạng thái hoạt động của macOS.
- Snapshot cộng dồn cùng UUID, gửi khoảng 15 giây một lần và tại các thay đổi tab/focus/idle. Desktop kiểm chứng thời gian, không cộng trùng snapshot. Việc phân loại tên miền là quy tắc đơn giản, không phải AI suy đoán nội dung.
- MV3 có thể tạm ngừng service worker; alarm 30 giây đánh thức lại. Khi worker khởi động lại hoặc hai quan sát cách nhau hơn 20 giây, Mạch mở một đoạn hoạt động với UUID mới; không cộng khoảng gián đoạn và không dồn thời gian mới vào khung giờ cũ. Chỉ các heartbeat liên tục dùng chung UUID. Vì vậy kết quả có thể thấp hơn thời gian thực.
- Lỗi kết nối hoặc ứng dụng tạm dừng sẽ xóa phiên tạm; không có hàng đợi hoạt động để gửi bù. Độ trễ nhận thay đổi cài đặt tối đa khoảng một heartbeat trong hoạt động thông thường; desktop từ chối sự kiện ngay khi đã tạm dừng.
- Khi không được cấp quyền đọc tab, extension ngừng heartbeat; desktop có thể trở về đếm thời gian ứng dụng trình duyệt theo tên ứng dụng.

## Tương tác mạng xã hội: bật riêng, theo từng website

Mặc định tắt. Cần đồng thời:

1. Bật ghi và **Ghi tương tác mạng xã hội** trong Mạch desktop.
2. Bật **Tương tác mạng xã hội** trong popup extension.
3. Bấm **Bật** tại X/Twitter hoặc Reddit và chấp thuận quyền của đúng website đó.

X: nhận lượt bấm nút thích, trả lời, đăng lại và lưu trên bài viết. Reddit: hỗ trợ chọn lọc giao diện `shreddit-post` và `old.reddit.com`, dựa trên nút có nhãn/mã nhận diện rõ ràng. Bản dịch/giao diện mới, menu, shadow DOM và thử nghiệm A/B có thể không được nhận diện. Không có hỗ trợ chi tiết Facebook, Instagram, LinkedIn hoặc Safari ở bản này; tab công khai vẫn có thể được tính như trang web thông thường.

Mỗi sự kiện là **quan sát một lượt bấm**, không xác nhận máy chủ đã thực hiện lượt thích, gửi bình luận, lưu hoặc chia sẻ. Không đọc nội dung người dùng nhập, không theo dõi phím, không chụp ảnh và không đọc tin nhắn. Chỉ lấy URL bài viết chuẩn hóa và trích đoạn công khai tối đa 240 ký tự (Reddit chỉ tiêu đề bài viết). Không ghi lượt bỏ thích/hủy lưu trên X; một số nút Reddit đổi trạng thái vẫn có thể được ghi nhận như lượt bấm.

## Giới hạn dữ liệu

Tham số query và fragment bị loại bỏ trước khi lưu/gửi, với một ngoại lệ để mở lại đúng video: `/watch` trên `youtube.com`, `www.youtube.com` hoặc `m.youtube.com` chỉ giữ duy nhất `v` nếu đó là ID video gồm đúng 11 ký tự chữ, số, `_` hoặc `-`. ID thiếu, không hợp lệ hoặc trùng tham số sẽ bị bỏ; playlist, thời điểm xem, tìm kiếm và mã theo dõi luôn bị bỏ. Bỏ qua URL có thông tin đăng nhập, IP/mạng nội bộ và các đường dẫn nhạy cảm phổ biến như `messages`, `inbox`, `chat`, `login`, `account`, `settings`, `checkout`. Các dịch vụ thư/tin nhắn phổ biến được chặn theo tên miền. Danh sách loại trừ của desktop áp dụng trước khi gửi.

Bộ lọc theo URL không thể nhận diện mọi trang riêng tư của mọi website. **Tên trang có thể chứa thông tin cá nhân**: thêm tên miền nhạy cảm vào danh sách loại trừ hoặc tạm dừng ghi trước khi truy cập. Extension không đọc toàn bộ lịch sử trình duyệt, không liệt kê các tab đã mở trước khi ghép nối và không chạy script trên các website ngoài danh sách được cấp quyền.

## Kiểm tra trên Mac

1. Bật ghi, mở hai tab công khai; chọn một tab 30 giây rồi chuyển tab. Kiểm tra chỉ tab được chọn tăng thời gian và một UUID không tạo nhiều hàng.
2. Chuyển sang ứng dụng khác, khóa máy, thử cửa sổ ẩn danh: thời gian tab không tiếp tục tăng.
3. Tắt ghi, thu hồi quyền website, thêm tên miền loại trừ hoặc đóng desktop: không xuất hiện sự kiện tương tác mới; popup hiển thị trạng thái tương ứng.
4. Tắt service worker trong DevTools rồi mở lại; thời gian ngủ không được cộng bù và không có hàng đợi cũ.
5. Với tương tác đã bật, thử một lượt thích trên X và một lượt upvote Reddit. Sự kiện có liên kết bài viết, ghi rõ ý nghĩa là lượt bấm; không chứa nội dung nhập hay tham số URL.

Kiểm thử tự động các hàm thuần: chạy `node --test tests/extension.test.mjs` từ thư mục gốc dự án. API và quyền trình duyệt cần được kiểm thử thủ công trên macOS trước khi phát hành.

Kết nối yêu cầu token, `X-Mach-Browser` và `X-Mach-Extension-Origin`. Header định danh hỗ trợ trường hợp Chromium không gửi Origin ở yêu cầu GET có quyền host; không thay thế token. Nếu có Origin thật, nó phải khớp extension; các Origin web bị từ chối.
