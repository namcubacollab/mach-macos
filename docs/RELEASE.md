# Đóng gói và phát hành macOS

Mã nguồn này có cấu hình tạo `.dmg` và `.zip` cho Apple Silicon (`arm64`) và Intel (`x64`). Việc đóng gói native cần macOS và Xcode Command Line Tools. Một lần build Linux hoặc bản xem trước web không tạo ra ứng dụng Mac đã được kiểm chứng.

## Tạo bản tự dùng, chưa ký

Trên Mac đã có Node.js 22.13+ và Xcode Command Line Tools:

```bash
npm ci
npm test
npm run dist:mac
```

Lệnh `dist:mac` xây giao diện, biên dịch helper universal bằng Swift rồi dùng electron-builder. Kết quả nằm trong `release/`. Bản `.app` đóng gói đã chứa Electron; máy người nhận không cần cài Node.js hoặc Xcode để chạy ứng dụng.

Để buộc một bản kiểm thử không tự lấy chứng chỉ có sẵn trong Keychain:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

Bản này không được xem là đã ký Developer ID hoặc đã notarize. Chạy nó từ Applications trên Mac thử nghiệm và hoàn tất [checklist macOS](TESTING.md). Nếu Gatekeeper chặn bản chính bạn build, chỉ mở bằng lựa chọn riêng của ứng dụng trong Privacy & Security sau khi kiểm tra nguồn; không tắt bảo vệ toàn hệ thống.

Tiện ích trình duyệt được phân phối riêng dưới thư mục `extension/`. Để tạo ZIP kèm bản cài đặt:

```bash
ditto -c -k --keepParent extension release/Mach-browser-extension.zip
shasum -a 256 release/*.dmg release/*.zip > release/SHA256SUMS.txt
```

Người nhận giải nén ZIP tiện ích rồi dùng **Load unpacked**, theo [INSTALL.md](INSTALL.md). Chưa có bản xuất bản lên Chrome Web Store hoặc Safari App Store.

## CI có sẵn

Workflow [verify-and-build.yml](../.github/workflows/verify-and-build.yml) chạy khi push vào `main`/`master`, tạo pull request hoặc chọn **Run workflow**:

1. Runner Linux kiểm tra logic, TypeScript/Vite và giao diện bằng Playwright. Nó bỏ tải binary Electron vì không chạy desktop trên Linux.
2. Runner macOS cài dependency, tạo gói cho cả hai kiến trúc và kiểm tra helper universal được kèm trong app.
3. Artifact **Mach-macOS-UNSIGNED** chứa DMG/ZIP, ZIP tiện ích và checksum SHA-256. Artifact không phải GitHub Release và không tự xuất bản cho người dùng.

Workflow chưa được chạy chỉ vì có mặt trong mã nguồn. Bạn cần đưa dự án vào repository GitHub, bật Actions và xem log thực tế. Artifact mặc định giữ 14 ngày.

## Ký Developer ID và notarize

Phân phối ổn định cho người khác cần tài khoản Apple Developer của người phát hành, chứng chỉ **Developer ID Application**, private key đi kèm và quyền notarization. Không thể tạo chữ ký thật bằng tên người phát hành giả hoặc chỉ thêm cấu hình.

Tạo các **repository secrets** trong GitHub → Settings → Secrets and variables → Actions:

| Secret | Giá trị |
| --- | --- |
| `CSC_LINK` | Nội dung base64 của chứng chỉ/private key `.p12` dùng ký Developer ID Application |
| `CSC_KEY_PASSWORD` | Mật khẩu của tệp `.p12` |
| `APPLE_ID` | Tài khoản Apple được quyền notarize |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mật khẩu dành riêng cho ứng dụng, tạo trong tài khoản Apple |
| `APPLE_TEAM_ID` | Team ID của tài khoản Developer |

Chỉ thêm secret qua giao diện quản lý bí mật của repository. Không commit `.p12`, mật khẩu, token hoặc tệp môi trường chứa khóa. Private key nên giới hạn quyền truy cập và được thu hồi khi không còn cần. Dùng mật khẩu `.p12` không rỗng vì workflow yêu cầu đủ cả năm secret.

Chọn **Actions → Verify and build Mạch → Run workflow**, bật `sign_and_notarize`. Job ký chỉ chạy khi bạn chủ động chọn tùy chọn này; pull request không sử dụng secret ký. Nó yêu cầu `forceCodeSigning=true`, bật notarization của electron-builder và dừng nếu thiếu secret hoặc kiểm tra chữ ký thất bại.

Kết quả chỉ được gắn nhãn **Mach-macOS-SIGNED** sau khi các lệnh sau thành công với app và helper:

```bash
codesign --verify --deep --strict --verbose=2 release/mac-arm64/Mach.app
codesign --verify --strict --verbose=2 release/mac-arm64/Mach.app/Contents/Resources/helpers/mach-foreground
spctl --assess --type execute --verbose=2 release/mac-arm64/Mach.app
xcrun stapler validate release/mac-arm64/Mach.app
```

App Intel nằm trong `release/mac/Mach.app` theo bố cục mặc định của electron-builder. Workflow kiểm tra cả hai bằng glob.

Apple có thể từ chối notarization vì chứng chỉ, điều khoản tài khoản, entitlement hoặc quy tắc nền tảng. Đọc lỗi trong log và sửa cấu hình; không đổi tên artifact unsigned thành signed để bỏ qua bước đó. Bản signed/notarized cũng cần thử chức năng trên Mac thật: chữ ký xác nhận nguồn và khả năng kiểm tra của Gatekeeper, không xác nhận chất lượng thu thập dữ liệu.

## Trước khi phát hành rộng

- Chốt tên, bundle ID, phiên bản và quyền thương hiệu của người phát hành trong `package.json`.
- Chạy checklist với cả Apple Silicon và Intel hoặc thu hẹp phạm vi kiến trúc đã xác minh.
- Kiểm tra khởi động từ Applications, helper, menu bar, dữ liệu sau nâng cấp, ghép nối và thu hồi token.
- Đóng gói kèm hướng dẫn quyền riêng tư và hướng dẫn tiện ích; không tự bật thu thập sau cài đặt.
- Phân phối qua kênh bạn kiểm soát và kèm checksum. Phiên bản này chưa có cơ chế tự cập nhật.
