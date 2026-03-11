from datetime import datetime

from pydantic import BaseModel


class ArchiveStatusRead(BaseModel):
    archive_dir: str
    archived_partitions: int
    pending_partitions: int
    last_archive_at: datetime | None = None
