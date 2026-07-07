from __future__ import annotations

from typing import Any, Generic, TypeVar

from fastapi import Request
from pydantic import BaseModel, ConfigDict

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    model_config = ConfigDict(extra="forbid")

    code: int = 0
    message: str = "success"
    data: DataT
    request_id: str


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def success_response(request: Request, data: DataT) -> ApiResponse[DataT]:
    return ApiResponse(
        code=0,
        message="success",
        data=data,
        request_id=get_request_id(request),
    )


def error_payload(
    request: Request,
    *,
    code: int,
    message: str,
    data: Any | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "data": {} if data is None else data,
        "request_id": get_request_id(request),
    }
