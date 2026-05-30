import datetime
import json
import logging
from pathlib import Path

_LOG_DIR = Path("data")
_LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("http_log")
_handler = logging.FileHandler(str(_LOG_DIR / "http.log"), encoding="utf-8", mode="a")
_handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def _resumir(body: bytes, max_len: int = 500) -> str:
    texto = body.decode("utf-8", errors="replace") if body else ""
    if len(texto) <= max_len:
        return texto
    return texto[:max_len] + f"... (truncado, total {len(texto)} chars)"


def _separador() -> str:
    return "─" * 80


class HTTPLogMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        path = scope.get("path", "")
        query = scope.get("query_string", b"").decode()
        ts = datetime.datetime.now().isoformat()

        body_chunks = []

        async def receive_wrapper():
            msg = await receive()
            if msg["type"] == "http.request":
                body_chunks.append(msg.get("body", b""))
            return msg

        class LogSend:
            def __init__(self, send):
                self.send = send
                self.status = None
                self.resp_headers = []
                self.resp_body = bytearray()

            async def __call__(self, msg):
                if msg["type"] == "http.response.start":
                    self.status = msg["status"]
                    self.resp_headers = msg.get("headers", [])
                elif msg["type"] == "http.response.body":
                    self.resp_body.extend(msg.get("body", b""))
                await self.send(msg)

        log_send = LogSend(send)

        try:
            await self.app(scope, receive_wrapper, log_send)
        except Exception as exc:
            log_send.status = 500
            log_send.resp_body = bytearray(str(exc).encode())

        req_body = b"".join(body_chunks)
        url = f"{path}?{query}" if query else path
        resp_text = _resumir(bytes(log_send.resp_body))
        req_text = _resumir(req_body)

        content_type = ""
        for k, v in log_send.resp_headers:
            if k == b"content-type":
                content_type = v.decode()

        lines = [
            _separador(),
            f"[{ts}] {method} {url}",
            f"Status: {log_send.status}",
            f"Content-Type: {content_type}",
            f"Request body: {req_text}" if req_text else "",
            f"Response body: {resp_text}" if resp_text and content_type != "application/zip" else "",
        ]
        logger.info("\n".join(line for line in lines if line))
