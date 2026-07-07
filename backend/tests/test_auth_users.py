from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.bootstrap import bootstrap
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.modules.roles.models import Permission


@pytest.fixture
def auth_client() -> Generator[TestClient, None, None]:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    Base.metadata.create_all(engine)
    settings = get_settings()
    settings.jwt_access_token_expire_minutes = 60
    settings.initial_admin_name = "admin"
    settings.initial_admin_phone = "13800138000"
    settings.initial_admin_email = "admin@example.com"
    settings.initial_admin_password = "AdminPass!123"
    settings.initial_admin_department = "?????"
    with TestingSession() as session:
        bootstrap(session)
        session.add(Permission(code="future.permission", name="Future"))
        session.commit()
        bootstrap(session)

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSession() as session:
            yield session

    application = create_app()
    application.dependency_overrides[get_db] = override_get_db
    with TestClient(application, raise_server_exceptions=False) as client:
        yield client


def login(client: TestClient, phone: str, password: str) -> dict[str, object]:
    response = client.post("/api/auth/login", json={"phone": phone, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["data"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_bootstrap_login_me_and_logout(auth_client: TestClient) -> None:
    data = login(auth_client, "13800138000", "AdminPass!123")
    token = data["access_token"]
    assert data["expires_in"] == 3600
    assert data["user"]["role_code"] == "SYSTEM_ADMIN"
    assert "members.delete" in data["user"]["permissions"]
    assert "future.permission" in data["user"]["permissions"]
    assert auth_client.get("/api/auth/me", headers=auth_header(token)).status_code == 200
    assert auth_client.post("/api/auth/logout", headers=auth_header(token)).status_code == 200
    assert auth_client.get("/api/auth/me", headers=auth_header(token)).status_code == 401


def test_personal_credential_can_query_user_and_old_key_expires(auth_client: TestClient) -> None:
    token = login(auth_client, "13800138000", "AdminPass!123")["access_token"]
    credential = auth_client.get("/api/auth/me/mcp-credential", headers=auth_header(token))
    assert credential.status_code == 200, credential.text
    key = credential.json()["data"]["key"]

    profile = auth_client.get("/api/auth/personal-credential/me", headers=auth_header(key))
    assert profile.status_code == 200, profile.text
    assert profile.json()["data"]["member_no"] == "ADMIN0001"
    assert "avatar_url" not in profile.json()["data"]
    assert "permissions" not in profile.json()["data"]

    invalid = auth_client.get("/api/auth/personal-credential/me", headers=auth_header("haze_invalid"))
    assert invalid.status_code == 401
    assert invalid.json()["message"] == "invalid or expired personal service credential"

    reset = auth_client.post("/api/auth/me/mcp-credential/reset", headers=auth_header(token))
    assert reset.status_code == 200, reset.text
    expired = auth_client.get("/api/auth/personal-credential/me", headers=auth_header(key))
    assert expired.status_code == 401
    assert expired.json()["message"] == "invalid or expired personal service credential"
    new_key = reset.json()["data"]["key"]
    assert auth_client.get("/api/auth/personal-credential/me", headers=auth_header(new_key)).status_code == 200

def test_member_lifecycle_and_role_boundaries(auth_client: TestClient) -> None:
    admin_token = login(auth_client, "13800138000", "AdminPass!123")["access_token"]
    headers = auth_header(admin_token)
    response = auth_client.post("/api/users", headers=headers, json={
        "member_no": "MANAGER001", "initial_password": "ManagerPass!123",
        "name": "?????", "phone": "13800138001", "email": "manager@example.com",
        "department": "???", "role_code": "ADMIN", "status": "active",
    })
    assert response.status_code == 200, response.text
    created = response.json()["data"]
    assert created["temporary_password"] == "ManagerPass!123"
    member_no = created["member"]["member_no"]
    manager_token = login(auth_client, "13800138001", "ManagerPass!123")["access_token"]
    items = auth_client.get("/api/users", headers=auth_header(manager_token)).json()["data"]["items"]
    assert all(item["role_code"] != "SYSTEM_ADMIN" for item in items)
    assert auth_client.get("/api/users/ADMIN0001", headers=auth_header(manager_token)).status_code == 404
    reset = auth_client.post(f"/api/users/{member_no}/reset-password", headers=headers)
    new_password = reset.json()["data"]["temporary_password"]
    assert auth_client.get("/api/auth/me", headers=auth_header(manager_token)).status_code == 401
    login(auth_client, "13800138001", new_password)
    assert auth_client.patch(f"/api/users/{member_no}/status", headers=headers, json={"status": "disabled"}).status_code == 200
    assert auth_client.post("/api/auth/login", json={"phone": "13800138001", "password": new_password}).status_code == 403
    assert auth_client.patch(f"/api/users/{member_no}/status", headers=headers, json={"status": "active"}).status_code == 200
    assert auth_client.delete(f"/api/users/{member_no}", headers=headers).status_code == 200
    assert auth_client.get(f"/api/users/{member_no}", headers=headers).status_code == 404


def test_developer_cannot_manage_members(auth_client: TestClient) -> None:
    token = login(auth_client, "13800138000", "AdminPass!123")["access_token"]
    response = auth_client.post("/api/users", headers=auth_header(token), json={
        "member_no": "DEVELOPER001",
        "name": "???", "phone": "13800138002",
        "department": "???", "role_code": "DEVELOPER",
    })
    assert response.status_code == 200, response.text
    assert response.json()["data"]["member"]["email"] is None
    password = response.json()["data"]["temporary_password"]
    developer_token = login(auth_client, "13800138002", password)["access_token"]
    assert auth_client.get("/api/users", headers=auth_header(developer_token)).status_code == 403
    member_no = response.json()["data"]["member"]["member_no"]
    assert auth_client.put(f"/api/users/{member_no}/role", headers=auth_header(token), json={"role_code": "SYSTEM_ADMIN"}).status_code == 400
