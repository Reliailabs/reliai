from __future__ import annotations

import gc
from inspect import iscoroutinefunction
from typing import Any

from ..client import ReliaiClient


def instrument_fastapi(client: ReliaiClient) -> bool:
    try:
        import fastapi.routing as routing  # type: ignore
    except Exception:
        return False

    apiroute = getattr(routing, "APIRoute", None)
    apirouter = getattr(routing, "APIRouter", None)
    request_response = getattr(routing, "request_response", lambda handler: handler)
    if apiroute is None or apirouter is None:
        return False

    _patch_route_handler(apiroute, client)
    _patch_router(apirouter, apiroute, request_response)
    _instrument_existing_routes(apiroute, request_response)
    return True


def _patch_route_handler(apiroute: type[Any], client: ReliaiClient) -> None:
    original = getattr(apiroute, "get_route_handler", None)
    if not callable(original) or getattr(original, "__reliai_fastapi_patched__", False):
        return

    def wrapped(self: Any, *args: Any, **kwargs: Any):
        handler = original(self, *args, **kwargs)
        if getattr(handler, "__reliai_fastapi_wrapped__", False):
            return handler

        if iscoroutinefunction(handler):

            async def instrumented(request: Any) -> Any:
                metadata = _request_metadata(self, request)
                with client.span("fastapi.request", metadata) as span:
                    try:
                        response = await handler(request)
                    except Exception as exc:
                        span.set_metadata({"http.status_code": _status_from_exception(exc)})
                        raise
                    span.set_metadata({"http.status_code": getattr(response, "status_code", 200)})
                    return response

        else:

            def instrumented(request: Any) -> Any:
                metadata = _request_metadata(self, request)
                with client.span("fastapi.request", metadata) as span:
                    try:
                        response = handler(request)
                    except Exception as exc:
                        span.set_metadata({"http.status_code": _status_from_exception(exc)})
                        raise
                    span.set_metadata({"http.status_code": getattr(response, "status_code", 200)})
                    return response

        setattr(instrumented, "__reliai_fastapi_wrapped__", True)
        return instrumented

    setattr(wrapped, "__reliai_fastapi_patched__", True)
    setattr(apiroute, "get_route_handler", wrapped)


def _patch_router(apirouter: type[Any], apiroute: type[Any], request_response: Any) -> None:
    original = getattr(apirouter, "add_api_route", None)
    if not callable(original) or getattr(original, "__reliai_fastapi_patched__", False):
        return

    def wrapped(self: Any, *args: Any, **kwargs: Any):
        result = original(self, *args, **kwargs)
        route = getattr(self, "routes", [])[-1] if getattr(self, "routes", None) else None
        if route is not None and isinstance(route, apiroute):
            route.app = request_response(route.get_route_handler())
        return result

    setattr(wrapped, "__reliai_fastapi_patched__", True)
    setattr(apirouter, "add_api_route", wrapped)


def _instrument_existing_routes(apiroute: type[Any], request_response: Any) -> None:
    for candidate in gc.get_objects():
        try:
            if isinstance(candidate, apiroute):
                candidate.app = request_response(candidate.get_route_handler())
        except Exception:
            continue


def _request_metadata(route: Any, request: Any) -> dict[str, Any]:
    url = getattr(request, "url", None)
    path = getattr(url, "path", None) or getattr(route, "path", None)
    method = getattr(request, "method", None)
    if method is None:
        methods = getattr(route, "methods", None)
        if methods:
            method = sorted(methods)[0]
    return {
        "framework": "fastapi",
        "auto_instrumented": True,
        "http.method": method,
        "http.path": path,
    }


def _status_from_exception(exc: Exception) -> int:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int):
        return status_code
    return 500
