from __future__ import annotations

import json
import shutil
import stat
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Any, Literal
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.exceptions import AppException

MAX_ICON_SIZE = 2 * 1024 * 1024
MAX_PACKAGE_SIZE = 10 * 1024 * 1024
MAX_ZIP_FILES = 500
MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024
MAX_MANIFEST_SIZE = 1024 * 1024
UPLOAD_TTL = timedelta(minutes=30)
ICON_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}


def _storage_root() -> Path:
    root = get_settings().local_storage_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _token_dir() -> Path:
    path = _storage_root() / "uploads" / "tokens"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _raise_upload(message: str, *, code: int = 4005) -> None:
    raise AppException(code=code, message=message, status_code=400)


def _safe_name(name: str | None) -> str:
    clean = Path(name or "upload").name.strip()
    return clean[:255] or "upload"


def _validate_icon(data: bytes, file_name: str) -> None:
    suffix = Path(file_name).suffix.lower()
    if suffix not in ICON_SIGNATURES:
        _raise_upload("Icon must be PNG, JPEG, or WebP")
    if suffix == ".webp":
        if len(data) < 12 or not data.startswith(b"RIFF") or data[8:12] != b"WEBP":
            _raise_upload("Invalid WebP image")
    elif not any(data.startswith(signature) for signature in ICON_SIGNATURES[suffix]):
        _raise_upload("Invalid image content")


def _safe_zip_path(name: str) -> PurePosixPath:
    if not name or "\\" in name or name.startswith(("/", "\\")):
        _raise_upload("ZIP contains an unsafe path")
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        _raise_upload("ZIP contains an unsafe path")
    return path


