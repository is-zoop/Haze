from datetime import timedelta

import pytest

from app.core.exceptions import AppException
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    require_capabilities,
    verify_password,
)


def test_password_hash_and_verification() -> None:
    hashed_password = hash_password("correct horse battery staple")
    assert hashed_password != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed_password)
    assert not verify_password("wrong password", hashed_password)


def test_access_token_round_trip() -> None:
    token = create_access_token(
        "user-1",
        roles=["admin"],
        capabilities=["users.read", "users.write"],
    )
    payload = decode_access_token(token)
    assert payload.sub == "user-1"
    assert payload.roles == ["admin"]
    assert payload.capabilities == ["users.read", "users.write"]


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token("user-1", expires_delta=timedelta(seconds=-1))
    with pytest.raises(AppException) as exc_info:
        decode_access_token(token)
    assert exc_info.value.status_code == 401


def test_invalid_access_token_is_rejected() -> None:
    with pytest.raises(AppException) as exc_info:
        decode_access_token("not-a-jwt")
    assert exc_info.value.status_code == 401


def test_capability_dependency_accepts_and_rejects() -> None:
    permission = type("Permission", (), {"code": "users.read"})()
    role = type("Role", (), {"permissions": [permission]})()
    user = type("User", (), {"roles": [role]})()
    assert require_capabilities("users.read")(user) is user
    with pytest.raises(AppException) as exc_info:
        require_capabilities("users.write")(user)
    assert exc_info.value.status_code == 403
    assert exc_info.value.data == {"missing_capabilities": ["users.write"]}
