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
}
