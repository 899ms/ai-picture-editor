from app.tasks.generate import generate_images
from app.tasks.ping import ping

TASKS = [ping, generate_images]

__all__ = ["TASKS", "generate_images", "ping"]
