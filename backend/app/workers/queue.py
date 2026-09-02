import logging
from typing import Callable, Any
from redis import Redis
from rq import Queue
from app.core.config import settings

logger = logging.getLogger("praxirence.queue")

redis_conn: Redis = None
whatsapp_queue: Queue = None
reminder_queue: Queue = None

try:
    redis_conn = Redis.from_url(settings.REDIS_URL)
    whatsapp_queue = Queue("praxirence_whatsapp", connection=redis_conn)
    reminder_queue = Queue("praxirence_reminders", connection=redis_conn)
    logger.info("Connected to Redis and initialized RQ queues.")
except Exception as e:
    logger.warning(f"Could not connect to Redis at {settings.REDIS_URL}: {e}. Tasks will run inline or simulated.")


def enqueue_task(queue_name: str, func: Callable, *args, **kwargs) -> Any:
    """
    Enqueues a task to Redis Queue. If Redis is unavailable, runs inline for safety.
    """
    try:
        if redis_conn:
            q = Queue(queue_name, connection=redis_conn)
            job = q.enqueue(func, *args, **kwargs)
            logger.info(f"Enqueued {func.__name__} to {queue_name} (Job ID: {job.id})")
            return job.id
    except Exception as e:
        logger.warning(f"Failed to enqueue to Redis: {e}. Executing inline.")

    # Inline execution fallback if Redis is down/absent
    try:
        return func(*args, **kwargs)
    except Exception as err:
        logger.error(f"Error running inline task {func.__name__}: {err}")
        return None
