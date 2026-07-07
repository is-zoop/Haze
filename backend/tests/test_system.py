from fastapi import Query, Request
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.response import success_response
from app.main import create_app


def test_health_uses_unified_response(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["message"] == "success"
    assert body["data"] == {"status": "ok"}
    assert body["request_id"]
    assert response.headers["X-Request-ID"] == body["request_id"]


def test_version_comes_from_settings(client: TestClient) -> None:
    response = client.get("/api/version")
    assert response.status_code == 200
    assert response.json()["data"] == {"version": get_settings().app_version}


def test_request_id_is_forwarded(client: TestClient) -> None:
    response = client.get(
        "/api/health", headers={"X-Request-ID": "haze-test-request"}
    )
    assert response.headers["X-Request-ID"] == "haze-test-request"
    assert response.json()["request_id"] == "haze-test-request"


def test_http_errors_use_unified_response(client: TestClient) -> None:
    response = client.get("/api/not-found")
    assert response.status_code == 404
    assert response.json()["code"] == 404
    assert response.json()["data"] == {}
    assert response.json()["request_id"]


def test_validation_errors_use_unified_response() -> None:
    application = create_app()

    @application.get("/api/test/validation")
    async def validation_route(
        request: Request, count: int = Query(ge=1)
    ) -> dict[str, object]:
        return success_response(request, {"count": count}).model_dump()

    with TestClient(application) as test_client:
        response = test_client.get("/api/test/validation?count=0")
    assert response.status_code == 422
    assert response.json()["code"] == 1001
    assert response.json()["message"] == "validation error"
    assert response.json()["data"]["errors"]


def test_unexpected_errors_hide_details() -> None:
    application = create_app()

    @application.get("/api/test/error")
    async def error_route() -> None:
        raise RuntimeError("sensitive details")

    with TestClient(application, raise_server_exceptions=False) as test_client:
        response = test_client.get("/api/test/error")
    assert response.status_code == 500
    assert response.json()["code"] == 5000
    assert response.json()["message"] == "internal server error"
    assert "sensitive details" not in response.text


def test_api_documentation_is_available(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    openapi_response = client.get("/openapi.json")
    assert openapi_response.status_code == 200
    assert "/api/health" in openapi_response.json()["paths"]
