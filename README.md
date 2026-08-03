# SignLink AI - Hệ Thống Nhận Diện Ngôn Ngữ Ký Hiệu & Cử Chỉ Tay Thông Minh

Dự án nghiên cứu và phát triển hệ thống nhận diện ngôn ngữ ký hiệu và cử chỉ tay thời gian thực cho môn **Phát triển các hệ thống thông minh**. Hệ thống được xây dựng full-stack sử dụng **React + TypeScript + Vite** ở frontend và **Java (Spring Boot 3.3.0) + WebSocket** ở backend.

Điểm cốt lõi của dự án là **không sử dụng** bất kỳ thư viện Học máy có sẵn nào để phân loại cử chỉ (như TensorFlow, Keras hay Scikit-Learn). Thay vào đó, toàn bộ giải thuật tiền xử lý, trích xuất đặc trưng hình học (GFEE - 78 dimensions), phân loại lân cận (KNN), và học thích ứng trực tuyến (Online Template Adaptation & Active Feedback Loop) đều được **tự lập trình từ đầu**.

---

## 1. Điểm Nhấn Công Nghệ & Tiêu Chí "Thông Minh"

Để đạt tiêu chuẩn của một **Hệ thống thông minh** có khả năng tự tiến hóa và ngày càng thông minh hơn qua quá trình sử dụng, hệ thống tích hợp các cơ chế sau:

1. **Giải thuật Phân loại KNN Trọng số Khoảng cách Tự viết (Custom Distance-Weighted KNN)**:
   * Trích xuất vector đặc trưng $78$ chiều từ $21$ tọa độ khớp tay 3D của MediaPipe (sử dụng làm bộ định vị cơ bản).
   * Chuẩn hóa tọa độ để đạt tính chất **Bất biến dịch chuyển** (Translation Invariance) và **Bất biến tỷ lệ** (Scale Invariance) giúp tay ở bất kỳ vị trí hay khoảng cách nào so với camera đều nhận diện chính xác.
   * Tính toán khoảng cách Euclidean và biểu quyết theo trọng số khoảng cách: Mẫu càng giống thì trọng số bỏ phiếu càng cao.

2. **Cơ chế Tự hiệu chuẩn thích ứng trực tuyến (Online Template Adaptation)**:
   * Khi người dùng thực hiện một cử chỉ với độ tin cậy cực cao, hệ thống sẽ tự động cập nhật vector mẫu trong bộ nhớ để dịch chuyển nhẹ về phía tay của người dùng hiện tại (Moving Average).
   * Quá trình này giúp hệ thống tự điều chỉnh để tương thích hoàn hảo với kích thước tay và thói quen góc nghiêng của từng người dùng cụ thể theo thời gian.

3. **Vòng lặp Phản hồi Sửa lỗi trực tiếp (Active User Feedback Loop)**:
   * Khi hệ thống nhận diện sai hoặc không chắc chắn, người dùng có thể nhấn nút **Sửa cử chỉ** và nhập nhãn đúng.
   * Hệ thống sẽ ngay lập tức nạp vector lỗi làm mẫu huấn luyện mới, gửi về lưu trữ và tự sửa chữa lỗi nhận diện ngay lập tức.

4. **Giải thuật Phân cụm K-Means Tự viết trên Backend (Custom K-Means Clustering)**:
   * Khi số lượng mẫu huấn luyện do người dùng đóng góp tăng lên, hệ thống sẽ chạy thuật toán K-Means trên backend để gom các mẫu tương đồng thành $K$ cụm tối ưu (Centroids) cho từng cử chỉ.
   * Quá trình này giúp loại bỏ nhiễu (outliers), tối ưu hóa dung lượng lưu trữ của Database và giữ cho thuật toán KNN chạy ở tốc độ cực cao ($>30$ FPS) trên thiết bị yếu.

5. **Giải Thích Kết Quả XDE (Explainability Engine)**:
   * Hiển thị tỷ lệ phần trăm khớp chi tiết cho từng thành phần: Ngón tay (Finger Match), Lòng bàn tay (Palm Match), Chuyển động (Motion Match), Vị trí cơ thể (Body Match), Quỹ đạo (Trajectory Match).

---

## 2. Kiến Trúc Thư Mục

