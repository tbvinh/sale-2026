package com.vinhcancode.sales;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SalesFeatureTest {

    private static String authToken;

    @Test
    @Order(1)
    public void testPublicEndpoint() {
        given()
            .when().get("/api/public/hello")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(2)
    public void testAuthLoginFailure() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"username\": \"admin\", \"password\": \"wrong_password\"}")
            .when().post("/api/auth/loginv1")
            .then()
            .statusCode(401);
    }

    @Test
    @Order(3)
    public void testAuthLoginSuccess() {
        Response response = given()
            .contentType(ContentType.JSON)
            .body("{\"username\": \"admin\", \"password\": \"123\"}")
            .when().post("/api/auth/loginv1")
            .then()
            .statusCode(200)
            .cookie("token")
            .extract().response();

        authToken = response.getCookie("token");
    }

    @Test
    @Order(4)
    public void testAuthMe() {
        given()
            .cookie("token", authToken)
            .when().get("/api/auth/me")
            .then()
            .statusCode(200)
            .body("username", equalTo("admin"))
            .body("role", equalTo("admin"));
    }

    @Test
    @Order(5)
    public void testSystemInfo() {
        given()
            .cookie("token", authToken)
            .when().get("/api/system/info")
            .then()
            .statusCode(200)
            .body("appName", notNullValue())
            .body("dbName", notNullValue());
    }

    @Test
    @Order(6)
    public void testCompanyList() {
        given()
            .cookie("token", authToken)
            .when().get("/api/companies")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(7)
    public void testCatalogCustomers() {
        given()
            .cookie("token", authToken)
            .when().get("/api/customers")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(8)
    public void testCatalogMaterials() {
        given()
            .cookie("token", authToken)
            .when().get("/api/materials")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(9)
    public void testCatalogWarehouses() {
        given()
            .cookie("token", authToken)
            .when().get("/api/warehouses")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(10)
    public void testInventoryDocs() {
        given()
            .cookie("token", authToken)
            .when().get("/api/inventory/docs")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(11)
    public void testOpeningInventory() {
        given()
            .cookie("token", authToken)
            .when().get("/api/opening-balances?kind=material")
            .then()
            .statusCode(200);
    }

    @Test
    @Order(12)
    public void testExportSalesAndCashReceiptLink() {
        Response whRes = given().cookie("token", authToken).when().get("/api/warehouses").then().statusCode(200).extract().response();
        String whId = whRes.path("items[0].id");
        String whName = whRes.path("items[0].name");
        Response custRes = given().cookie("token", authToken).when().get("/api/customers").then().statusCode(200).extract().response();
        String custId = custRes.path("items[0].id");
        String custName = custRes.path("items[0].name");
        Response matRes = given().cookie("token", authToken).when().get("/api/materials").then().statusCode(200).extract().response();
        String matId = matRes.path("items[0].id");
        String matName = matRes.path("items[0].name");

        String exportDocJson = String.format("""
            {
              "type": "export",
              "date": "2026-11-10",
              "note": "Xuất bán hàng thu tiền ngay",
              "partner": {"id": "%s", "name": "%s"},
              "warehouseOut": {"id": "%s", "name": "%s"},
              "lines": [
                {
                  "product": {"id": "%s", "name": "%s"},
                  "qty": 2,
                  "price": 500000
                }
              ]
            }
            """, custId, custName, whId, whName, matId, matName);

        Response docResp = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(exportDocJson)
            .when().post("/api/inventory/docs")
            .then()
            .statusCode(201)
            .body("type", equalTo("export"))
            .extract().response();

        Number docIdNum = docResp.path("id");
        Long docId = docIdNum.longValue();
        String docNo = docResp.path("no");

        // Tạo phiếu thu tiền mặt từ phiếu xuất kho
        Response voucherResp = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{}")
            .when().post("/api/cash/vouchers/from-inventory/" + docId)
            .then()
            .statusCode(201)
            .body("type", equalTo("receipt"))
            .body("sourceDocId", equalTo(docId.intValue()))
            .body("sourceDocNo", equalTo(docNo))
            .body("amount", equalTo(1000000))
            .extract().response();

        String voucherCode = voucherResp.path("code");

        // Kiểm tra truy vấn phiếu thu theo phiếu kho nguồn
        given()
            .cookie("token", authToken)
            .when().get("/api/cash/vouchers/by-source/" + docId)
            .then()
            .statusCode(200)
            .body("code", equalTo(voucherCode))
            .body("sourceDocNo", equalTo(docNo))
            .body("amount", equalTo(1000000));
    }

    @Test
    @Order(13)
    public void testImportPurchaseAndCashPaymentLink() {
        Response whRes = given().cookie("token", authToken).when().get("/api/warehouses").then().statusCode(200).extract().response();
        String whId = whRes.path("items[0].id");
        String whName = whRes.path("items[0].name");
        Response suppRes = given().cookie("token", authToken).when().get("/api/suppliers").then().statusCode(200).extract().response();
        String suppId = suppRes.path("items[0].id");
        String suppName = suppRes.path("items[0].name");
        Response matRes = given().cookie("token", authToken).when().get("/api/materials").then().statusCode(200).extract().response();
        String matId = matRes.path("items[0].id");
        String matName = matRes.path("items[0].name");

        String importDocJson = String.format("""
            {
              "type": "import",
              "date": "2026-11-10",
              "note": "Nhập mua hàng chi tiền ngay",
              "partner": {"id": "%s", "name": "%s"},
              "warehouseIn": {"id": "%s", "name": "%s"},
              "lines": [
                {
                  "product": {"id": "%s", "name": "%s"},
                  "qty": 3,
                  "price": 400000
                }
              ]
            }
            """, suppId, suppName, whId, whName, matId, matName);

        Response docResp = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(importDocJson)
            .when().post("/api/inventory/docs")
            .then()
            .statusCode(201)
            .body("type", equalTo("import"))
            .extract().response();

        Number docIdNum = docResp.path("id");
        Long docId = docIdNum.longValue();
        String docNo = docResp.path("no");

        // Tạo phiếu chi tiền mặt từ phiếu nhập kho
        Response voucherResp = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{}")
            .when().post("/api/cash/vouchers/from-inventory/" + docId)
            .then()
            .statusCode(201)
            .body("type", equalTo("payment"))
            .body("sourceDocId", equalTo(docId.intValue()))
            .body("sourceDocNo", equalTo(docNo))
            .body("amount", equalTo(1200000))
            .extract().response();

        String voucherCode = voucherResp.path("code");

        // Kiểm tra truy vấn phiếu chi theo phiếu kho nguồn
        given()
            .cookie("token", authToken)
            .when().get("/api/cash/vouchers/by-source/" + docId)
            .then()
            .statusCode(200)
            .body("code", equalTo(voucherCode))
            .body("type", equalTo("payment"))
            .body("sourceDocNo", equalTo(docNo))
            .body("amount", equalTo(1200000));
    }

    @Test
    @Order(14)
    public void testInventoryDeletePolicies() {
        // 1. Kiểm tra GET /settings
        given()
            .cookie("token", authToken)
            .when().get("/api/settings")
            .then()
            .statusCode(200)
            .body("inv_delete_policy", notNullValue());

        // 2. Kiểm tra PUT /settings với giá trị không hợp lệ -> 400
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"invalid_policy\"}")
            .when().put("/api/settings/inv_delete_policy")
            .then()
            .statusCode(400);

        // 3. Thiết lập policy = block
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"block\"}")
            .when().put("/api/settings/inv_delete_policy")
            .then()
            .statusCode(200)
            .body("value", equalTo("block"));

        // Tạo 1 phiếu xuất kho và phiếu thu liên kết
        Response whRes = given().cookie("token", authToken).when().get("/api/warehouses").then().statusCode(200).extract().response();
        String whId = whRes.path("items[0].id");
        String whName = whRes.path("items[0].name");
        Response custRes = given().cookie("token", authToken).when().get("/api/customers").then().statusCode(200).extract().response();
        String custId = custRes.path("items[0].id");
        String custName = custRes.path("items[0].name");
        Response matRes = given().cookie("token", authToken).when().get("/api/materials").then().statusCode(200).extract().response();
        String matId = matRes.path("items[0].id");
        String matName = matRes.path("items[0].name");

        String exportJson = String.format("""
            {
              "type": "export",
              "date": "2026-11-10",
              "warehouseOut": {"id": "%s", "name": "%s"},
              "partner": {"id": "%s", "name": "%s"},
              "note": "Xuất bán kiểm tra policy",
              "lines": [
                {
                  "product": {"id": "%s", "name": "%s"},
                  "qty": 1,
                  "price": 200000
                }
              ]
            }
            """, whId, whName, custId, custName, matId, matName);

        Response docResp1 = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(exportJson)
            .when().post("/api/inventory/docs")
            .then()
            .statusCode(201)
            .extract().response();
        Long docId1 = ((Number) docResp1.path("id")).longValue();

        Response voucherResp1 = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{}")
            .when().post("/api/cash/vouchers/from-inventory/" + docId1)
            .then()
            .statusCode(201)
            .extract().response();
        String voucherId1 = voucherResp1.path("id");

        // 4. Thử xóa phiếu kho khi policy = block -> phải bị chặn (400)
        given()
            .cookie("token", authToken)
            .when().delete("/api/inventory/docs/" + docId1)
            .then()
            .statusCode(400)
            .body("message", containsString("không cho phép xóa"));

        // 5. Đổi policy sang cascade
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"cascade\"}")
            .when().put("/api/settings/inv_delete_policy")
            .then()
            .statusCode(200)
            .body("value", equalTo("cascade"));

        // Xóa phiếu kho khi policy = cascade -> thành công (204) và hủy phiếu thu liên kết
        given()
            .cookie("token", authToken)
            .when().delete("/api/inventory/docs/" + docId1)
            .then()
            .statusCode(204);

        // Kiểm tra phiếu thu liên kết đã chuyển status = 'cancelled'
        given()
            .cookie("token", authToken)
            .when().get("/api/cash/vouchers/" + voucherId1)
            .then()
            .statusCode(200)
            .body("status", equalTo("cancelled"));

        // 6. Đổi policy sang prompt
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"prompt\"}")
            .when().put("/api/settings/inv_delete_policy")
            .then()
            .statusCode(200)
            .body("value", equalTo("prompt"));

        // Tạo tiếp 1 phiếu xuất kho + phiếu thu
        Response docResp2 = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(exportJson)
            .when().post("/api/inventory/docs")
            .then()
            .statusCode(201)
            .extract().response();
        Long docId2 = ((Number) docResp2.path("id")).longValue();

        Response voucherResp2 = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{}")
            .when().post("/api/cash/vouchers/from-inventory/" + docId2)
            .then()
            .statusCode(201)
            .extract().response();
        String voucherId2 = voucherResp2.path("id");

        // Xóa với deleteLinked=true -> 204, phiếu thu status = 'cancelled'
        given()
            .cookie("token", authToken)
            .queryParam("deleteLinked", true)
            .when().delete("/api/inventory/docs/" + docId2)
            .then()
            .statusCode(204);

        given()
            .cookie("token", authToken)
            .when().get("/api/cash/vouchers/" + voucherId2)
            .then()
            .statusCode(200)
            .body("status", equalTo("cancelled"));
    }

    @Test
    @Order(15)
    public void testDateFormatSetting() {
        // 1. Kiểm tra GET /settings có date_format
        given()
            .cookie("token", authToken)
            .when().get("/api/settings")
            .then()
            .statusCode(200)
            .body("date_format", notNullValue());

        // 2. Kiểm tra GET /settings/date_format
        given()
            .cookie("token", authToken)
            .when().get("/api/settings/date_format")
            .then()
            .statusCode(200)
            .body("value", notNullValue());

        // 3. Kiểm tra PUT /settings/date_format với giá trị không hợp lệ -> 400
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"yyyy-mm-dd\"}")
            .when().put("/api/settings/date_format")
            .then()
            .statusCode(400)
            .body("message", containsString("Định dạng ngày không hợp lệ"));

        // 4. Kiểm tra PUT /settings/date_format với mm/dd/yyyy -> 200
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"mm/dd/yyyy\"}")
            .when().put("/api/settings/date_format")
            .then()
            .statusCode(200)
            .body("value", equalTo("mm/dd/yyyy"));

        // 5. Khôi phục lại dd/mm/yyyy -> 200
        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body("{\"value\": \"dd/mm/yyyy\"}")
            .when().put("/api/settings/date_format")
            .then()
            .statusCode(200)
            .body("value", equalTo("dd/mm/yyyy"));
    }

    @Test
    @Order(16)
    public void testOpeningBalanceWithWarehouseAndStockSummary() {
        // 1. Lấy kho đầu tiên
        Response whRes = given()
            .cookie("token", authToken)
            .when().get("/api/warehouses")
            .then()
            .statusCode(200)
            .extract().response();
        String warehouseId = whRes.jsonPath().getString("items[0].id");
        org.junit.jupiter.api.Assertions.assertNotNull(warehouseId);

        // 2. Lấy vật tư đầu tiên
        Response matRes = given()
            .cookie("token", authToken)
            .when().get("/api/materials")
            .then()
            .statusCode(200)
            .extract().response();
        String materialId = matRes.jsonPath().getString("items[0].id");
        org.junit.jupiter.api.Assertions.assertNotNull(materialId);

        // 3. Tạo tồn kho đầu kỳ có warehouseId và date
        String openPayload = String.format("""
            {
                "kind": "material",
                "direction": "debit",
                "warehouseId": "%s",
                "materialId": "%s",
                "date": "2026-01-01",
                "quantity": 88,
                "unitPrice": 12000,
                "amount": 1056000,
                "name": "Tồn kho đầu kỳ kiểm thử"
            }
            """, warehouseId, materialId);

        Response createRes = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(openPayload)
            .when().post("/api/opening-balances")
            .then()
            .statusCode(201)
            .body("warehouseId", equalTo(warehouseId))
            .body("date", equalTo("2026-01-01"))
            .body("quantity", equalTo(88))
            .extract().response();

        String openBalId = createRes.jsonPath().getString("id");

        // 4. Lọc tồn kho đầu kỳ theo warehouseId
        given()
            .cookie("token", authToken)
            .queryParam("warehouseId", warehouseId)
            .queryParam("kind", "material")
            .when().get("/api/opening-balances")
            .then()
            .statusCode(200)
            .body("items.size()", org.hamcrest.Matchers.greaterThanOrEqualTo(1));

        // 5. Kiểm tra bảng tổng hợp NXT toàn bộ kho
        given()
            .cookie("token", authToken)
            .queryParam("dateFrom", "2026-01-01")
            .queryParam("dateTo", "2026-12-31")
            .when().get("/api/inventory/reports/stock-summary")
            .then()
            .statusCode(200)
            .body("warehouseSummaries", notNullValue())
            .body("warehouseSummaries.size()", org.hamcrest.Matchers.greaterThanOrEqualTo(1))
            .body("totals.openingQty", org.hamcrest.Matchers.greaterThanOrEqualTo(88));

        // 6. Kiểm tra bảng tổng hợp NXT lọc theo warehouseId cụ thể
        given()
            .cookie("token", authToken)
            .queryParam("dateFrom", "2026-01-01")
            .queryParam("dateTo", "2026-12-31")
            .queryParam("warehouseId", warehouseId)
            .when().get("/api/inventory/reports/stock-summary")
            .then()
            .statusCode(200)
            .body("warehouseId", equalTo(warehouseId))
            .body("items", notNullValue())
            .body("totals.openingQty", org.hamcrest.Matchers.greaterThanOrEqualTo(88));

        // 7. Kiểm tra sổ chi tiết vật tư theo warehouseId
        given()
            .cookie("token", authToken)
            .queryParam("materialId", materialId)
            .queryParam("warehouseId", warehouseId)
            .queryParam("dateFrom", "2026-01-01")
            .queryParam("dateTo", "2026-12-31")
            .when().get("/api/inventory/reports/material-ledger")
            .then()
            .statusCode(200)
            .body("openingQty", org.hamcrest.Matchers.greaterThanOrEqualTo(88));

        // Dọn dẹp bản ghi kiểm thử
        if (openBalId != null) {
            given()
                .cookie("token", authToken)
                .when().delete("/api/opening-balances/" + openBalId)
                .then()
                .statusCode(204);
        }
    }

    @Test
    @Order(17)
    public void testOpeningBalanceExcelExportAndImportReplace() {
        // 1. Kiểm tra tải file Excel mẫu
        given()
            .cookie("token", authToken)
            .when().get("/api/opening-balances/template-excel")
            .then()
            .statusCode(200)
            .header("Content-Disposition", containsString("ton-kho-dau-ky-mau.xlsx"));

        // 2. Kiểm tra xuất file Excel dữ liệu tồn kho đầu kỳ
        given()
            .cookie("token", authToken)
            .when().get("/api/opening-balances/export-excel")
            .then()
            .statusCode(200)
            .header("Content-Disposition", containsString("ton-kho-dau-ky.xlsx"));

        // 3. Lấy kho và vật tư thực tế
        Response whRes = given()
            .cookie("token", authToken)
            .when().get("/api/warehouses")
            .then()
            .statusCode(200)
            .extract().response();
        String warehouseId = whRes.jsonPath().getString("items[0].id");
        String warehouseCode = whRes.jsonPath().getString("items[0].code");

        Response matRes = given()
            .cookie("token", authToken)
            .when().get("/api/materials")
            .then()
            .statusCode(200)
            .extract().response();
        String materialId = matRes.jsonPath().getString("items[0].id");
        String materialCode = matRes.jsonPath().getString("items[0].code");

        // 4. Import lần 1: Thêm mới tồn đầu theo composite key (materialCode, warehouseCode)
        String row1 = String.format("""
            [
                {
                    "materialCode": "%s",
                    "warehouseCode": "%s",
                    "date": "2026-01-01",
                    "quantity": 111,
                    "unitPrice": 50000,
                    "amount": 5550000,
                    "name": "Import lan 1"
                }
            ]
            """, materialCode, warehouseCode);

        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(row1)
            .when().post("/api/opening-balances/import-json")
            .then()
            .statusCode(200)
            .body("ok", equalTo(1))
            .body("created", equalTo(1))
            .body("updated", equalTo(0));

        // 5. Import lần 2: Cùng composite key (materialCode, warehouseCode) -> Phải REPLACE, không nhân đôi
        String row2 = String.format("""
            [
                {
                    "materialCode": "%s",
                    "warehouseCode": "%s",
                    "date": "2026-01-01",
                    "quantity": 222,
                    "unitPrice": 55000,
                    "amount": 12210000,
                    "name": "Import lan 2 replace"
                }
            ]
            """, materialCode, warehouseCode);

        given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(row2)
            .when().post("/api/opening-balances/import-json")
            .then()
            .statusCode(200)
            .body("ok", equalTo(1))
            .body("created", equalTo(0))
            .body("updated", equalTo(1));

        // 6. Kiểm tra lại dữ liệu đã được cập nhật thành 222
        Response checkRes = given()
            .cookie("token", authToken)
            .queryParam("warehouseId", warehouseId)
            .queryParam("kind", "material")
            .when().get("/api/opening-balances")
            .then()
            .statusCode(200)
            .extract().response();

        List<Map<String, Object>> items = checkRes.jsonPath().getList("items");
        Map<String, Object> found = items.stream()
            .filter(it -> materialId.equals(it.get("materialId")) && warehouseId.equals(it.get("warehouseId")))
            .findFirst().orElse(null);

        org.junit.jupiter.api.Assertions.assertNotNull(found);
        org.junit.jupiter.api.Assertions.assertEquals(222, ((Number) found.get("quantity")).intValue());

        // 7. Kiểm tra import qua endpoint multipart /import-excel
        String csvContent = String.format(
            "Mã vật tư,Tên vật tư,Đơn vị tính,Mã kho,Tên kho,Ngày chứng từ,Số lượng,Đơn giá,Thành tiền,Diễn giải\n%s,VT Test,Cái,%s,Kho Test,2026-01-01,333,60000,19980000,Import file lan 3 replace\n",
            materialCode, warehouseCode);

        given()
            .cookie("token", authToken)
            .multiPart("file", "test.csv", csvContent.getBytes(java.nio.charset.StandardCharsets.UTF_8), "text/csv")
            .when().post("/api/opening-balances/import-excel")
            .then()
            .statusCode(200)
            .body("ok", equalTo(1))
            .body("updated", equalTo(1));

        // 8. Dọn dẹp bản ghi sau kiểm thử
        String openBalId = (String) found.get("id");
        if (openBalId != null) {
            given()
                .cookie("token", authToken)
                .when().delete("/api/opening-balances/" + openBalId)
                .then()
                .statusCode(204);
        }
    }

    @Test
    @Order(18)
    public void testOpeningCashBalance() {
        // 1. Tải template và export Excel cho tồn quỹ
        given()
            .cookie("token", authToken)
            .queryParam("kind", "cash")
            .when().get("/api/opening-balances/template-excel")
            .then()
            .statusCode(200)
            .header("Content-Disposition", containsString("ton-quy-dau-ky-mau.xlsx"));

        given()
            .cookie("token", authToken)
            .queryParam("kind", "cash")
            .when().get("/api/opening-balances/export-excel")
            .then()
            .statusCode(200)
            .header("Content-Disposition", containsString("ton-quy-dau-ky.xlsx"));

        // 2. Lấy tài khoản quỹ (1111)
        Response accRes = given()
            .cookie("token", authToken)
            .when().get("/api/accounts")
            .then()
            .statusCode(200)
            .extract().response();
        List<Map<String, Object>> accounts = accRes.jsonPath().getList("items");
        Map<String, Object> cashAcc = accounts.stream()
            .filter(a -> "1111".equals(a.get("code")))
            .findFirst()
            .orElse(accounts.isEmpty() ? null : accounts.get(0));

        org.junit.jupiter.api.Assertions.assertNotNull(cashAcc, "Tài khoản quỹ không được null");
        String accountId = (String) cashAcc.get("id");

        // 3. Tạo mới tồn quỹ đầu kỳ
        String payload = String.format("""
            {
                "kind": "cash",
                "accountId": "%s",
                "date": "2026-01-01",
                "amount": 75000000,
                "name": "Tồn quỹ tiền mặt đầu kỳ kiểm thử"
            }
            """, accountId);

        Response createRes = given()
            .cookie("token", authToken)
            .contentType(ContentType.JSON)
            .body(payload)
            .when().post("/api/opening-balances")
            .then()
            .statusCode(201)
            .body("kind", equalTo("cash"))
            .body("accountId", equalTo(accountId))
            .body("amount", equalTo(75000000))
            .extract().response();

        String openBalId = createRes.jsonPath().getString("id");

        // 4. Lọc danh sách tồn quỹ đầu kỳ
        given()
            .cookie("token", authToken)
            .queryParam("kind", "cash")
            .queryParam("accountId", accountId)
            .when().get("/api/opening-balances")
            .then()
            .statusCode(200)
            .body("items.size()", org.hamcrest.Matchers.greaterThanOrEqualTo(1));

        // 5. Kiểm tra Sổ quỹ tiền mặt (/api/cash/book) nhận tồn đầu kỳ
        given()
            .cookie("token", authToken)
            .queryParam("dateFrom", "2026-01-01")
            .queryParam("dateTo", "2026-12-31")
            .queryParam("accountId", accountId)
            .when().get("/api/cash/book")
            .then()
            .statusCode(200)
            .body("opening", org.hamcrest.Matchers.greaterThanOrEqualTo(75000000));

        // 6. Dọn dẹp bản ghi kiểm thử
        if (openBalId != null) {
            given()
                .cookie("token", authToken)
                .when().delete("/api/opening-balances/" + openBalId)
                .then()
                .statusCode(204);
        }
    }
}

