package com.vinhcancode.sales;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

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
        String exportDocJson = """
            {
              "type": "export",
              "date": "2026-11-10",
              "note": "Xuất bán hàng thu tiền ngay",
              "partner": {"id": "4df1b486-9012-46fc-9adf-416b22cd15cb", "name": "Công ty Cổ phần Xây dựng Coteccons"},
              "warehouseOut": {"id": "85788637-cbd7-4187-9bc2-a77c3916f031", "name": "Kho Trung Tâm Hà Nội"},
              "lines": [
                {
                  "product": {"id": "a037c556-0854-4c66-a782-d4bd51d5fc8b", "name": "Robot AGV thân thấp (low profile)"},
                  "qty": 2,
                  "price": 500000
                }
              ]
            }
            """;

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
}

