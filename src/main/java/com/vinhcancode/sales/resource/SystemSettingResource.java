package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.SystemSetting;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/settings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
public class SystemSettingResource {

    @Inject
    EntityManager em;

    @Inject
    JsonWebToken jwt;

    @Inject
    PermissionService permissions;

    public static final String DEFAULT_THERMAL_CONFIG = "{\"paperSize\":\"k80\",\"receiptTitle\":\"PHIẾU XUẤT BÁN HÀNG\",\"subTitle\":\"Hóa đơn kiêm phiếu xuất kho\",\"showStoreName\":true,\"storeName\":\"\",\"showStoreAddress\":true,\"storeAddress\":\"\",\"showStorePhone\":true,\"storePhone\":\"\",\"showTaxCode\":true,\"showVoucherNo\":true,\"showDateTime\":true,\"showCustomer\":true,\"showCustomerPhone\":true,\"showCustomerAddress\":true,\"showWarehouse\":true,\"showCashier\":true,\"cashierName\":\"\",\"itemLayout\":\"multi-line\",\"showItemCode\":true,\"showItemUnit\":true,\"showItemIndex\":true,\"showTotalQty\":true,\"showGrandTotal\":true,\"showPaymentMethod\":true,\"paymentMethod\":\"Tiền mặt\",\"showAmountInWords\":false,\"thankYouMessage\":\"Cảm ơn quý khách và hẹn gặp lại!\",\"returnPolicy\":\"Quý khách vui lòng kiểm tra hàng hóa trước khi nhận.\",\"showBarcode\":true,\"showQrCode\":false,\"qrContent\":\"\"}";

    @GET
    public Map<String, Object> getAll() {
        List<SystemSetting> list = SystemSetting.listAll();
        Map<String, Object> map = new LinkedHashMap<>();
        for (SystemSetting s : list) {
            map.put(s.key, s.value);
        }
        // Đảm bảo các cấu hình luôn có giá trị mặc định nếu chưa lưu
        map.putIfAbsent("inv_delete_policy", "prompt");
        map.putIfAbsent("date_format", "dd/mm/yyyy");
        map.putIfAbsent("thermal_receipt_config", DEFAULT_THERMAL_CONFIG);
        return map;
    }

    @GET
    @Path("/{key}")
    public Map<String, Object> getByKey(@PathParam("key") String key) {
        SystemSetting s = SystemSetting.find("key", key).firstResult();
        if (s == null) {
            if ("inv_delete_policy".equals(key)) {
                return Map.of("key", "inv_delete_policy", "value", "prompt", "description", "Mặc định hỏi người dùng");
            }
            if ("date_format".equals(key)) {
                return Map.of("key", "date_format", "value", "dd/mm/yyyy", "description", "Định dạng ngày hiển thị");
            }
            if ("thermal_receipt_config".equals(key)) {
                return Map.of("key", "thermal_receipt_config", "value", DEFAULT_THERMAL_CONFIG, "description", "Cấu hình thiết kế mẫu in nhiệt phiếu xuất bán hàng (khổ K80/K58)");
            }
            throw new NotFoundException();
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("key", s.key);
        res.put("value", s.value);
        res.put("description", s.description);
        res.put("updatedAt", s.updatedAt);
        res.put("updatedBy", s.updatedBy);
        return res;
    }

    @PUT
    @Path("/{key}")
    @Transactional
    public Response update(@PathParam("key") String key, Map<String, String> body) {
        String val = body != null ? body.get("value") : null;
        if (val == null || val.isBlank()) {
            throw MasterResource.bad("Giá trị cấu hình không được để trống");
        }
        if ("inv_delete_policy".equals(key)) {
            val = val.trim().toLowerCase();
            if (!val.equals("prompt") && !val.equals("cascade") && !val.equals("block")) {
                throw MasterResource.bad("Chính sách không hợp lệ (prompt, cascade, block)");
            }
        } else if ("date_format".equals(key)) {
            val = val.trim().toLowerCase();
            if (!val.equals("dd/mm/yyyy") && !val.equals("mm/dd/yyyy")) {
                throw MasterResource.bad("Định dạng ngày không hợp lệ (dd/mm/yyyy, mm/dd/yyyy)");
            }
        }

        SystemSetting s = SystemSetting.find("key", key).firstResult();
        if (s == null) {
            s = new SystemSetting();
            s.key = key;
        }
        s.value = val;
        s.updatedAt = LocalDateTime.now();
        s.updatedBy = jwt.getName();
        s.persist();

        return Response.ok(Map.of("key", s.key, "value", s.value)).build();
    }
}

