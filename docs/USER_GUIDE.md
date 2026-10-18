# Dùng Mạch mỗi ngày

Mạch giúp trả lời hai câu hỏi: “Thời gian của mình đã đi đâu?” và “Trang/bài viết đáng nhớ đó ở đâu?”. Thống kê xuất phát từ thời gian ứng dụng hoặc tab ở phía trước, không phải tổng thời gian cửa sổ vẫn đang mở.

## Từ lần đầu đến một ngày có dữ liệu

1. Chạy ứng dụng trên Mac, vào **Cài đặt & quyền riêng tư** và bật **Ghi nhận hoạt động**.
2. Kết nối tiện ích nếu muốn lưu tên trang và URL. Chỉ bật tương tác xã hội khi bạn cần và đã đọc phạm vi của nó.
3. Dùng máy bình thường. Ghi nhận tạm ngừng khi bạn tắt công tắc, khóa màn hình, máy ngủ hoặc không có hoạt động người dùng từ 60 giây.
4. Cuối buổi, xem tổng quan và dòng thời gian. Đánh dấu các mục muốn quay lại; dùng tìm kiếm để tìm tên trang, ứng dụng hoặc tên miền.
5. Điều chỉnh danh sách loại trừ nếu có một phần công việc/cuộc sống bạn muốn giữ ngoài nhật ký.

Nếu đang xem **bản khám phá**, mọi dữ liệu và thay đổi chỉ thuộc bản demo trong trình duyệt. Phần kết nối không tạo token giả. Muốn có dữ liệu thật, chạy ứng dụng desktop.

## Tìm lại và tập trung

Nhấn **⌘K** (hoặc Ctrl+K trong bản web) để tìm trên tất cả các ngày đang lưu. Tìm kiếm hỗ trợ từ khóa tiếng Việt không dấu. Dòng thời gian có tìm kiếm riêng cho ngày đã chọn; mục **Đã lưu** hiển thị dấu trang của mọi ngày, không bị giới hạn bởi ngày trên thanh công cụ.

Nhấn một hoạt động để mở chi tiết, xem URL/thời điểm/thời lượng, lưu lại hoặc xóa mục đó. Một liên kết chỉ có thời lượng 0 vẫn có thể hữu ích để tìm lại, nhưng không làm tăng số giờ hoạt động.

Bộ đếm **Bắt đầu tập trung** có các lựa chọn 25, 45 hoặc 60 phút. Nó nhắc khi hết giờ trong ứng dụng và không chặn website/phần mềm. Bộ đếm này độc lập với thống kê “thời gian tập trung”: thống kê vẫn dựa vào các hoạt động được thu thập, không tự cộng 25 phút chỉ vì bạn bật timer. Cần giữ ứng dụng chạy để nhận nhắc hết giờ; đây chưa phải thông báo hệ thống hoặc chế độ Focus của macOS.

## Đọc số liệu đúng nghĩa

| Chỉ số | Cách tính |
| --- | --- |
| Tổng thời gian hoạt động | Hợp của các khoảng thời gian foreground; khoảng trùng nhau chỉ được tính một lần. Sự kiện tương tác không cộng thời lượng. |
| Thời gian tập trung | Tổng thời gian thuộc nhóm **Công việc** và **Học hỏi**. |
| Tỷ lệ tập trung | Thời gian tập trung / tổng thời gian hoạt động × 100, làm tròn. Đây là tỷ trọng phân loại, không phải điểm đánh giá năng suất. |
| Mạng xã hội | Thời gian các trang/ứng dụng được xếp nhóm **Mạng xã hội**, không phải số lần bấm tương tác. |
| Phiên tập trung dài nhất | Chuỗi Công việc/Học hỏi liên tục; khoảng hở thực tế ngắt phiên (dung sai kỹ thuật tối đa 1 giây). |
| Chuyển ngữ cảnh | Đổi nguồn ứng dụng/tên miền giữa hai đoạn sử dụng kế tiếp, nếu khoảng nghỉ không quá 5 phút. Nghỉ dài hơn bắt đầu một phiên khác. |
| Lượt ghé trang | Số bản ghi phiên trang, kể cả phiên rất ngắn có thời lượng 0. Không phải số URL duy nhất hoặc toàn bộ lịch sử tải trang của trình duyệt. |
| Tên miền | Tên miền xuất hiện trong bản ghi trang; một miền chỉ có sự kiện tương tác không làm tăng số miền đã ghé. |

Khi trang trình duyệt chồng lấn với một bản ghi ứng dụng, đoạn trang được ưu tiên. Trong cùng loại, bản ghi bắt đầu muộn hơn được ưu tiên. Quy tắc này bảo đảm hai nguồn không tự nhân đôi số giờ của bạn.

Nhóm **Công việc**, **Học hỏi**, **Mạng xã hội**, **Cá nhân** được gán bằng quy tắc tên miền/tên ứng dụng. Ví dụ YouTube có thể được xếp Học hỏi nhưng video cụ thể có thể phục vụ mục đích khác. Không nên coi đây là suy luận chính xác về nội dung, sự chú ý hoặc chất lượng công việc.

