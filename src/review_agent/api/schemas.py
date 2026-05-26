import json

from pydantic import BaseModel

from review_agent.models.finding import Finding
from review_agent.models.session import ReviewSession


class ReviewCreateRequest(BaseModel):
    pr_url: str


class ReviewCreateResponse(BaseModel):
    review_id: str
    thread_id: str
    status: str


class ReviewResponse(BaseModel):
    review_id: str
    thread_id: str
    pr_url: str
    status: str
    findings: list[Finding]
    final_report: str | None = None
    error: str | None = None

    @classmethod
    def from_session(cls, session: ReviewSession) -> "ReviewResponse":
        return cls(
            review_id=session.review_id,
            thread_id=session.thread_id,
            pr_url=session.pr_url,
            status=session.status,
            findings=[Finding.model_validate(item) for item in json.loads(session.findings_json)],
            final_report=session.final_report,
            error=session.error,
        )


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    review_id: str
    thread_id: str


class HealthResponse(BaseModel):
    status: str
