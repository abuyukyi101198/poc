.PHONY: build test lint typecheck clean

build:
	uv sync

test:
	uv run pytest

lint:
	uv run ruff check .
	uv run ruff format --check .

typecheck:
	uv run pyright

clean:
	rm -rf .venv dist *.egg-info .ruff_cache .pytest_cache .coverage
	find . -type d -name __pycache__ -exec rm -rf {} +
