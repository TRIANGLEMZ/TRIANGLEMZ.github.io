#!/usr/bin/env python3
import argparse
import json
import os
import re
import secrets
import subprocess
import tempfile
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
SITE_DIR = ROOT / "halaman 1"
MEDIA_DIR = SITE_DIR / "published-media"
MANIFEST_PATH = SITE_DIR / "published-content.json"
HOST = "127.0.0.1"
PORT = 8769
MAX_MEDIA_SIZE = 90 * 1024 * 1024
MAX_MANIFEST_SIZE = 5 * 1024 * 1024
ALLOWED_MEDIA_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}
KINDS = {"video", "image", "sale", "process_video", "process_image"}
MANAGED_KINDS = {"video", "image", "process_video", "process_image"}
PUBLISH_LOCK = threading.Lock()


def git(*args, env=None, check=True, timeout=120):
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        env=env,
        check=check,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def clean_media_url(value):
    if not isinstance(value, str) or not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value
    local_path = value.lstrip("/")
    if (
        re.fullmatch(
            r"(?:video|poster-thumbnails|video-thumbnails|published-media)/[A-Za-z0-9._%/-]+",
            local_path,
        )
        or re.fullmatch(r"hamanan%20[12]/[A-Za-z0-9._%/-]+", local_path)
    ) and ".." not in unquote(local_path).split("/"):
        return value
    raise ValueError("Alamat media tidak valid.")


def clean_content_row(row):
    if not isinstance(row, dict) or row.get("kind") not in KINDS:
        raise ValueError("Jenis konten tidak valid.")
    return {
        "id": str(row.get("id", ""))[:100],
        "kind": row["kind"],
        "title": str(row.get("title", ""))[:160],
        "description": str(row.get("description", ""))[:1500],
        "category": str(row.get("category", ""))[:80],
        "media_url": clean_media_url(row.get("media_url", "")),
        "thumbnail_url": clean_media_url(row.get("thumbnail_url", "")),
        "link_url": clean_media_url(row.get("link_url", "")) if row.get("link_url") else "",
        "sort_order": int(row.get("sort_order", 0)),
    }


def clean_product_row(row):
    if not isinstance(row, dict):
        raise ValueError("Data produk tidak valid.")
    cover_url = clean_media_url(row.get("cover_url", ""))
    if not cover_url:
        raise ValueError("Sampul produk belum tersedia.")
    checkout_url = clean_media_url(row.get("checkout_url", ""))
    if not urlparse(checkout_url).scheme in {"http", "https"}:
        raise ValueError("Link pembelian produk tidak valid.")
    preview_type = row.get("preview_type", "none")
    if preview_type not in {"video", "youtube", "none"}:
        raise ValueError("Jenis preview produk tidak valid.")
    preview_url = clean_media_url(row.get("preview_url", "")) if row.get("preview_url") else ""
    if preview_type in {"video", "youtube"} and not preview_url:
        raise ValueError("Link preview produk belum tersedia.")
    price = float(row.get("price", -1))
    if not 0 <= price <= 9999999999.99:
        raise ValueError("Harga produk tidak valid.")
    return {
        "id": str(row.get("id", ""))[:100],
        "title": str(row.get("title", ""))[:160],
        "description": str(row.get("description", ""))[:1500],
        "asset_type": str(row.get("asset_type", ""))[:100],
        "price": price,
        "cover_url": cover_url,
        "preview_url": preview_url,
        "preview_type": preview_type,
        "checkout_url": checkout_url,
        "sort_order": int(row.get("sort_order", 0)),
    }


def safe_unreferenced_media(previous, current):
    current_urls = set()
    for row in current["content"]:
        current_urls.update((row["media_url"], row["thumbnail_url"]))
    for row in current["products"]:
        if row["cover_url"].startswith("published-media/"):
            current_urls.add(row["cover_url"])
        if row["preview_type"] == "video" and row["preview_url"].startswith("published-media/"):
            current_urls.add(row["preview_url"])

    previous_urls = set()
    for row in previous.get("content", []):
        if isinstance(row, dict):
            previous_urls.update(
                value for value in (row.get("media_url"), row.get("thumbnail_url"))
                if isinstance(value, str) and value.startswith("published-media/")
            )
    for row in previous.get("products", []):
        if isinstance(row, dict):
            previous_urls.update(
                value for value in (row.get("cover_url"), row.get("preview_url"))
                if isinstance(value, str) and value.startswith("published-media/")
            )

    for media_url in previous_urls - current_urls:
        name = media_url.removeprefix("published-media/")
        if not re.fullmatch(r"[A-Za-z0-9._-]+", name):
            continue
        path = (MEDIA_DIR / name).resolve()
        if path.parent == MEDIA_DIR.resolve():
            path.unlink(missing_ok=True)


