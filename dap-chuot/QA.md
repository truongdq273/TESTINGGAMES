# Kiểm tra bản frontend

Đã chạy Edge headless bằng Playwright, HTTP local. Câu hỏi dùng khi kiểm thử là fixture kỹ thuật riêng, không đưa vào bộ học chính thức.

Đã kiểm tra:

- Một giáo viên và bốn học sinh, hai học sinh trùng tên vẫn có điểm/danh tính riêng.
- Chặn bắt đầu khi chưa có học sinh, chạy được với một học sinh và với bốn học sinh.
- Đúng +10, sai +0, bấm kép không cộng hai lần, búa chỉ mở sau đáp án đúng.
- Reload giáo viên/học sinh giữ phòng và tiến độ. Giáo viên vắng thì khóa thao tác, khôi phục giáo viên thì tiếp tục.
- Điểm và kết quả tới các tab, nhiều người bằng điểm cùng hạng, kết thúc sớm tới toàn bộ học sinh.
- Phòng thứ hai tách roster, mã phòng sai báo lỗi và không tạo phòng.
- Sửa nguồn local giữa vòng vẫn chấm theo snapshot cũ; vòng mới đọc đáp án mới. Nguồn rỗng chặn bắt đầu.
- Trang chủ nội dung soạn/lưu được câu hỏi. Schema sai phiên bản, ID trùng, đáp án không khớp và danh sách rỗng bị từ chối.
- Payload học sinh trước khi nộp không chứa correctOptionId hoặc correctText.
- CSV xuất kết quả, giữ tên Unicode/trùng tên và bảo vệ tên bắt đầu bằng công thức.
- Giao diện desktop và mobile 390px không tràn ngang. Đập chuột bằng bàn phím hoạt động. Reduced motion vẫn cho hoàn thành lượt.
- SFX tạo oscillator sau thao tác, tắt tiếng ngăn tạo âm, trạng thái mute còn sau reload. Chưa nghe đánh giá âm sắc trực tiếp trên loa.
- SDK giữ nguyên hash so với bản bundled; không có lỗi JavaScript trong các luồng đã chạy.

Chưa kiểm tra trên thiết bị thật, chưa triển khai dịch vụ phân quyền, chưa triển khai multiplayer Internet. Bản này không có timeout học sinh theo luật đã chọn. Đã tích hợp bộ 8 câu người dùng cung cấp qua Google Docs, giữ nguyên đáp án đánh dấu.


## Kiểm tra bổ sung với bộ Google Docs thật

- Đọc thành công nguồn Google Docs người dùng cung cấp, đối chiếu đủ 8 câu và đáp án với content.json: B, B, C, B, A, A, A, B.
- Chạy 1 giáo viên + 4 học sinh qua cả 8 câu; điểm 80/70/80/80 đúng với các lựa chọn kiểm thử. Ba học sinh 80 điểm cùng hạng 1.
- Giả lập nguồn lỗi HTTP 502: hiển thị bản dự phòng 8 câu, khóa Bắt đầu, chỉ cho dùng bản cũ khi người dùng chọn rõ ràng.
- Parser từ chối thiếu dấu đáp án, nhiều dấu đáp án trong một câu, trùng số câu và dòng không đúng định dạng.
- Không sửa nội dung hoặc quyền chia sẻ của Google Docs. Việc đổi nội dung giữa vòng/vòng mới đã kiểm tra bằng nguồn local trong lượt trước; lần này xác minh thêm đường đọc tài liệu Google thật.
- Gói game khoảng 123 KB, dưới giới hạn 5 MB; không có lỗi JavaScript trong bài kiểm tra tích hợp.
