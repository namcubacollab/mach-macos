#!/bin/bash
# Run from Terminal or open this file in Finder. This script never installs global tools.
set -euo pipefail

function explain_error() {
  local status=$?
  printf '\nMạch chưa hoàn tất. Xem lỗi ở phía trên; hướng dẫn: docs/INSTALL.md\n' >&2
  if [[ -t 0 && -z "${CI:-}" ]]; then
    read -r -p 'Nhấn Return để đóng… ' _answer || true
  fi
  exit "$status"
}
trap explain_error ERR

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [[ "$(uname -s)" != Darwin ]]; then
  printf 'Trình này dành cho macOS 12 trở lên. Trên hệ khác, dùng npm ci và npm run dev để xem demo.\n' >&2
  exit 1
fi
if [[ ! -f package.json || ! -f package-lock.json || ! -f desktop/main.cjs ]]; then
  printf 'Không tìm thấy đủ mã nguồn. Hãy giải nén toàn bộ thư mục Mạch rồi mở lại tệp này.\n' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Cần Node.js 22.13+ (khuyến nghị Node.js 24 LTS) từ https://nodejs.org. Cài rồi mở lại Terminal.\n' >&2
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'; then
  printf 'Node.js hiện tại quá cũ: %s. Cần phiên bản 22.13 trở lên.\n' "$(node -v)" >&2
  exit 1
fi
if ! xcrun --find swiftc >/dev/null 2>&1; then
  printf 'Cần Xcode Command Line Tools để biên dịch bộ ghi nhận native.\nChạy xcode-select --install, hoàn tất cài đặt rồi chạy lại tệp này.\n' >&2
  exit 1
fi
if ! node -e 'process.exit(Number(require("node:child_process").execFileSync("sw_vers", ["-productVersion"], {encoding:"utf8"}).split(".")[0]) >= 12 ? 0 : 1)'; then
  printf 'Mạch cần macOS 12 Monterey trở lên.\n' >&2
  exit 1
fi

MODE="${1:-run}"
case "$MODE" in
  run|build|check) ;;
  *) printf 'Cách dùng: bash scripts/install-macos.command [run|build|check]\n' >&2; exit 2 ;;
esac

printf '\nMạch · macOS %s · %s · Node %s\n' "$(sw_vers -productVersion)" "$(uname -m)" "$(node -v)"
printf 'Đang cài đúng các phiên bản trong package-lock.json…\n'
npm ci

case "$MODE" in
  run)
    printf '\nĐang biên dịch và mở Mạch. Ghi nhận mặc định đang tắt.\n'
    npm run desktop
    ;;
  build)
    printf '\nĐang tạo gói cài đặt trong release/. Đây là bản unsigned nếu bạn chưa cấu hình chứng chỉ.\n'
    npm run dist:mac
    ;;
  check)
    npm test
    npm run build
    node desktop/build-helper.cjs
    printf '\nKiểm tra mã nguồn và biên dịch đã hoàn tất. Xem docs/TESTING.md để kiểm tra trên máy thật.\n'
    ;;
esac