class PublisherHandler(SimpleHTTPRequestHandler):
    server_version = "PortoStudioPublisher/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format_string, *args):
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _check_origin(self, allow_missing=False):
        if self.headers.get("Host") != f"{HOST}:{PORT}":
            self._json(403, {"error": "Alamat publisher tidak diizinkan."})
            return False
        origin = self.headers.get("Origin")
        if origin != f"http://{HOST}:{PORT}" and not (
            allow_missing and origin is None and self.headers.get("Sec-Fetch-Site") == "same-origin"
        ):
            self._json(403, {"error": "Permintaan harus berasal dari situs lokal."})
            return False
        return True

    def _check_token(self):
        if not self._check_origin():
            return False
        if self.headers.get("Authorization") != f"Bearer {self.server.publish_token}":
            self._json(403, {"error": "Sesi publisher tidak valid. Muat ulang admin lokal."})
            return False
        return True

    def do_GET(self):
        if self.path == "/_publisher/status":
            if not self._check_origin(allow_missing=True):
                return
            self._json(200, {
                "enabled": True,
                "token": self.server.publish_token,
                "max_media_size": MAX_MEDIA_SIZE,
            })
            return
        if self.path.startswith("/_publisher/"):
            self._json(404, {"error": "Endpoint publisher tidak ditemukan."})
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in {"/_publisher/media", "/_publisher/publish"}:
            self._json(404, {"error": "Endpoint publisher tidak ditemukan."})
            return
        if not self._check_token():
            return
        if path == "/_publisher/media":
            self._upload_media()
        else:
            self._publish()

    def _request_size(self, maximum):
        try:
            size = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._json(411, {"error": "Ukuran kiriman tidak terbaca."})
            return None
        if size < 1 or size > maximum:
            self._json(413, {"error": "Ukuran kiriman melewati batas."})
            return None
        return size

    def _upload_media(self):
        size = self._request_size(MAX_MEDIA_SIZE)
        if size is None:
            return
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        extension = ALLOWED_MEDIA_TYPES.get(content_type)
        if not extension:
            self._json(415, {"error": "Format media tidak diizinkan."})
            return
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        name = f"{uuid.uuid4().hex}{extension}"
        destination = MEDIA_DIR / name
        remaining = size
        try:
            with destination.open("xb") as output:
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Kiriman media terputus.")
                    output.write(chunk)
                    remaining -= len(chunk)
        except Exception as error:
            destination.unlink(missing_ok=True)
            self._json(400, {"error": str(error)})
            return
        self._json(201, {"url": f"published-media/{name}"})

    def _publish(self):
        size = self._request_size(MAX_MANIFEST_SIZE)
        if size is None:
            return
        try:
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise ValueError("Data publikasi tidak valid.")
            content_rows = payload.get("content", [])
            product_rows = payload.get("products", [])
            managed = payload.get("managed", {})
            if not isinstance(content_rows, list) or len(content_rows) > 2000:
                raise ValueError("Daftar konten tidak valid.")
            if not isinstance(product_rows, list) or len(product_rows) > 2000:
                raise ValueError("Daftar aset digital tidak valid.")
            if not isinstance(managed, dict):
                raise ValueError("Status konten terkelola tidak valid.")
            cleaned_managed = {
                kind: bool(managed.get(kind, False))
                for kind in MANAGED_KINDS
            }
            manifest = {
                "content": [clean_content_row(row) for row in content_rows],
                "products": [clean_product_row(row) for row in product_rows],
                "managed": cleaned_managed,
            }
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError, OverflowError) as error:
            self._json(400, {"error": f"Data publikasi ditolak: {error}"})
            return

        with PUBLISH_LOCK:
            try:
                if self.server.dry_run:
                    self._json(200, {
                        "published": False,
                        "message": "Validasi publisher berhasil (mode uji; tidak ada perubahan ditulis ke Git).",
                    })
                    return
                if git("branch", "--show-current").stdout.strip() != "main":
                    raise RuntimeError("Branch lokal harus main sebelum menerbitkan.")
                git("remote", "get-url", "origin")
                git("fetch", "origin")
                if git("merge-base", "--is-ancestor", "origin/main", "HEAD", check=False).returncode:
                    raise RuntimeError("GitHub main memiliki perubahan baru. Sinkronkan branch main lalu coba lagi.")
                ahead_commits = git("rev-list", "--reverse", "origin/main..HEAD").stdout.splitlines()
                for commit_sha in ahead_commits:
                    subject = git("show", "-s", "--format=%s", commit_sha).stdout.strip()
                    if not subject.startswith("Publish portfolio content from admin"):
                        raise RuntimeError("Ada commit lokal lain yang belum dipublikasikan. Tinjau dan push branch main secara manual.")
                previous = {}
                if MANIFEST_PATH.exists():
                    previous = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
                safe_unreferenced_media(previous, manifest)
                MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(
                    mode="w", encoding="utf-8", dir=SITE_DIR, delete=False
                ) as output:
                    json.dump(manifest, output, ensure_ascii=False, separators=(",", ":"))
                    output.write("\n")
                    temporary_manifest = Path(output.name)
                os.replace(temporary_manifest, MANIFEST_PATH)
                temporary_index = tempfile.NamedTemporaryFile(prefix="porto-index-", delete=False)
                temporary_index.close()
                env = os.environ.copy()
                env["GIT_INDEX_FILE"] = temporary_index.name
                try:
                    git("read-tree", "HEAD", env=env)
                    git(
                        "add", "-A", "--", "halaman 1/published-content.json",
                        "halaman 1/published-media",
                        env=env,
                    )
                    staged = git("diff", "--cached", "--quiet", env=env, check=False)
                    if staged.returncode == 0:
                        if ahead_commits:
                            push_env = os.environ.copy()
                            push_env["GIT_TERMINAL_PROMPT"] = "0"
                            git("push", "origin", "HEAD:main", env=push_env, timeout=120)
                            commit = git("rev-parse", "--short", "HEAD").stdout.strip()
                            self._json(200, {
                                "published": True,
                                "commit": commit,
                                "message": "Publikasi GitHub yang tertunda berhasil dikirim. Situs publik berubah setelah GitHub Pages selesai deployment.",
                            })
                            return
                        self._json(200, {"published": False, "message": "Tidak ada perubahan untuk diterbitkan."})
                        return
                    if staged.returncode != 1:
                        raise RuntimeError("Tidak dapat memeriksa perubahan Git.")
                    git(
                        "add", "-A", "--", "halaman 1/published-content.json",
                        "halaman 1/published-media",
                        env=env,
                    )
                    git("commit", "-m", "Publish portfolio content from admin", env=env)
                    push_env = os.environ.copy()
                    push_env["GIT_TERMINAL_PROMPT"] = "0"
                    git("push", "origin", "HEAD:main", env=push_env, timeout=120)
                    commit = git("rev-parse", "--short", "HEAD").stdout.strip()
                finally:
                    Path(temporary_index.name).unlink(missing_ok=True)
                self._json(200, {
                    "published": True,
                    "commit": commit,
                    "message": "Konten berhasil dikirim ke GitHub. Situs publik diperbarui setelah deployment GitHub Pages selesai.",
                })
            except subprocess.CalledProcessError as error:
                detail = (error.stderr or error.stdout or str(error)).strip()
                self._json(500, {"error": f"Git gagal menerbitkan konten: {detail[-1200:]}"})
            except Exception as error:
                self._json(500, {"error": f"Gagal menerbitkan konten: {error}"})


def main():
    parser = argparse.ArgumentParser(description="Publish local Porto Studio admin changes to GitHub Pages.")
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--dry-run", action="store_true", help="Validate publisher requests without writing or pushing.")
    args = parser.parse_args()
    if args.port != PORT:
        raise SystemExit(f"Port publisher harus {PORT} agar sesuai dengan admin.")
    try:
        if git("branch", "--show-current").stdout.strip() != "main":
            raise SystemExit("Pindah ke branch main sebelum menjalankan publisher.")
        git("remote", "get-url", "origin")
    except subprocess.CalledProcessError as error:
        raise SystemExit((error.stderr or str(error)).strip()) from error

    server = ThreadingHTTPServer((HOST, PORT), PublisherHandler)
    server.publish_token = secrets.token_urlsafe(32)
    server.dry_run = args.dry_run
    print(f"Admin publisher aktif: http://{HOST}:{PORT}/admin/", flush=True)
    print(
        "Mode uji aktif; tidak ada commit atau push." if args.dry_run
        else "Simpan perubahan admin untuk menerbitkannya ke GitHub Pages.",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPublisher dihentikan.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
