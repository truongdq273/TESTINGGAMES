# Đập chuột MCQ — Khu vườn tinh anh

Frontend lớp học dành cho 1 giáo viên và tối đa 4 học sinh, dựa trên hình chuột, búa và hang trong PowerPoint được cung cấp.

## Bộ câu hỏi đã tích hợp

Đã nhập đủ 8 câu MCQ chủ đề House & Rooms từ [Google Docs của chủ nội dung](https://docs.google.com/document/d/17PWP2to6pRQjXNXLPh8nEitZeHh2T3GPxqJCHW7qwS4/edit). Giữ nguyên câu hỏi, lựa chọn và đáp án ✅: **B, B, C, B, A, A, A, B**. Tổng điểm tối đa 80.

Các câu về số phòng, nhà lớn/nhỏ, sở thích và người sống cùng chấm theo đáp án mẫu trong tài liệu, không đại diện cho mọi học sinh. Mục tiêu: luyện từ vựng và mẫu câu tiếng Anh về nhà cửa, phòng ở và đồ dùng. Giữ thiết kế tiểu học 6–11 tuổi của game; chưa chỉ định khối lớp cụ thể.

`content.json` là bản dự phòng đã tải từ tài liệu. Mặc định game đọc lại Google Docs khi tạo phòng và ngay trước vòng mới. Không sửa nội dung trong một vòng đang chơi.

## Luật chơi

1. Mỗi học sinh có một sân chơi và tiến độ riêng. Một chú chuột xuất hiện cùng câu hỏi MCQ có 2–4 lựa chọn, một đáp án đúng.
2. Mỗi câu được chọn một lần. Không giới hạn thời gian, không thưởng tốc độ.
3. Chọn đúng được +10 điểm và mở một lượt đập chuột. Bấm/chạm chú chuột hoặc dùng bàn phím Tab rồi Enter/Space để đập. Điểm học thuật đã được ghi khi trả lời đúng, không phụ thuộc tốc độ thao tác búa.
4. Chọn sai được +0 điểm. Chuột chui xuống, hiện đáp án đúng. Không trừ điểm, không loại học sinh.
5. Sau phản hồi, học sinh bấm sang câu tiếp theo. Học sinh làm xong chờ cả lớp. Giáo viên có thể kết thúc sớm; câu chưa trả lời được thống kê riêng.
6. Cả lớp xếp hạng theo tổng điểm. Bằng điểm cùng hạng, không dùng tốc độ phá hòa.

## Chạy trên máy

Mở terminal trong thư mục game, chạy bằng Python 3:

```powershell
python serve.py
```

Mở `http://127.0.0.1:8765/index.html`. Không mở game bằng `file://`.

- Bộ Google Docs đã được cấu hình sẵn, có thể mở lớp ngay. Chủ nội dung sửa câu hỏi/đáp án trực tiếp trong tài liệu Google Docs rồi lưu. Nếu cần đổi sang tài liệu khác, mở `http://127.0.0.1:8765/admin.html`, chọn Google Docs / URL JSON và lưu link mới. Không cần sửa mã game.
- Giáo viên mở `teacher.html`; trang tạo mã phòng và tự tải bộ câu hỏi đã được cấp. Giáo viên chỉ xem nội dung, tải lại, điều khiển phòng và xuất CSV.
- Mở thêm bốn tab `student.html`, nhập cùng mã và tên riêng hoặc trùng tên. Mỗi tab giữ playerId riêng.
- Chọn Bắt đầu trên tab giáo viên. Có thể chạy với 1–4 học sinh. Giữ tab giáo viên mở để chấm điểm.
- Reload giữ phòng, vòng chơi và điểm. Khi giáo viên tạm mất kết nối, học sinh tạm dừng gửi đáp án.

**Bản này mô phỏng trên các tab cùng trình duyệt, cùng máy và cùng origin. Bốn học sinh ở các nhà khác nhau chỉ chơi được sau khi IT tích hợp máy chủ.**

## Nguồn câu hỏi và link chỉnh sửa

Link chỉnh sửa của chủ nội dung: https://docs.google.com/document/d/17PWP2to6pRQjXNXLPh8nEitZeHh2T3GPxqJCHW7qwS4/edit

Endpoint dữ liệu local: `/api/google-doc?documentId=17PWP2to6pRQjXNXLPh8nEitZeHh2T3GPxqJCHW7qwS4`. `serve.py` đọc bản văn bản Google Docs, chuẩn hóa thành JSON cho controller giáo viên. Đây là cầu nối đọc nguồn phục vụ demo local, chưa phải máy chủ multiplayer hay hệ thống phân quyền. Không sửa tài liệu Google Docs hoặc đổi quyền chia sẻ.

Trong tài liệu, giữ dạng một dòng câu hỏi `1. ...`, tiếp theo 2–4 dòng lựa chọn `a. ...`, `b. ...`, `c. ...`, `d. ...`; đánh dấu đúng **một** đáp án bằng ✅. Giữ số thứ tự mỗi câu ổn định vì nó tạo ID câu. Nguồn sai định dạng báo lỗi cụ thể, không bỏ qua câu lỗi.

Mỗi lần tạo phòng và ngay trước khi bắt đầu vòng, hệ thống tải lại nguồn. Sửa Google Docs trong lúc đang chơi chỉ áp dụng vòng mới; tốc độ xuất bản/cache của Google có thể ảnh hưởng thời điểm nhìn thấy thay đổi. `admin.html` vẫn có trình soạn local và nhập JSON để chọn nguồn khác khi cần; lưu ở trình soạn local sẽ chuyển sang bộ trên máy này.

Nếu mất mạng hoặc Google Docs không đọc được, bản dự phòng có thời điểm tải vẫn hiển thị. Giáo viên phải chủ động bấm **Dùng bản đã tải ở trên** để chơi offline; không âm thầm thay thế nguồn. Với nguồn riêng tư cần đăng nhập, IT phải nối API Google bằng danh tính máy chủ có quyền đọc, không đưa token xuống trình duyệt.

Nguồn lỗi không xóa bản tốt đã tải. Giáo viên phải chọn rõ ràng dùng bản cũ có phiên bản/thời điểm hiển thị nếu muốn tiếp tục. Không tự dùng bản cũ.

Schema: `schemaVersion: 1`, `title`, `questions[]`. Mỗi câu có `id` duy nhất, `type: single-choice`, `prompt`, 2–4 `options` dạng `{id,text}`, `correctOptionId` khớp lựa chọn và `points: 10`. Màn quản trị có thể xuất JSON đúng định dạng. Giới hạn 100 câu, 600 ký tự/câu, 240 ký tự/lựa chọn. Chưa hỗ trợ media trong MCQ ở phiên bản này.

## Bàn giao IT

1. Thay transport cùng máy bằng kết nối máy chủ theo API `join(roomCode, {playerId,name})`, `send(event)`, `onEvent(handler) → unsubscribe`, `leave()`. Envelope có eventId, roomCode, roundId, senderId và recipientId khi riêng tư; không thay schema SDK.
2. Chuyển chấm điểm, danh tính, phân quyền, dedupe và snapshot sang máy chủ. Xác thực giáo viên/học sinh và lưu tiến độ bền vững. Demo tĩnh chưa bảo mật trước DevTools hoặc truy cập trực tiếp dữ liệu local.
3. Kết nối nguồn dữ liệu một lần: server giữ cấu hình URL/fileId, quyền đọc, validation, hash phiên bản và snapshot theo vòng. Chủ nội dung sửa/lưu tại nguồn để vòng mới nhận câu mới mà không sửa code hoặc deploy lại. Chặn URL nội bộ/metadata và redirect không hợp lệ khi server đọc URL.
4. Chỉ chủ nội dung được sửa câu hỏi/đáp án/nguồn qua trang có xác thực. Giáo viên chỉ điều khiển lớp. Server không gửi đáp án trước khi nộp tới học sinh, không tin score/isCorrect/delta từ client. Cấu hình local trong demo chỉ mô phỏng vai trò, không phải cơ chế phân quyền thật.
5. `sdk.js` giữ nguyên bản bundled. `game.js` là iframe; `app.js` là host adapter có kiểm tra origin/source. Game gửi attempt qua adapter riêng, nhận kết quả từ authority rồi mới phát submitAnswer/updateScore để thông báo. Chạy kiểm thử mạng thật, reconnect, quyền và nguồn thực tế sau tích hợp.

## Âm thanh và đồ họa

Hình chuột, búa và hang lấy từ PPTX người dùng cung cấp. Bố cục sân vườn dựng bằng CSS. SFX tổng hợp bằng Web Audio: chuột xuất hiện, chọn đáp án, đúng, sai, đập trúng và hoàn thành. Âm thanh khởi động sau thao tác người dùng; nút tắt tiếng lưu lựa chọn. Không tải font, thư viện hay media từ CDN. Giao diện hỗ trợ reduced motion.

Các file chạy chính: `index.html`, `teacher.html`, `student.html`, `admin.html`, `preview.html`, `game.html`, `styles.css`, `app.js`, `game.js`, `sdk.js`, `transport.js`, `room-controller.js`, `content-loader.js`, `content.json`, `audio.js`, `serve.py`, `assets/`.
