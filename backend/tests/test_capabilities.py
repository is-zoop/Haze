from __future__ import annotations

from collections.abc import Generator
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile

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
from app.modules.capabilities.models import Capability
from app.modules.marketplace.models import CapabilityDownloadLog
from app.modules.mcp_runtime.models import McpCallLog


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def _login(client: TestClient, phone: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"phone": phone, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


@pytest.fixture
def capability_client(tmp_path: Path) -> Generator[tuple[TestClient, dict[str, dict[str, str]], sessionmaker[Session]], None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    Base.metadata.create_all(engine)
    settings = get_settings()
    original_storage = settings.local_storage_dir
    settings.local_storage_dir = tmp_path / "storage"
    settings.initial_admin_name = "admin"
    settings.initial_admin_phone = "13800138000"
    settings.initial_admin_email = "admin@example.com"
    settings.initial_admin_password = "AdminPass!123"
    settings.initial_admin_department = "Platform"
    with TestingSession() as session:
        bootstrap(session)

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSession() as session:
            yield session

    application = create_app()
    application.dependency_overrides[get_db] = override_get_db
    with TestClient(application, raise_server_exceptions=False) as client:
        admin = _login(client, "13800138000", "AdminPass!123")
        headers: dict[str, dict[str, str]] = {"admin": admin}
        category_response = client.post("/api/business-categories", headers=admin, json={"name": "Engineering", "description": "Engineering capabilities"})
        assert category_response.status_code == 200, category_response.text
        for suffix, name in (("1", "Developer One"), ("2", "Developer Two")):
            response = client.post(
                "/api/users",
                headers=admin,
                json={
                    "name": name,
                    "member_no": f"DEV000{suffix}",
                    "phone": f"1380013800{suffix}",
                    "email": f"dev{suffix}@example.com",
                    "department": "Engineering",
                    "role_code": "DEVELOPER",
                    "status": "active",
                },
            )
            assert response.status_code == 200, response.text
            temporary_password = response.json()["data"]["temporary_password"]
            headers[f"dev{suffix}"] = _login(client, f"1380013800{suffix}", temporary_password)
        yield client, headers, TestingSession
    settings.local_storage_dir = original_storage


def _category_id(client: TestClient, headers: dict[str, str], name: str) -> int:
    response = client.get("/api/business-categories", headers=headers)
    assert response.status_code == 200, response.text
    return next(item["id"] for item in response.json()["data"] if item["name"] == name)


def _upload_package(client: TestClient, headers: dict[str, str], capability_type: str, files: dict[str, str]) -> dict:
    response = client.post(
        f"/api/developer/uploads/package?type={capability_type}",
        headers=headers,
        files={"file": (f"{capability_type}.zip", _zip_bytes(files), "application/zip")},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _create_capability(
    client: TestClient,
    headers: dict[str, str],
    *,
    code: str,
    capability_type: str,
) -> dict:
    files = {"SKILL.md": "# Skill"} if capability_type == "skill" else {"package.json": '{"name":"mcp-server"}'}
    upload = _upload_package(client, headers, capability_type, files)
    response = client.post(
        "/api/developer/capabilities",
        headers=headers,
        json={
            "code": code,
            "name": f"Capability {code}",
            "type": capability_type,
            "description": "Capability description",
            "category_id": _category_id(client, headers, "Engineering"),
            "version": "1.0.0",
            "tags": ["automation"],
            "config": {"transport": "HTTP"} if capability_type == "mcp" else {"skill_md": "SKILL.md"},
            "package_upload_token": upload["upload_token"],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_skill_lifecycle_versions_and_code_reuse(capability_client) -> None:
    client, headers, session_factory = capability_client
    icon = client.post(
        "/api/developer/uploads/icon",
        headers=headers["dev1"],
        files={"file": ("icon.png", b"\x89PNG\r\n\x1a\ncontent", "image/png")},
    )
    assert icon.status_code == 200, icon.text
    package = _upload_package(client, headers["dev1"], "skill", {"SKILL.md": "# Skill", "main.py": "print(1)"})
    created = client.post(
        "/api/developer/capabilities",
        headers=headers["dev1"],
        json={
            "code": "finance_skill",
            "name": "Finance Skill",
            "type": "skill",
            "description": "Analyze finance data",
            "category_id": _category_id(client, headers["dev1"], "\u8d22\u52a1"),
            "version": "v1.0.0",
            "tags": ["finance"],
            "config": {"skill_md": "SKILL.md"},
            "icon_upload_token": icon.json()["data"]["upload_token"],
            "package_upload_token": package["upload_token"],
        },
    )
    assert created.status_code == 200, created.text
    asset = created.json()["data"]
    assert asset["status"] == "draft"
    assert asset["recent_test_status"] == "none"
    assert asset["icon"] == f"/api/developer/capabilities/{asset['id']}/icon"
    assert client.get(asset["icon"], headers=headers["dev1"]).status_code == 200
    assert client.get(asset["icon"], headers=headers["dev2"]).status_code == 404

    versions = client.get(f"/api/developer/capabilities/{asset['id']}/versions", headers=headers["dev1"])
    assert versions.json()["data"]["total"] == 1
    assert client.get(f"/api/developer/capabilities/{asset['id']}", headers=headers["dev2"]).status_code == 404
    assert client.get(f"/api/developer/capabilities/{asset['id']}", headers=headers["admin"]).status_code == 200

    edited = client.patch(
        f"/api/developer/capabilities/{asset['id']}",
        headers=headers["dev1"],
        json={"name": "Finance Skill Updated", "tags": ["finance", "report"]},
    )
    assert edited.status_code == 200, edited.text
    submitted = client.post(f"/api/developer/capabilities/{asset['id']}/submit-review", headers=headers["dev1"])
    assert submitted.status_code == 200
    assert submitted.json()["data"]["status"] == "reviewing"
    with session_factory() as session:
        capability = session.get(Capability, asset["id"])
        assert capability is not None
        capability.status = "published"
        session.commit()
    version_upload = _upload_package(client, headers["dev1"], "skill", {"SKILL.md": "# Version 1.1"})
    versioned = client.post(
        f"/api/developer/capabilities/{asset['id']}/versions",
        headers=headers["dev1"],
        json={"version": "1.1.0", "changelog": "New report support", "package_upload_token": version_upload["upload_token"]},
    )
    assert versioned.status_code == 200, versioned.text
    assert versioned.json()["data"]["version"] == "1.1.0"
    assert versioned.json()["data"]["status"] == "reviewing"
    assert client.get(f"/api/developer/capabilities/{asset['id']}/versions", headers=headers["dev1"]).json()["data"]["total"] == 2
    assert client.post(f"/api/developer/capabilities/{asset['id']}/offline", headers=headers["dev1"]).json()["data"]["status"] == "offline"

    capability_storage = Path(get_settings().local_storage_dir) / "capabilities" / str(asset["id"])
    assert capability_storage.is_dir()
    deleted = client.delete(f"/api/developer/capabilities/{asset['id']}", headers=headers["dev1"])
    assert deleted.status_code == 200
    assert not capability_storage.exists()
    replacement = _create_capability(client, headers["dev1"], code="finance_skill", capability_type="skill")
    assert replacement["code"] == "finance_skill"


def test_mcp_publish_reviewing_test_result_and_filters(capability_client) -> None:
    client, headers, _session_factory = capability_client
    asset = _create_capability(client, headers["dev1"], code="database_mcp", capability_type="mcp")
    capability_id = asset["id"]
    denied = client.patch(
        f"/api/developer/capabilities/{capability_id}/test-status",
        headers=headers["dev1"],
        json={"status": "pass"},
    )
    assert denied.status_code == 403
    passed = client.patch(
        f"/api/developer/capabilities/{capability_id}/test-status",
        headers=headers["admin"],
        json={"status": "pass"},
    )
    assert passed.status_code == 200, passed.text
    assert passed.json()["data"]["recent_test_status"] == "pass"
    submitted = client.post(f"/api/developer/capabilities/{capability_id}/submit-review", headers=headers["dev1"])
    assert submitted.status_code == 200
    assert submitted.json()["data"]["status"] == "reviewing"
    listing = client.get(
        "/api/developer/capabilities?type=mcp&status=reviewing&search=database",
        headers=headers["dev1"],
    )
    assert listing.status_code == 200
    data = listing.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["code"] == "database_mcp"
    assert data["counts"]["reviewing"] == 1
    assert data["counts"]["mcp"] == 1


def _create_stdio_mcp(client: TestClient, headers: dict[str, str], *, code: str) -> dict:
    upload = _upload_package(client, headers, "mcp", {"package.json": '{"name":"mcp-server"}'})
    response = client.post(
        "/api/developer/capabilities",
        headers=headers,
        json={
            "code": code,
            "name": f"Capability {code}",
            "type": "mcp",
            "description": "Capability description",
            "category_id": _category_id(client, headers, "Engineering"),
            "version": "1.0.0",
            "tags": ["automation"],
            "config": {"transport": "STDIO", "startCommand": "node index.js"},
            "package_upload_token": upload["upload_token"],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_capability_status_flow_by_type(capability_client) -> None:
    client, headers, _session_factory = capability_client

    def status_of(cap_id: int) -> str:
        return client.get(f"/api/developer/capabilities/{cap_id}", headers=headers["dev1"]).json()["data"]["status"]

    def approve(cap_id: int) -> None:
        review = client.post(
            f"/api/audit/capabilities/{cap_id}/review",
            headers=headers["admin"],
            json={"action": "approved"},
        )
        assert review.status_code == 200, review.text
        assert review.json()["data"]["new_status"] == "approved"

    # Skill: draft -> reviewing -> approved -> published (跳过部署/调试)
    skill_id = _create_capability(client, headers["dev1"], code="flow_skill", capability_type="skill")["id"]
    assert client.post(f"/api/developer/capabilities/{skill_id}/publish", headers=headers["dev1"]).status_code == 409
    assert client.post(f"/api/developer/capabilities/{skill_id}/submit-review", headers=headers["dev1"]).json()["data"]["status"] == "reviewing"
    approve(skill_id)
    assert status_of(skill_id) == "approved"
    assert client.post(f"/api/developer/capabilities/{skill_id}/deploy", headers=headers["dev1"]).status_code == 409
    assert client.post(f"/api/developer/capabilities/{skill_id}/debug", headers=headers["dev1"]).status_code == 400
    assert client.post(f"/api/developer/capabilities/{skill_id}/publish", headers=headers["dev1"]).json()["data"]["status"] == "published"

    # HTTP MCP: draft -> reviewing -> approved -> deployed -> debug_passed -> published
    http_id = _create_capability(client, headers["dev1"], code="flow_http_mcp", capability_type="mcp")["id"]
    client.post(f"/api/developer/capabilities/{http_id}/submit-review", headers=headers["dev1"])
    approve(http_id)
    assert client.post(f"/api/developer/capabilities/{http_id}/publish", headers=headers["dev1"]).status_code == 409
    assert client.post(f"/api/developer/capabilities/{http_id}/debug", headers=headers["dev1"]).status_code == 409
    assert client.post(f"/api/developer/capabilities/{http_id}/deploy", headers=headers["dev1"]).json()["data"]["status"] == "deployed"
    assert client.post(f"/api/developer/capabilities/{http_id}/debug", headers=headers["dev1"]).json()["data"]["status"] == "debug_passed"
    assert client.post(f"/api/developer/capabilities/{http_id}/publish", headers=headers["dev1"]).json()["data"]["status"] == "published"

    # STDIO MCP: draft -> reviewing -> approved -> debug_passed -> published (跳过部署)
    stdio_id = _create_stdio_mcp(client, headers["dev1"], code="flow_stdio_mcp")["id"]
    client.post(f"/api/developer/capabilities/{stdio_id}/submit-review", headers=headers["dev1"])
    approve(stdio_id)
    assert client.post(f"/api/developer/capabilities/{stdio_id}/deploy", headers=headers["dev1"]).status_code == 409
    assert client.post(f"/api/developer/capabilities/{stdio_id}/debug", headers=headers["dev1"]).json()["data"]["status"] == "debug_passed"
    assert client.post(f"/api/developer/capabilities/{stdio_id}/publish", headers=headers["dev1"]).json()["data"]["status"] == "published"


def test_upload_validation_and_token_ownership(capability_client) -> None:
    client, headers, _session_factory = capability_client
    missing_skill = client.post(
        "/api/developer/uploads/package?type=skill",
        headers=headers["dev1"],
        files={"file": ("bad.zip", _zip_bytes({"README.md": "missing"}), "application/zip")},
    )
    assert missing_skill.status_code == 400
    unsafe = client.post(
        "/api/developer/uploads/package?type=mcp",
        headers=headers["dev1"],
        files={"file": ("unsafe.zip", _zip_bytes({"../evil.txt": "bad"}), "application/zip")},
    )
    assert unsafe.status_code == 400

    upload = _upload_package(client, headers["dev1"], "mcp", {"mcp.json": '{"transport":"stdio"}'})
    stolen = client.post(
        "/api/developer/capabilities",
        headers=headers["dev2"],
        json={
            "code": "stolen_mcp",
            "name": "Stolen MCP",
            "type": "mcp",
            "version": "1.0.0",
            "package_upload_token": upload["upload_token"],
        },
    )
    assert stolen.status_code == 403


def test_real_capability_call_counts(capability_client) -> None:
    client, headers, session_factory = capability_client
    skill = _create_capability(client, headers["dev1"], code="count_skill", capability_type="skill")
    stdio = _create_stdio_mcp(client, headers["dev1"], code="count_stdio")
    http = _create_capability(client, headers["dev1"], code="count_http", capability_type="mcp")

    with session_factory() as session:
        capabilities = [
            session.get(Capability, int(skill["id"])),
            session.get(Capability, int(stdio["id"])),
            session.get(Capability, int(http["id"])),
        ]
        for capability in capabilities:
            assert capability is not None
            capability.status = "published"
        session.add_all([
            McpCallLog(capability_id=int(http["id"]), asset_code="count_http", method="tools/call", success=True),
            McpCallLog(capability_id=int(http["id"]), asset_code="count_http", method="tools/call", success=False),
            McpCallLog(capability_id=int(http["id"]), asset_code="count_http", method="tools/list", success=True),
            McpCallLog(capability_id=int(http["id"]), asset_code="count_http", method="initialize", success=True),
        ])
        session.commit()

    link_response = client.post(
        f"/api/marketplace/capabilities/{skill['id']}/download-link",
        headers=headers["dev1"],
    )
    assert link_response.status_code == 200, link_response.text
    download_path = urlsplit(link_response.json()["data"]["download_url"]).path
    with session_factory() as session:
        assert session.query(CapabilityDownloadLog).count() == 0
    assert client.get(download_path).status_code == 200
    assert client.get(download_path).status_code == 200

    credential_response = client.get("/api/auth/me/mcp-credential", headers=headers["dev1"])
    assert credential_response.status_code == 200, credential_response.text
    personal_key = credential_response.json()["data"]["key"]
    direct_download = client.get(
        f"/api/marketplace/capabilities/{stdio['id']}/download",
        headers={"Authorization": f"Bearer {personal_key}"},
    )
    assert direct_download.status_code == 200, direct_download.text

    with session_factory() as session:
        skill_logs = session.query(CapabilityDownloadLog).filter_by(capability_id=int(skill["id"])).all()
        stdio_logs = session.query(CapabilityDownloadLog).filter_by(capability_id=int(stdio["id"])).all()
        assert len(skill_logs) == 2
        assert len(stdio_logs) == 1
        assert all(log.user_id is not None for log in skill_logs + stdio_logs)

    skill_detail = client.get(f"/api/developer/capabilities/{skill['id']}", headers=headers["dev1"])
    stdio_detail = client.get(f"/api/developer/capabilities/{stdio['id']}", headers=headers["dev1"])
    http_detail = client.get(f"/api/developer/capabilities/{http['id']}", headers=headers["dev1"])
    assert skill_detail.json()["data"]["calls"] == 2
    assert stdio_detail.json()["data"]["calls"] == 1
    assert http_detail.json()["data"]["calls"] == 1

    market = client.get("/api/marketplace/capabilities?page=1&page_size=100", headers=headers["dev1"])
    market_calls = {item["id"]: item["calls"] for item in market.json()["data"]["items"]}
    assert market_calls[str(skill["id"])] == 2
    assert market_calls[str(stdio["id"])] == 1
    assert market_calls[str(http["id"])] == 1

    overview = client.get("/api/home/overview", headers=headers["dev1"])
    assert overview.status_code == 200, overview.text
    home_items = (
        overview.json()["data"]["recommended"]
        + overview.json()["data"]["latest"]
        + overview.json()["data"]["popular"]
    )
    home_calls = {item["id"]: item["calls"] for item in home_items}
    assert home_calls[str(skill["id"])] == 2
    assert home_calls[str(stdio["id"])] == 1
    assert home_calls[str(http["id"])] == 1
