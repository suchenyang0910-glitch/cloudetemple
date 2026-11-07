export const FAMILY_CONSENT_VERSION = "pilot-2026-11-07-v2";
export const FAMILY_CONSENT_REVIEW = Object.freeze({ nativeLanguage: "approved", legal: "公开上线前需律师确认" });

// Kept separate so native-language and legal review do not require application changes.
export const FAMILY_CONSENT_COPY = Object.freeze({
  title: "Bản đồng ý sử dụng thử nghiệm — Chùa Mây Bài vị gia đình",
  review: "v2 · 2026-11-07",
  vi: [
    "Đây là bản thử nghiệm chưa công khai, chỉ dành cho nhóm thân hữu được mời trực tiếp.",
    "1. Chúng tôi lưu danh xưng và họ tên của bạn; họ tên, năm sinh, năm mất và ngày giỗ của người thân; cùng địa chỉ email của bạn.",
    "2. Dữ liệu được dùng để gửi nhắc ngày giỗ qua email hoặc tệp lịch (ICS), và tạo lịch gia đình PDF theo yêu cầu. Chúng tôi chỉ chia sẻ dữ liệu cần thiết với các nhà cung cấp dịch vụ máy chủ, gửi email và đăng nhập (Cloudflare, Resend, Google). Chúng tôi không bán dữ liệu và không dùng cho quảng cáo.",
    "3. Dữ liệu được lưu trên máy chủ đặt ngoài lãnh thổ Việt Nam. Theo Luật Bảo vệ Dữ liệu Cá nhân 91/2025/QH15, bạn có quyền biết và đồng ý với việc dữ liệu được chuyển ra ngoài Việt Nam.",
    "4. Bạn có thể xuất hoặc xóa tài khoản và toàn bộ dữ liệu bất kỳ lúc nào. Liên hệ: leishen8806@gmail.com.",
    "5. Dữ liệu thử nghiệm sẽ được giữ lại khi sản phẩm ra mắt. Nếu không muốn, bạn có thể yêu cầu xóa trước thời điểm đó.",
  ],
  zh: [
    "这是尚未公开的测试版本，仅限直接受邀的亲友使用。",
    "1. 我们保存您的称呼、姓名和邮箱，以及先人的姓名、生卒年和忌日。",
    "2. 数据仅用于邮件或 ICS 忌日提醒，以及按需生成家族台历 PDF。只与提供服务器、邮件和登录服务的服务商共享必要数据，不出售、不用于广告。",
    "3. 数据存储在越南境外的服务器上。依据越南个人数据保护法 91/2025/QH15，您有权知悉并同意数据出境。",
    "4. 您可随时导出或删除账号及全部数据。联系：leishen8806@gmail.com。",
    "5. 测试资料将在产品正式上线后保留；如不希望保留，可在上线前申请删除。",
  ],
  agree: "Tôi đã đọc và đồng ý với các điểm trên.",
  continue: "Đồng ý và tiếp tục",
  cancel: "Quay lại",
});
