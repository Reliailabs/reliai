from datetime import datetime

from pydantic import BaseModel


class SchedulerJobRead(BaseModel):
    job_name: str
    last_run: datetime | None = None
    next_run: datetime | None = None
    status: str


class SchedulerStatusResponse(BaseModel):
    jobs: list[SchedulerJobRead]
