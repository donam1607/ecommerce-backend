const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Product, Order } = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Danh sách Serial bảo hành mẫu
const MOCK_WARRANTIES = {
  'ABC1': {
    productName: 'Laptop Asus ROG Strix G15 (Like New)',
    customerName: 'Nguyễn Văn A',
    purchaseDate: '2025-10-15',
    warrantyPeriodMonths: 24,
    expirationDate: '2027-10-15',
    status: 'Còn bảo hành (Đang hoạt động)'
  },
  'XYZ2': {
    productName: 'Card đồ họa ASUS TUF RTX 3060 (Old)',
    customerName: 'Trần Thị B',
    purchaseDate: '2024-03-20',
    warrantyPeriodMonths: 12,
    expirationDate: '2025-03-20',
    status: 'Hết bảo hành'
  },
  'TECH3': {
    productName: 'Bàn phím cơ Keychron K2 (New)',
    customerName: 'Lê Hoàng C',
    purchaseDate: '2026-01-10',
    warrantyPeriodMonths: 12,
    expirationDate: '2027-01-10',
    status: 'Còn bảo hành (Đang hoạt động)'
  }
};

// ---------------------------------------------------------
// EXECUTORS (HÀM THỰC THI CHO TOOLS)
// ---------------------------------------------------------

// 1. Tìm kiếm sản phẩm trong database
async function executeSearchProducts(args) {
  const { category, maxPrice, condition, keyword } = args;
  console.log('🤖 Tool searchProducts triggered:', args);
  
  const where = {};
  
  // Lọc theo danh mục
  if (category && category.toLowerCase() !== 'all') {
    where.category = { [Op.iLike]: `%${category}%` };
  }
  
  // Lọc theo tình trạng (badge)
  if (condition && condition.toLowerCase() !== 'all') {
    const cond = condition.toLowerCase().trim();
    if (cond === 'new') {
      where.badge = { [Op.iLike]: '%new%' };
    } else if (cond === 'like new' || cond === 'likenew') {
      where.badge = {
        [Op.or]: [
          { [Op.iLike]: '%like%' },
          { [Op.iLike]: '%99%' },
          { [Op.iLike]: '%98%' },
          { [Op.iLike]: '%95%' }
        ]
      };
    } else if (cond === 'old') {
      where.badge = {
        [Op.or]: [
          { [Op.iLike]: '%old%' },
          { [Op.iLike]: '%cũ%' },
          { [Op.iLike]: '%cu%' },
          { [Op.iLike]: '%used%' }
        ]
      };
    }
  }
  
  // Lọc theo giá tối đa
  if (maxPrice && Number(maxPrice) > 0) {
    where.price = { [Op.lte]: Number(maxPrice) };
  }
  
  // Lọc theo từ khóa tìm kiếm
  if (keyword) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${keyword}%` } },
      { description: { [Op.iLike]: `%${keyword}%` } }
    ];
  }
  
  try {
    const products = await Product.findAll({
      where,
      limit: 5,
      order: [['rating', 'DESC'], ['reviews', 'DESC']]
    });
    
    return products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Math.round(p.price),
      badge: p.badge || 'New',
      countInStock: p.countInStock,
      image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '/images/placeholder.jpg'
    }));
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

// 2. Kiểm tra trạng thái đơn hàng bảo mật
async function executeCheckOrderStatus(args) {
  const { orderId, customerPhone } = args;
  console.log('🤖 Tool checkOrderStatus triggered:', args);
  
  if (!orderId || !customerPhone) {
    return { error: 'Thiếu thông tin Mã đơn hàng hoặc Số điện thoại để xác thực.' };
  }
  
  try {
    const order = await Order.findByPk(orderId);
    
    if (!order) {
      return { error: `Không tìm thấy đơn hàng #${orderId} trên hệ thống.` };
    }
    
    // Chuẩn hóa và so khớp số điện thoại bảo mật
    const phoneInput = customerPhone.replace(/\s+/g, '').replace('+84', '0');
    const phoneOrder = order.customerPhone.replace(/\s+/g, '').replace('+84', '0');
    
    if (phoneInput !== phoneOrder) {
      return { error: 'Số điện thoại cung cấp không trùng khớp với số điện thoại trong hồ sơ đơn hàng này.' };
    }
    
    return {
      id: order.id,
      customerName: order.customerName,
      totalAmount: Math.round(order.totalAmount),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus || 'processing',
      createdAt: order.createdAt,
      orderItems: order.orderItems
    };
  } catch (error) {
    console.error('Error checking order status:', error);
    return { error: 'Lỗi hệ thống khi tra cứu đơn hàng.' };
  }
}