def _parse_package(data: bytes, capability_type: str | None) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    try:
        archive = ZipFile(BytesIO(data))
    except BadZipFile as exc:
        raise AppException(code=4006, message="Invalid ZIP package", status_code=400) from exc

    with archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_ZIP_FILES:
            _raise_upload("ZIP must contain between 1 and 500 entries")
        total_size = 0
        files: list[dict[str, Any]] = []
        manifests: dict[str, Any] = {}
        has_skill_md = False
        for info in infos:
            path = _safe_zip_path(info.filename)
            if info.flag_bits & 0x1:
                _raise_upload("Encrypted ZIP entries are not supported")
            file_type = (info.external_attr >> 16) & 0o170000
            if file_type == stat.S_IFLNK:
                _raise_upload("ZIP symbolic links are not supported")
            if info.is_dir():
                continue
            total_size += info.file_size
            if total_size > MAX_UNCOMPRESSED_SIZE:
                _raise_upload("ZIP uncompressed size exceeds 50MB")
            files.append({"name": path.as_posix(), "size": info.file_size})
            if path.name.upper() == "SKILL.MD":
                has_skill_md = True
            if capability_type is not None and path.name in {"mcp.json", "package.json"}:
                if info.file_size > MAX_MANIFEST_SIZE:
                    _raise_upload(f"{path.name} exceeds 1MB")
                try:
                    value = json.loads(archive.read(info).decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise AppException(code=4007, message=f"Invalid {path.name}", status_code=400) from exc
                if not isinstance(value, dict):
                    _raise_upload(f"{path.name} must contain a JSON object")
                manifests[path.name] = value
        if not files:
            _raise_upload("ZIP package contains no files")
        if capability_type == "skill" and not has_skill_md:
            _raise_upload("Skill ZIP must contain SKILL.md")
        return files, manifests or None


async def create_upload(
    upload: UploadFile,
    *,
    kind: Literal["icon", "package", "documentation"],
    actor_id: int,
    capability_type: Literal["skill", "mcp"] | None = None,
) -> dict[str, Any]:
    file_name = _safe_name(upload.filename)
    limit = MAX_ICON_SIZE if kind == "icon" else MAX_PACKAGE_SIZE
    data = await upload.read(limit + 1)
    await upload.close()
    if not data:
        _raise_upload("Uploaded file is empty")
    if len(data) > limit:
        _raise_upload("Icon exceeds 2MB" if kind == "icon" else "ZIP exceeds 10MB")

    files: list[dict[str, Any]] = []
    manifest = None
    if kind == "icon":
        _validate_icon(data, file_name)
    else:
        if Path(file_name).suffix.lower() != ".zip":
            _raise_upload("Package must be a ZIP file")
        if kind == "package" and capability_type is None:
            _raise_upload("Capability type is required for package upload")
        files, manifest = _parse_package(data, capability_type if kind == "package" else None)

    token = uuid4().hex
    expires_at = datetime.now(timezone.utc) + UPLOAD_TTL
    token_dir = _token_dir()
    payload_path = token_dir / f"{token}.bin"
    metadata_path = token_dir / f"{token}.json"
    payload_path.write_bytes(data)
    metadata = {
        "token": token,
        "actor_id": actor_id,
        "kind": kind,
        "capability_type": capability_type,
        "file_name": file_name,
        "size": len(data),
        "expires_at": expires_at.isoformat(),
        "files": files,
        "manifest": manifest,
        "payload_path": str(payload_path),
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
    return metadata
def peek_upload(
    token: str,
    *,
    actor_id: int,
    kind: Literal["icon", "package", "documentation"],
    capability_type: str | None = None,
) -> dict[str, Any]:
    if not token or not token.isalnum() or len(token) != 32:
        _raise_upload("Invalid upload token", code=4008)
    metadata_path = _token_dir() / f"{token}.json"
    if not metadata_path.exists():
        _raise_upload("Upload token not found or already used", code=4044)
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AppException(code=4008, message="Invalid upload token", status_code=400) from exc
    expires_at = datetime.fromisoformat(metadata["expires_at"])
    payload_path = Path(metadata["payload_path"])
    if expires_at <= datetime.now(timezone.utc) or not payload_path.exists():
        payload_path.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
        raise AppException(code=4101, message="Upload token expired", status_code=410)
    if metadata.get("actor_id") != actor_id:
        raise AppException(code=4033, message="Upload token belongs to another user", status_code=403)
    if metadata.get("kind") != kind:
        _raise_upload("Upload token kind mismatch", code=4008)
    if capability_type and metadata.get("capability_type") != capability_type:
        _raise_upload("Upload token capability type mismatch", code=4008)
    return metadata


def consume_upload(metadata: dict[str, Any], *, destination: Path) -> tuple[str, dict[str, Any]]:
    root = _storage_root()
    destination = (root / destination).resolve()
    if root not in destination.parents:
        _raise_upload("Invalid storage destination")
    destination.parent.mkdir(parents=True, exist_ok=True)
    source = Path(metadata["payload_path"])
    shutil.move(str(source), destination)
    (_token_dir() / f"{metadata['token']}.json").unlink(missing_ok=True)
    relative_path = destination.relative_to(root).as_posix()
    file_meta = {
        "path": relative_path,
        "name": metadata["file_name"],
        "size": metadata["size"],
        "files": metadata.get("files", []),
        "manifest": metadata.get("manifest"),
    }
    return relative_path, file_meta



def resolve_stored_file(relative_path: str) -> Path:
    root = _storage_root()
    target = (root / relative_path).resolve()
    if root not in target.parents or not target.is_file():
        raise AppException(code=4045, message="Stored file not found", status_code=404)
    return target
def delete_stored_files(paths: set[str]) -> None:
    root = _storage_root()
    for relative in paths:
        if not relative:
            continue
        target = (root / relative).resolve()
        if root in target.parents and target.is_file():
            target.unlink(missing_ok=True)

def delete_capability_directory(capability_id: int) -> None:
    root = _storage_root()
    target = (root / "capabilities" / str(capability_id)).resolve()
    capabilities_root = (root / "capabilities").resolve()
    if target.parent == capabilities_root and target.is_dir():
        shutil.rmtree(target)