Ngày và giờ dùng múi giờ hiện tại của máy. Một hoạt động qua nửa đêm được chia thời lượng vào đúng ngày; biểu đồ theo giờ chia phần tương ứng vào từng giờ. Khung 7 ngày gồm ngày được chọn và 6 ngày trước đó. Khi đổi múi giờ, cách nhóm cùng một timestamp có thể thay đổi.

## Tab nào được lưu

Mạch ghi tab active trong cửa sổ trình duyệt đang có focus khi người dùng còn active; phía desktop còn kiểm tra trình duyệt có ở phía trước không. Mở mười tab không đồng nghĩa mười bộ đếm cùng chạy.

URL chỉ nhận giao thức `http` và `https`. Trang nội bộ như `chrome://`, tệp `file://`, tab ẩn danh, URL có tên người dùng/mật khẩu và miền bị loại trừ không được lưu. Query (`?…`) và fragment (`#…`) bị bỏ, trừ mã video `v` hợp lệ của liên kết YouTube `/watch` để mở lại đúng video. Các tham số khác vẫn bị loại; khi mở lại liên kết, trạng thái bộ lọc, playlist hoặc vị trí phát/neo có thể không khôi phục.

Nguồn tab hỗ trợ Chrome bản ổn định, Edge và Brave, với một trình duyệt/profile ghép nối tại một thời điểm. Khi chưa có tiện ích tương thích, Mạch biết bạn đang dùng trình duyệt như một ứng dụng nhưng không biết URL. Không có chức năng nhập ngược toàn bộ lịch sử duyệt web trước khi cài đặt. Các thời điểm đổi tab, mất kết nối hoặc tắt đột ngột có thể có sai số nhỏ do chu kỳ lấy mẫu.

## Tương tác mạng xã hội

Phiên bản đầu có adapter cho **X/Twitter và Reddit**. Các website khác vẫn có thể xuất hiện dưới dạng phiên trang và thời lượng; chưa có nhận diện từng bài/tương tác trên Facebook, Instagram, TikTok hoặc LinkedIn.

Để bật, vào cài đặt Mạch bật **Tương tác trên mạng xã hội**, sau đó mở popup extension, bật lựa chọn tương tác và cấp quyền riêng cho X hoặc Reddit. Tải lại trang đã mở khi cần. Bạn có thể thu hồi quyền website hoặc tắt lựa chọn bất cứ lúc nào.

Adapter theo dõi các nút được nhận diện như thích/upvote, bình luận/reply, lưu/bookmark và chia sẻ/repost. Nó cố gắng gắn sự kiện với permalink của bài. Hành vi được lưu là **lần bấm nút**, có thể là mở ô bình luận, mở hộp chia sẻ hoặc hủy một lượt thích. Nó không đọc nội dung bạn nhập và không xác nhận thao tác đã được máy chủ chấp nhận.

Giao diện website thay đổi liên tục. Tùy ngôn ngữ, thử nghiệm A/B hoặc cấu trúc bài, nhận diện có thể thiếu. Bản này không tự động “biết mọi bài đã xem” trong feed nếu bạn chỉ cuộn qua; phiên trang vẫn ghi nhận website bạn đang dùng.

## Giữ và xóa dữ liệu

- **Đánh dấu:** giúp tìm lại mục trong nhật ký, không ngăn chính sách hết hạn xóa mục đó.
- **Loại trừ tên miền:** áp dụng cả miền đó và các miền con. Ví dụ `example.com` bao gồm `mail.example.com`. Nhập `mail.example.com` chỉ chặn nhánh đó.
- **Loại trừ ứng dụng:** dùng đúng tên hiển thị của ứng dụng (không phân biệt hoa/thường) hoặc bundle ID nếu bạn biết. Danh sách không phải cú pháp wildcard.
- **Lưu lịch sử:** giao diện cho chọn 7, 30 hoặc 90 ngày. Rút ngắn thời gian lưu có thể xóa ngay bản ghi cũ; xuất dữ liệu trước nếu cần giữ bản sao.
- **Xuất JSON/CSV:** tải những bản ghi hiện có ở mọi ngày vào một tệp, độc lập với bộ lọc đang xem. JSON giữ cấu trúc dữ liệu; CSV mở bằng Numbers, Excel hoặc Sheets. Tệp xuất có thể chứa URL và tiêu đề nhạy cảm; lưu/chia sẻ như một tài liệu cá nhân.
- **Xóa lịch sử:** có hộp xác nhận; xóa cả mục đã đánh dấu nhưng giữ cài đặt. Không thể hoàn tác trong ứng dụng.

Mạch chưa có đồng bộ, phục hồi từ tệp JSON hoặc kho lưu giữ vô hạn. Xem [PRIVACY.md](PRIVACY.md) để biết vị trí database và giới hạn xóa bản sao lưu.