// 3. Tra cứu bảo hành
async function executeCheckWarrantyStatus(args) {
  const { serialNumber } = args;
  console.log('🤖 Tool checkWarrantyStatus triggered:', args);
  
  if (!serialNumber) {
    return { error: 'Vui lòng cung cấp số Serial S/N.' };
  }
  
  const sn = serialNumber.trim().toUpperCase();
  if (MOCK_WARRANTIES[sn]) {
    return MOCK_WARRANTIES[sn];
  }
  
  // Trả về thông tin động nếu có định dạng SNxxxxx
  if (sn.startsWith('SN') && sn.length > 5) {
    return {
      productName: 'Thiết bị công nghệ cao cấp ShopTech',
      customerName: 'Khách hàng ShopTech',
      purchaseDate: '2025-08-20',
      warrantyPeriodMonths: 12,
      expirationDate: '2026-08-20',
      status: 'Còn bảo hành (Đang hoạt động)'
    };
  }
  
  return {
    error: `Không tìm thấy số Serial S/N: "${serialNumber}" trên hệ thống bảo hành ShopTech. Vui lòng kiểm tra lại tem dán trên sản phẩm hoặc hóa đơn của bạn.`
  };
}

// ---------------------------------------------------------
// MOCK AI FALLBACK (KHI KHÔNG CÓ GEMINI_API_KEY)
// ---------------------------------------------------------
async function runMockAIFallback(message, history) {
  console.log('🔌 Run Mock AI Fallback...');
  const msg = message.toLowerCase();
  let text = '';
  let products = [];
  
  // 1. Phân biệt hàng Like New vs Old
  if (msg.includes('like new') && (msg.includes('old') || msg.includes('cũ') || msg.includes('cu') || msg.includes('khác gì') || msg.includes('khac gi'))) {
    text = `Dạ, đây là thắc mắc rất phổ biến của khách hàng ShopTech ạ! Em xin phép giải thích rõ ràng sự khác biệt để mình dễ dàng lựa chọn nhé:
    
1. **Hàng Like New (Đẹp như mới - 99%):**
- Là các sản phẩm trưng bày, sản phẩm dùng lướt hoặc khách mua về trải nghiệm ngắn ngày rồi đổi.
- Ngoại hình cực kỳ đẹp, không cấn móp hay trầy xước đáng kể (nhìn như máy mới 100%).
- Cam kết linh kiện nguyên bản chưa qua sửa chữa, pin dung lượng cao.
- Phù hợp cho những ai muốn trải nghiệm sản phẩm gần như mới với giá tiết kiệm từ **15% đến 30%**.

2. **Hàng Old (Hàng cũ):**
- Là sản phẩm đã qua sử dụng thông thường, ngoại hình có thể trầy xước dăm nhẹ nhưng hoàn toàn không ảnh hưởng đến cấu hình bên trong.
- Đã được bộ phận kỹ thuật ShopTech kiểm thử hiệu năng và vệ sinh cực kỳ nghiêm ngặt trước khi bán ra.
- Giá bán cực rẻ, tiết kiệm từ **30% đến 50%** so với máy mới.
- Phù hợp cho khách hàng muốn tối ưu hóa chi phí và quan tâm đến hiệu năng thực tế hơn ngoại hình bóng bẩy.

ShopTech luôn cam kết trung thực về tình trạng hàng hóa để anh/chị yên tâm mua sắm ạ!`;
    return { text, products };
  }
  
  // 2. Tra cứu đơn hàng
  const orderMatch = msg.match(/( đơn hàng|đơn|don hang|don)[\s#]*(\d+)/i) || msg.match(/#(\d+)/);
  if (orderMatch) {
    const orderId = parseInt(orderMatch[1] || orderMatch[2]);
    const phoneMatch = message.match(/(0\d{9})/);
    
    if (phoneMatch) {
      const customerPhone = phoneMatch[1];
      const result = await executeCheckOrderStatus({ orderId, customerPhone });
      if (result.error) {
        text = `Dạ, em có tìm thấy yêu cầu tra cứu đơn hàng #${orderId} nhưng gặp lỗi xác thực: **${result.error}**. Anh/chị vui lòng kiểm tra lại Mã đơn hàng hoặc Số điện thoại chính xác giúp em nhé!`;
      } else {
        const dateStr = new Date(result.createdAt).toLocaleDateString('vi-VN');
        const payStatus = result.paymentStatus === 'paid' ? 'Đã thanh toán ✅' : (result.paymentStatus === 'pending' ? 'Chờ thanh toán ⏳' : 'Chưa thanh toán ❌');
        
        let shipStatus = 'Đang xử lý 📦';
        if (result.shippingStatus === 'shipping') shipStatus = 'Đang giao hàng 🚚';
        if (result.shippingStatus === 'delivered') shipStatus = 'Đã giao thành công 🎉';
        if (result.shippingStatus === 'cancelled') shipStatus = 'Đã hủy đơn ❌';
        
        text = `Dạ, em đã tra cứu thông tin thành công cho đơn hàng **#${result.id}** của anh/chị **${result.customerName}** rồi ạ!
        
- **Ngày đặt hàng**: ${dateStr}
- **Tổng trị giá hóa đơn**: ${result.totalAmount.toLocaleString('vi-VN')} đ
- **Phương thức thanh toán**: Cổng thanh toán ${result.paymentMethod === 'bank' ? 'Chuyển khoản Ngân hàng' : 'Nhận tại cửa hàng'}
- **Trạng thái thanh toán**: ${payStatus}
- **Trạng thái vận chuyển**: ${shipStatus}

Sản phẩm của mình bao gồm: ${result.orderItems.map(item => `\n  + ${item.productName} (x${item.quantity})`).join('')}

Anh/chị có cần em hỗ trợ gì thêm cho đơn hàng này không ạ?`;
      }
    } else {
      text = `Dạ, em có thấy mình đang muốn kiểm tra đơn hàng **#${orderId}** ạ.
Để bảo mật thông tin khách hàng, anh/chị vui lòng cung cấp **Số điện thoại** đặt hàng giúp em nhé! (Ví dụ nhắn: "SĐT của tôi là 0987654321")`;
    }
    return { text, products };
  }
  
  // 3. Tra cứu bảo hành qua Serial S/N
  const serialMatch = message.match(/(serial|s\/n|sn|s-n|mã s\/?n)[\s:]*([A-Z0-9]{3,})/i);
  if (serialMatch) {
    const serialNumber = serialMatch[2];
    const result = await executeCheckWarrantyStatus({ serialNumber });
    if (result.error) {
      text = `Dạ! Có phải mình muốn tra cứu bảo hành cho mã số **${serialNumber}**?
❌ **Lỗi**: ${result.error}`;
    } else {
      text = `Dạ, em đã tìm thấy thông tin bảo hành của thiết bị với số Serial **S/N: ${serialNumber}** trên hệ thống ShopTech ạ:
      
- 🖥️ **Tên thiết bị**: ${result.productName}
- 👤 **Khách hàng sở hữu**: ${result.customerName}
- 📅 **Ngày mua hàng**: ${new Date(result.purchaseDate).toLocaleDateString('vi-VN')}
- 🛡️ **Thời hạn bảo hành**: ${result.warrantyPeriodMonths} tháng
- ⏳ **Ngày hết hạn bảo hành**: ${new Date(result.expirationDate).toLocaleDateString('vi-VN')}
- 📌 **Trạng thái hiện tại**: **${result.status}**

Nếu thiết bị có bất kỳ vấn đề kỹ thuật nào trong thời gian bảo hành, anh/chị cứ mang qua cửa hàng ShopTech để được hỗ trợ kiểm tra miễn phí nhé ạ!`;
    }
    return { text, products };
  }
  
  // 4. Tư vấn cấu hình / Tìm kiếm sản phẩm
  let category = 'All';
  if (msg.includes('laptop') || msg.includes('máy tính xách tay')) category = 'Laptop';
  else if (msg.includes('màn hình') || msg.includes('monitor')) category = 'Monitor';
  else if (msg.includes('bàn phím') || msg.includes('keyboard') || msg.includes('phím')) category = 'Keyboard';
  else if (msg.includes('tai nghe') || msg.includes('headphones') || msg.includes('tai')) category = 'Headphones';
  else if (msg.includes('điện thoại') || msg.includes('smartphone') || msg.includes('iphone')) category = 'Smartphone';
  else if (msg.includes('chuột') || msg.includes('chuot') || msg.includes('sạc') || msg.includes('pin') || msg.includes('phụ kiện')) category = 'Accessories';
  
  let maxPrice = 0;
  const priceMatch = msg.match(/(\d+)\s*(triệu|tr|trieu)/) || msg.match(/(\d+)\s*m/);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1]) * 1000000;
  }
  
  let condition = 'All';
  if (msg.includes('mới') || msg.includes('new') || msg.includes('nguyên seal')) condition = 'New';
  else if (msg.includes('like new') || msg.includes('99%') || msg.includes('lướt')) condition = 'Like New';
  else if (msg.includes('cũ') || msg.includes('old') || msg.includes('xả kho')) condition = 'Old';
  
  const searchResults = await executeSearchProducts({
    category,
    maxPrice,
    condition,
    keyword: category === 'All' ? message.split(' ').slice(-2).join(' ') : null
  });
  
  if (searchResults.length > 0) {
    products = searchResults;
    const itemsFormatted = searchResults.map(p => `[ProductCard: ${p.id}]`).join(' ');
    
    let budgetText = maxPrice ? ` tầm giá dưới ${ (maxPrice/1000000) } triệu` : '';
    let condText = condition !== 'All' ? ` tình trạng ${condition}` : '';
    
    text = `Dạ, dựa vào nhu cầu tìm kiếm ${category.toLowerCase()}${budgetText}${condText} của anh/chị, em xin phép giới thiệu danh sách sản phẩm cấu hình tốt, chất lượng đảm bảo nhất hiện có tại ShopTech ạ! 
    
Dưới đây là các sản phẩm tương thích cao, anh/chị có thể xem chi tiết hoặc bấm thêm trực tiếp vào giỏ hàng ngay bên dưới nhé:

${itemsFormatted}

Tất cả sản phẩm này đều cam kết linh kiện chuẩn hãng, được bảo hành đầy đủ tại ShopTech. Anh/chị ưng ý mẫu nào cứ nhắn em để em tư vấn sâu hơn về cấu hình nhé!`;
  } else {
    // Chào mừng chung
    text = `Dạ, ShopTech xin chào anh/chị ạ! 🌸
Em là trợ lý ảo AI thông minh của shop. Em có thể giúp gì cho mình hôm nay ạ?

Em hỗ trợ các công việc sau:
1. 💻 **Tư vấn cấu hình máy tính & Đồ công nghệ**: Thử hỏi em *"tư vấn laptop đồ họa tầm 15 triệu"* nhé!
2. 📦 **Tra cứu trạng thái đơn hàng**: Thử nhắn mã đơn hàng kèm SĐT đặt hàng để em tra cứu bảo mật.
3. 🛡️ **Kiểm tra thời hạn bảo hành**: Nhắn số Serial dạng *"S/N: ABC1"* để xem thời hạn bảo hành.
4. ❓ **Giải đáp thắc mắc về hàng cũ/mới**: Thử hỏi *"Hàng Like New khác gì hàng Old?"*.

Anh/chị cứ thoải mái đặt câu hỏi, em luôn sẵn sàng tư vấn nhiệt tình ạ!`;
  }
  
  return { text, products };
}

