#!/bin/bash
# Monitor scraper progress

echo "=========================================="
echo "SCRAPER PROGRESS MONITOR"
echo "$(date)"
echo "=========================================="
echo ""

echo "=== EDMONTON (Task: bb2e2b7) ==="
if [ -f /tmp/claude/-Users-mike/tasks/bb2e2b7.output ]; then
  # Show last 20 lines
  tail -20 /tmp/claude/-Users-mike/tasks/bb2e2b7.output
  echo ""
  # Progress and activity count
  EDMONTON_PROGRESS=$(grep -o 'Progress: [0-9]*/[0-9]* ([0-9]*%)' /tmp/claude/-Users-mike/tasks/bb2e2b7.output | tail -1)
  EDMONTON_COUNT=$(grep -o 'Total.*activities' /tmp/claude/-Users-mike/tasks/bb2e2b7.output | tail -1)
  echo "Latest Progress: $EDMONTON_PROGRESS"
  echo "Latest Total: $EDMONTON_COUNT"
else
  echo "Not started yet"
fi

echo ""
echo "=== CALGARY (Task: b9e3941) ==="
if [ -f /tmp/claude/-Users-mike/tasks/b9e3941.output ]; then
  # Show last 20 lines
  tail -20 /tmp/claude/-Users-mike/tasks/b9e3941.output
  echo ""
  # Progress and activity count
  CALGARY_PROGRESS=$(grep -o 'Progress: [0-9]*/[0-9]* ([0-9]*%)' /tmp/claude/-Users-mike/tasks/b9e3941.output | tail -1)
  CALGARY_COUNT=$(grep -o 'Total.*activities' /tmp/claude/-Users-mike/tasks/b9e3941.output | tail -1)
  echo "Latest Progress: $CALGARY_PROGRESS"
  echo "Latest Total: $CALGARY_COUNT"
else
  echo "Not started yet"
fi

echo ""
echo "=========================================="
echo "Run 'bash scripts/monitor-scrapers.sh' to refresh"
echo "=========================================="
