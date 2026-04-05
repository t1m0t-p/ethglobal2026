#!/usr/bin/env bash
# launch.sh — Start all Hivera agents in a tmux split view
#
# Usage:
#   ./scripts/launch.sh          # launch all agents (real Hedera testnet)
#   ./scripts/launch.sh mock     # launch all agents in mock mode (no Hedera)
#   ./scripts/launch.sh demo     # launch the demo orchestrator in a single pane
#
# Layout (5 panes):
#   ┌──────────────────┬──────────────────┐
#   │   x402 Server    │    Judge         │
#   ├──────────────────┼──────────────────┤
#   │   Worker 1       │    Requester     │
#   ├──────────────────┤                  │
#   │   Worker 2       │                  │
#   └──────────────────┴──────────────────┘
#
# Controls:
#   Ctrl-b + arrow keys  — navigate between panes
#   Ctrl-b + z            — zoom/unzoom a pane (fullscreen toggle)
#   Ctrl-b + d            — detach (agents keep running in background)
#   Ctrl-c in any pane    — stop that agent
#
# To reattach after detach:
#   tmux attach -t hivera

SESSION="hivera"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-real}"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Helper: wrap a command so the pane stays open on exit (shows exit code + error)
run_cmd() {
  local label="$1"
  local delay="$2"
  local cmd="$3"
  echo "printf '\\033[1;36m══ ${label} ══\\033[0m\\n' && sleep ${delay} && { ${cmd}; EC=\$?; [ \$EC -ne 0 ] && printf '\\033[1;31m[ERROR] Exited with code \$EC — press Enter to close\\033[0m\\n' && read; } || true"
}

if [ "$MODE" = "demo" ]; then
  tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR"
  tmux send-keys -t "$SESSION" "npm run demo; echo '--- Done (exit $?) ---'; read" Enter
  tmux attach -t "$SESSION"
  exit 0
fi

if [ "$MODE" = "mock" ]; then
  X402_CMD="npm run x402-server"
  REQUESTER_CMD="npm run requester:mock"
  WORKER_CMD="npm run worker:mock"
  WORKER2_CMD="npm run worker:mock"
  JUDGE_CMD="npm run judge:mock"
  LABEL="MOCK MODE"
else
  X402_CMD="npm run x402-server"
  REQUESTER_CMD="npm run requester:interactive"
  WORKER_CMD="npm run worker"
  WORKER2_CMD="npm run worker2"
  JUDGE_CMD="npm run judge"
  LABEL="TESTNET MODE"
fi

# ── Build 5-pane layout ──
#
#  0 (top-left)    | 1 (top-right)
#  -----------------+---------------
#  2 (mid-left)    | 3 (right, tall)
#  -----------------+
#  4 (bot-left)    |

COLS=$(tput cols)
LINES=$(tput lines)

tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" -x "$COLS" -y "$LINES"

# Split right → pane 1 (right column)
tmux split-window -h -t "$SESSION:0.0" -c "$PROJECT_DIR"

# Split pane 0 down → pane 2 (mid-left, below x402)
tmux split-window -v -t "$SESSION:0.0" -c "$PROJECT_DIR"

# Split pane 2 down → pane 3 (bot-left, Worker 2)
tmux split-window -v -t "$SESSION:0.2" -c "$PROJECT_DIR"

# Split pane 1 down → pane 4 (bot-right, Requester)
tmux split-window -v -t "$SESSION:0.1" -c "$PROJECT_DIR"

# ── Send commands to each pane ──

# Pane 0 — x402 Server (top-left)
tmux select-pane -t "$SESSION:0.0" -T "x402-server"
tmux send-keys -t "$SESSION:0.0" "$(run_cmd 'x402 Server' 0 "$X402_CMD")" Enter

# Pane 2 — Worker 1 (mid-left), slight delay for x402 to come up
tmux select-pane -t "$SESSION:0.2" -T "worker-1"
tmux send-keys -t "$SESSION:0.2" "$(run_cmd 'Worker 1' 2 "$WORKER_CMD")" Enter

# Pane 3 — Worker 2 (bot-left), same delay
tmux select-pane -t "$SESSION:0.3" -T "worker-2"
tmux send-keys -t "$SESSION:0.3" "$(run_cmd 'Worker 2' 2 "$WORKER2_CMD")" Enter

# Pane 1 — Judge (top-right)
tmux select-pane -t "$SESSION:0.1" -T "judge"
tmux send-keys -t "$SESSION:0.1" "$(run_cmd 'Judge' 2 "$JUDGE_CMD")" Enter

# Pane 4 — Requester (bot-right), starts after workers+judge are up
tmux select-pane -t "$SESSION:0.4" -T "requester (interactive)"
tmux send-keys -t "$SESSION:0.4" "$(run_cmd 'Requester (interactive)' 4 "$REQUESTER_CMD")" Enter

# ── Status bar ──
tmux set-option -t "$SESSION" status-left "#[fg=black,bg=cyan,bold] HIVERA — $LABEL "
tmux set-option -t "$SESSION" status-right "#[fg=white] z=zoom | arrows=navigate | d=detach (prefix: Ctrl-b) "
tmux set-option -t "$SESSION" status-style "bg=colour236,fg=white"
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #[bold]#{pane_title}#[default] "

# Focus requester pane
tmux select-pane -t "$SESSION:0.4"

tmux attach -t "$SESSION"
