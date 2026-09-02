import logging
import sys
from redis import Redis
from rq import Worker, Queue, Connection
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("praxirence.worker")

listen_queues = ["praxirence_whatsapp", "praxirence_reminders", "default"]


def run_worker():
    try:
        redis_conn = Redis.from_url(settings.REDIS_URL)
        logger.info(f"Connecting to Redis at {settings.REDIS_URL}...")
        with Connection(redis_conn):
            worker = Worker(map(Queue, listen_queues))
            logger.info(f"Worker listening on queues: {', '.join(listen_queues)}")
            worker.work()
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_worker()
