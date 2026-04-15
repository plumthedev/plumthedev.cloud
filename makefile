SHELL := /bin/bash
.PHONY: claude

claude:
	@if [ -f .env.claude ]; then set -a; . ./.env.claude; set +a; fi;
	claude --model qwen3-coder:30b


ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://ai-node.home:11434 ANTHROPIC_API_KEY="" claude --model qwen3-coder:30b