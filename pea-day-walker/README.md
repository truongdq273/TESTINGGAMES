# Pea đi dây làm xiếc

Game MCQ mô phỏng lớp học gồm một giáo viên và tối đa bốn học sinh trên các tab cùng trình duyệt, cùng máy, cùng origin.

## Chạy local

Tại thư mục này chạy `python -m http.server 8080`, sau đó mở `http://localhost:8080/`.

1. Mở một tab giáo viên và tạo phòng.
2. Mở tối đa bốn tab học sinh, nhập cùng mã phòng và tên.
3. Giáo viên bấm **Bắt đầu**. Đúng được 10 điểm và Pea đi bóng tiến lên dây. Sai được 0 điểm, Pea ngã xuống đệm rồi trở lại.
4. Giáo viên có thể kết thúc sớm, xem bảng xếp hạng và tải CSV.

## Câu hỏi

`content.json` chứa 10 câu Space & Astronomy lấy từ Google Docs do chủ nội dung cung cấp. Có thể sửa câu và đáp án theo schema v1 mà không đổi logic game. Màn giáo viên chỉ tải lại nguồn đã được cấp, không đổi URL hay sửa đáp án.

Khi IT nối nguồn thật, cấu hình một URL JSON HTTPS ổn định do chủ nội dung quản lý. Nguồn phải cho phép CORS trong demo, hoặc IT tạo adapter/proxy. Mỗi vòng cần khóa một snapshot `contentVersion`; thay đổi giữa vòng chỉ áp dụng vòng sau.

## Bàn giao IT

- Thay `transport.js` bằng WebSocket/API server nhưng giữ API `join`, `send`, `onEvent`, `leave`.
- Chuyển authority chấm điểm và snapshot từ tab giáo viên lên server; không tin `isCorrect`, `score` hoặc `delta` từ client.
- Xác thực vai trò, membership, `playerId`, `roundId`; giữ answer key ngoài public assets và chỉ gửi kết quả riêng cho người nộp.
- Duy trì dedupe bằng `eventId`, snapshot có `revision`, reconnect/resume và khóa mỗi `(roomCode, roundId, playerId, questionId)`.
- `sdk.js` là bản giao thức chuẩn, không chỉnh schema. `postMessage` chỉ nối iframe và host trong một tab.

Lưu ý: bản static không bảo mật đáp án trước DevTools hoặc truy cập file trực tiếp. Bốn học sinh ở các nhà khác nhau chỉ chơi được sau khi IT tích hợp máy chủ.