```text
PTIT_WEB_SMART_HAND/
├── frontend/                  # Ứng dụng client React + TypeScript + Vite
│   ├── src/
│   │   ├── components/        # Các thành phần giao diện (HandCamera, Trainer, LiveChatHub, BAE Analytics, v.v.)
│   │   ├── utils/             # Giải thuật trích xuất đặc trưng, KNN, drawing, và API client
│   │   ├── types.ts           # Định nghĩa kiểu dữ liệu TS
│   │   └── index.css          # Design system giao diện Glassmorphic Dark-Mode
│   └── index.html             # CDN & local MediaPipe Hands WASM
├── backend/                   # Ứng dụng server Java Spring Boot 3.3.0
│   ├── src/main/java/com/signlink/backend/
│   │   ├── controller/        # Rest API Endpoints (Gestures, Logs, Users, Health)
│   │   ├── engine/            # 9 Engine tính toán (FeatureEngine, LearningEngine, XDE, BAE, ContextEngine...)
│   │   ├── websocket/         # WebSocket Handler stream 30 FPS thời gian thực (/ws/gesture)
│   │   ├── model/             # MongoDB Data Models & Entities
│   │   └── service/           # Online Learning & K-Means Optimization Services
│   └── pom.xml                # Dependency Maven (Java 17/23, Spring Boot 3.3.0)
├── build-backend.ps1          # Kịch bản đóng gói backend tự động phát hiện JDK
├── run-backend.ps1            # Kịch bản khởi chạy backend JAR
└── README.md                  # Hướng dẫn dự án
```

---

## 3. Các Bước Cài Đặt & Chạy Hệ Thống

### Yêu cầu hệ thống:
* Đã cài đặt **Node.js** (Khuyên dùng v18 hoặc v20+).

---

### Bước 1: Khởi động Backend (Node.js Express)
Mở một terminal mới tại thư mục `support_human/backend`:

1. Cài đặt các gói thư viện phụ trợ:
   ```bash
   npm install
   ```
2. Khởi động server ở chế độ phát triển (Development mode):
   ```bash
   npm run dev
   ```
Server sẽ chạy tại địa chỉ: `http://localhost:5000`

---

### Bước 2: Khởi động Frontend (React + Vite)
Mở một terminal thứ hai tại thư mục `support_human/frontend`:

1. Cài đặt các gói thư viện phụ trợ:
   ```bash
   npm install
   ```
2. Khởi động ứng dụng client:
   ```bash
   npm run dev
   ```
Terminal sẽ hiển thị địa chỉ truy cập cục bộ (thường là `http://localhost:5173`). Hãy mở liên kết này trên trình duyệt Chrome hoặc Edge (có quyền truy cập camera).

---

## 4. Hướng Dẫn Sử Dụng Trong Buổi Bảo Vệ Đề Tài

Để trình diễn tối đa tính "thông minh" và các giải thuật tự viết cho thầy cô thấy:

1. **Bước 1: Huấn luyện cử chỉ cơ bản**
   * Nhập tên một cử chỉ vào ô nhập liệu ở cột bên phải, ví dụ: `LIKE` (đại diện cho ngón tay cái hướng lên).
   * Đưa tay trước camera thực hiện động tác tương ứng.
   * Chọn chế độ **Ghi Chuỗi 15 Khung Hình** và nhấn nút **Bắt đầu ghi**. Di chuyển nhẹ tay để hệ thống ghi nhận các góc độ khác nhau của cử chỉ đó.
   * Làm tương tự với cử chỉ `DISLIKE` (ngón cái hướng xuống) và `HELLO` (năm ngón tay xòe).

2. **Bước 2: Test khả năng nhận diện thời gian thực**
   * Đưa tay trước camera. Hệ thống sẽ trích xuất khớp tay màu xanh neon phát sáng và hiển thị chữ kèm phần trăm độ tin cậy (ví dụ: `LIKE - 98%`).

3. **Bước 3: Trình diễn khả năng Tự học thích ứng (Self-Calibration)**
   * Khi bạn giữ im cử chỉ khớp với độ tin cậy cao, hệ thống chạy thích ứng trực tuyến trong background để hiệu chỉnh mẫu. Nhìn vào console mạng, bạn sẽ thấy các API `PUT /api/templates/:id` được gọi tự động nhằm đồng bộ hóa vector khớp tay đã được điều chỉnh về database.

4. **Bước 4: Trình diễn khả năng Học từ lỗi sai (Feedback Correction Loop)**
   * Giả sử bạn làm cử chỉ `HELLO` nhưng hệ thống nhận diện nhầm thành `LIKE`. Nhấp ngay vào nút **Sửa cử chỉ** dưới thanh kết quả.
   * Nhập chữ `HELLO` vào ô nhãn đúng và gửi.
   * Hệ thống sẽ tự nạp vector lỗi này làm mẫu huấn luyện mới cho nhãn `HELLO`. Bạn sẽ thấy ngay lập tức hệ thống không còn bị nhầm lẫn nữa!

5. **Bước 5: Trình diễn Thuật toán K-Means trên Backend**
   * Sau khi nạp nhiều mẫu, nhấn vào nút **Tối ưu hóa K-Means** ở thẻ cấu hình hoặc thẻ huấn luyện.
   * Backend sẽ gom hàng trăm mẫu raw bạn vừa chụp thành 3 cụm trung tâm (centroids) đại diện nhất. Bạn sẽ thấy số lượng mẫu đại diện giảm đi nhưng độ chính xác vẫn giữ nguyên hoặc tăng lên nhờ lọc bỏ nhiễu.
