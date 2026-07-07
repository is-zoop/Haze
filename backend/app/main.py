from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def _prepull_docker_images(images: list[str]) -> None:
    for image in images:
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "pull", image,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
            logger.info("Docker image ready: %s", image)
        except Exception as exc:
            logger.warning("Failed to pull Docker image %s: %s", image, exc)


@asynccontextmanager
async def _lifespan(app: FastAPI):  # noqa: ARG001
    settings = get_settings()
    if settings.mcp_docker_prepull:
        asyncio.get_event_loop().create_task(
            _prepull_docker_images(settings.mcp_docker_images)
        )
    yield
from app.core.exceptions import register_exception_handlers
from app.core.response import ApiResponse, success_response
from app.modules.auth.router import router as auth_router
from app.modules.capabilities.router import router as capabilities_router
from app.modules.audit.router import router as audit_router
from app.modules.marketplace.router import public_router as public_download_router
from app.modules.marketplace.router import router as marketplace_router
from app.modules.home.router import router as home_router
from app.modules.users.router import router as users_router
from app.modules.mcp_runtime.router import router as mcp_runtime_router
from app.modules.business_categories.router import router as business_categories_router

REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 128


def _get_request_id(request: Request) -> str:
    supplied_request_id = request.headers.get(REQUEST_ID_HEADER, "").strip()
    if supplied_request_id and len(supplied_request_id) <= MAX_REQUEST_ID_LENGTH:
        return supplied_request_id
    return str(uuid4())


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = _get_request_id(request)
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=_lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    application.add_middleware(RequestIdMiddleware)
    register_exception_handlers(application)
    application.include_router(auth_router)
    application.include_router(capabilities_router)
    application.include_router(audit_router)
    application.include_router(marketplace_router)
    application.include_router(public_download_router)
    application.include_router(home_router)
    application.include_router(users_router)
    application.include_router(mcp_runtime_router)
    application.include_router(business_categories_router)

    @application.get(
        "/api/health",
        response_model=ApiResponse[dict[str, str]],
        tags=["system"],
        summary="Application liveness check",
    )
    async def health(request: Request) -> ApiResponse[dict[str, str]]:
        return success_response(request, {"status": "ok"})

    @application.get(
        "/api/version",
        response_model=ApiResponse[dict[str, str]],
        tags=["system"],
        summary="Application version",
    )
    async def version(request: Request) -> ApiResponse[dict[str, str]]:
        return success_response(request, {"version": settings.app_version})

    return application


app = create_app()
