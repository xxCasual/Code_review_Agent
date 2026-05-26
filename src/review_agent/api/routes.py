import logging
from collections.abc import Callable

from fastapi import APIRouter, BackgroundTasks, HTTPException

from review_agent.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ReviewCreateRequest,
    ReviewCreateResponse,
    ReviewResponse,
)
from review_agent.demo import build_demo_artifacts
from review_agent.errors import ReviewAgentError, public_error_message
from review_agent.observability import get_logger, log_event
from review_agent.services.review_service import ReviewService
from review_agent.services.review_store import ReviewStore
from review_agent.tools.report_tools import markdown_report_renderer

logger = get_logger(__name__)
REVIEW_NOT_FOUND = "review not found"


def create_router(
    store: ReviewStore,
    service: ReviewService | None = None,
    session_service=None,
    service_factory: Callable[[], ReviewService] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    @router.get("/demo-report", response_model=ReviewResponse)
    def demo_report() -> ReviewResponse:
        pr_meta, findings, evidence = build_demo_artifacts()
        return ReviewResponse(
            review_id="demo",
            thread_id="demo",
            pr_url=pr_meta.html_url,
            status="succeeded",
            findings=findings,
            final_report=markdown_report_renderer(pr_meta, findings, evidence),
            error=None,
        )

    @router.post("/reviews", response_model=ReviewCreateResponse)
    def create_review(request: ReviewCreateRequest, background_tasks: BackgroundTasks) -> ReviewCreateResponse:
        review = store.create_review(request.pr_url)
        background_tasks.add_task(
            _run_review_job,
            store,
            service,
            session_service,
            review.review_id,
            request.pr_url,
            service_factory,
        )
        return ReviewCreateResponse(
            review_id=review.review_id,
            thread_id=review.thread_id,
            status=review.status,
        )

    @router.get("/reviews/{review_id}", response_model=ReviewResponse)
    def get_review(review_id: str) -> ReviewResponse:
        review = store.get_review(review_id)
        if review is None:
            raise HTTPException(status_code=404, detail=REVIEW_NOT_FOUND)
        return ReviewResponse.from_session(review)

    @router.post("/reviews/{review_id}/chat", response_model=ChatResponse)
    def chat(review_id: str, request: ChatRequest) -> ChatResponse:
        review = store.get_review(review_id)
        if review is None:
            raise HTTPException(status_code=404, detail=REVIEW_NOT_FOUND)
        if session_service is not None:
            answer = session_service.chat(review_id, request.message)
        else:
            answer = "Chat memory is not configured for this app instance."
        return ChatResponse(answer=answer, review_id=review.review_id, thread_id=review.thread_id)

    return router


def _run_review_job(
    store,
    service,
    session_service,
    review_id: str,
    pr_url: str,
    service_factory: Callable[[], ReviewService] | None = None,
) -> None:
    log_event(
        logger,
        logging.INFO,
        "review_job.start",
        "Review job started",
        review_id=review_id,
        stage="review_job",
    )
    store.mark_running(review_id)
    active_service = service_factory() if service_factory is not None else service
    if active_service is None:
        store.save_failed(review_id, "ReviewService is not configured for this app instance.")
        return
    try:
        result = active_service.review_pr(pr_url, review_id=review_id)
    except ReviewAgentError as exc:
        store.save_failed(review_id, public_error_message(exc))
        logger.exception(
            "Review job failed",
            extra={
                "event": "review_job.failure",
                "review_id": review_id,
                "stage": "review_job",
                "error_code": exc.code,
            },
        )
        return
    except Exception as exc:  # pragma: no cover - defensive boundary around background jobs
        store.save_failed(review_id, public_error_message(exc))
        logger.exception(
            "Review job failed unexpectedly",
            extra={
                "event": "review_job.failure",
                "review_id": review_id,
                "stage": "review_job",
                "error_code": "internal.unexpected",
            },
        )
        return
    store.save_success(review_id, result.findings, result.final_report)
    if session_service is not None:
        session_service.save_review(review_id, result.findings, result.final_report)
    log_event(
        logger,
        logging.INFO,
        "review_job.success",
        "Review job succeeded",
        review_id=review_id,
        stage="review_job",
    )