// ---------------------------------------------------------
// POST /api/chat - ĐIỂM TIẾP NHẬN HỘI THOẠI AI
// ---------------------------------------------------------
router.post('/', async (req, res) => {
  const { message, history } = req.body;
  
  if (!message) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tin nhắn hội thoại.' });
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  // 1. Kiểm tra nếu chưa cấu hình GEMINI_API_KEY -> kích hoạt Mock AI Fallback ngay lập tức
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    try {
      const fallbackResult = await runMockAIFallback(message, history || []);
      return res.json(fallbackResult);
    } catch (err) {
      return res.status(500).json({ message: 'Lỗi bộ phân tích Mock AI Fallback', error: err.message });
    }
  }
  
  // 2. Chạy với Gemini API thực tế khi đã cấu hình KEY
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Khai báo Persona & System Prompt
    const systemInstruction = `Bạn là "ShopTech AI" - chuyên gia tư vấn phần cứng máy tính và đồ công nghệ cao cấp, làm việc tại cửa hàng ShopTech.
Nhiệm vụ của bạn là hỗ trợ khách hàng tìm kiếm sản phẩm phù hợp, giải đáp thắc mắc về kỹ thuật, tư vấn cấu hình tối ưu theo ngân sách và nhu cầu, giải thích tình trạng hàng hóa, kiểm tra trạng thái đơn hàng và tra cứu bảo hành.

PHONG CÁCH TƯ VẤN:
1. Nhiệt tình, thân thiện, xưng hô lịch sự (ví dụ: "Dạ, ShopTech xin chào anh/chị ạ!", "Em có thể giúp gì cho mình ạ?").
2. Trung thực và minh bạch: Tuyệt đối trung thực về tình trạng hàng hóa. Khách hỏi hàng cũ phải tư vấn đúng ưu/nhược điểm.
3. Chuyên nghiệp: Đưa ra phân tích kỹ thuật dễ hiểu (ví dụ: RAM 8GB đủ dùng văn phòng, đồ họa cần tối thiểu 16GB).

QUY TẮC TÌNH TRẠNG HÀNG HÓA:
Chỉ tư vấn dựa trên 3 tình trạng hàng hóa chính thức:
- "New": Mới 100%, nguyên seal, bảo hành dài hạn, phù hợp cho người thích sự an tâm tuyệt đối.
- "Like New": Máy trưng bày hoặc dùng lướt ngoại hình đẹp 98-99%, linh kiện nguyên bản, giá tiết kiệm hơn 15-30% so với máy mới.
- "Old": Hàng đã qua sử dụng, có trầy xước nhẹ nhưng đã qua kiểm định chất lượng nghiêm ngặt bởi kỹ thuật viên ShopTech, giá cực rẻ, tối ưu hiệu năng trên giá thành.

CÚ PHÁP HIỂN THỊ THẺ SẢN PHẨM (QUY TẮC CỰC KỲ QUAN TRỌNG):
Khi bạn muốn gợi ý hoặc giới thiệu bất kỳ sản phẩm nào cho khách hàng dựa trên dữ liệu sản phẩm lấy được từ hệ thống, bạn BẮT BUỘC phải chèn mã thẻ sản phẩm vào trong văn bản theo cú pháp sau:
\`[ProductCard: ID]\`
Trong đó ID là ID số của sản phẩm (ví dụ: \`[ProductCard: 3]\`). Bạn có thể giới thiệu nhiều sản phẩm bằng cách chèn nhiều mã thẻ cách nhau, ví dụ: "Em gợi ý cho mình 2 mẫu laptop này rất tốt ạ: [ProductCard: 1] [ProductCard: 2]". Cú pháp này sẽ giúp giao diện website tự động chuyển thành Card sản phẩm tương tác vô cùng đẹp mắt. Tuyệt đối không tự bịa ID sản phẩm nếu hàm không trả về.

HÀNG CHỜ VÀ AN TOÀN ĐƠN HÀNG:
- Khi khách hỏi kiểm tra đơn hàng, hãy yêu cầu khách cung cấp đầy đủ cả Mã đơn hàng và Số điện thoại đặt hàng. Tuyệt đối không tiết lộ thông tin đơn hàng nếu khách chỉ đưa 1 trong 2 hoặc không trùng khớp.
- Đối với tra cứu bảo hành, nếu khách cung cấp số Serial S/N, hãy gọi hàm tra cứu bảo hành tương ứng.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
      tools: [{
        functionDeclarations: [
          {
            name: 'searchProducts',
            description: 'Tìm kiếm sản phẩm công nghệ trong database theo danh mục, giá bán tối đa, tình trạng hàng (New/Like New/Old) và từ khóa.',
            parameters: {
              type: 'OBJECT',
              properties: {
                category: { type: 'STRING', description: 'Danh mục sản phẩm (ví dụ: Laptop, Monitor, Keyboard, Headphones, Smartphone, Accessories)' },
                maxPrice: { type: 'NUMBER', description: 'Giá bán tối đa (tiền Việt Nam Đồng, ví dụ: 20000000)' },
                condition: { type: 'STRING', description: 'Tình trạng hàng hóa: "New", "Like New", hoặc "Old"' },
                keyword: { type: 'STRING', description: 'Từ khóa liên quan đến tên hoặc thông số phần cứng' }
              }
            }
          },
          {
            name: 'checkOrderStatus',
            description: 'Tra cứu thông tin trạng thái đơn hàng và trạng thái giao hàng bảo mật. Bắt buộc phải có cả Mã đơn hàng và Số điện thoại khách hàng đặt hàng để bảo mật.',
            parameters: {
              type: 'OBJECT',
              properties: {
                orderId: { type: 'NUMBER', description: 'Mã số ID của đơn hàng cần tra cứu (ví dụ: 12)' },
                customerPhone: { type: 'STRING', description: 'Số điện thoại của khách hàng đã dùng để mua đơn hàng đó (ví dụ: 0987654321)' }
              },
              required: ['orderId', 'customerPhone']
            }
          },
          {
            name: 'checkWarrantyStatus',
            description: 'Tra cứu thông tin bảo hành chính hãng của một thiết bị điện tử dựa theo mã số Serial S/N.',
            parameters: {
              type: 'OBJECT',
              properties: {
                serialNumber: { type: 'STRING', description: 'Mã Serial S/N của thiết bị (ví dụ: ABC1)' }
              },
              required: ['serialNumber']
            }
          }
        ]
      }]
    });
    
    // Chuẩn bị lịch sử hội thoại sang định dạng Gemini API
    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      }
    }
    
    // Thêm tin nhắn hiện tại
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
    
    // 1. Gọi Gemini lần đầu
    let result = await model.generateContent({ contents });
    let response = result.response;
    
    let functionCalls = response.functionCalls || [];
    let productsList = [];
    
    // 2. Xử lý gọi hàm tự động (Function Calling) nếu AI yêu cầu
    if (functionCalls.length > 0) {
      const call = functionCalls[0];
      const { name, args } = call;
      let toolResult;
      
      if (name === 'searchProducts') {
        toolResult = await executeSearchProducts(args);
        productsList = toolResult; // Lưu danh sách sản phẩm để gửi kèm về frontend tiện render
      } else if (name === 'checkOrderStatus') {
        toolResult = await executeCheckOrderStatus(args);
      } else if (name === 'checkWarrantyStatus') {
        toolResult = await executeCheckWarrantyStatus(args);
      }
      
      // Đưa câu trả lời chứa yêu cầu gọi hàm của Model vào lịch sử
      contents.push(response.candidates[0].content);
      
      // Đưa kết quả của hàm vào lịch sử để gửi tiếp lên Gemini
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: name,
            response: { result: toolResult }
          }
        }]
      });
      
      // Gọi Gemini lần 2 để tổng hợp câu trả lời cuối cùng
      result = await model.generateContent({ contents });
      response = result.response;
    }
    
    // 3. Trả về câu trả lời cuối cùng và danh sách sản phẩm đính kèm nếu có
    const finalAnswer = response.text();
    
    // Nếu trong câu trả lời cuối có chèn ProductCard nhưng lúc nãy chưa chạy searchProducts
    // (ví dụ AI tự nhớ hoặc từ hội thoại trước), ta có thể lấy danh sách ID sản phẩm được nhắc tới
    if (productsList.length === 0) {
      const cardIds = [...finalAnswer.matchAll(/\[ProductCard:\s*(\d+)\]/g)].map(m => parseInt(m[1]));
      if (cardIds.length > 0) {
        const foundProducts = await Product.findAll({
          where: { id: { [Op.in]: cardIds } }
        });
        productsList = foundProducts.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Math.round(p.price),
          badge: p.badge || 'New',
          countInStock: p.countInStock,
          image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '/images/placeholder.jpg'
        }));
      }
    }
    
    res.json({
      text: finalAnswer,
      products: productsList
    });
    
  } catch (error) {
    console.error('❌ Gemini Server error:', error);
    // Tự động fallback sang Mock AI khi lỗi API xảy ra để bảo toàn trải nghiệm người dùng
    try {
      const fallbackResult = await runMockAIFallback(message, history || []);
      return res.json({
        ...fallbackResult,
        warning: 'Đang chạy chế độ Mock AI do lỗi kết nối Gemini API.'
      });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi xử lý hội thoại AI.', error: error.message });
    }
  }
});

module.exports = router;
