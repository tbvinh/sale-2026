-- Cấu hình mẫu in nhiệt phiếu xuất bán hàng (khổ K80 / K58)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'thermal_receipt_config',
    '{"paperSize":"k80","receiptTitle":"PHIẾU XUẤT BÁN HÀNG","subTitle":"Hóa đơn kiêm phiếu xuất kho","showStoreName":true,"storeName":"","showStoreAddress":true,"storeAddress":"","showStorePhone":true,"storePhone":"","showTaxCode":true,"showVoucherNo":true,"showDateTime":true,"showCustomer":true,"showCustomerPhone":true,"showCustomerAddress":true,"showWarehouse":true,"showCashier":true,"cashierName":"","itemLayout":"multi-line","showItemCode":true,"showItemUnit":true,"showItemIndex":true,"showTotalQty":true,"showGrandTotal":true,"showPaymentMethod":true,"paymentMethod":"Tiền mặt","showAmountInWords":false,"thankYouMessage":"Cảm ơn quý khách và hẹn gặp lại!","returnPolicy":"Quý khách vui lòng kiểm tra hàng hóa trước khi nhận.","showBarcode":true,"showQrCode":false,"qrContent":""}',
    'Cấu hình thiết kế mẫu in nhiệt phiếu xuất bán hàng (khổ K80/K58)'
)
ON CONFLICT (setting_key) DO NOTHING;

