#!/bin/bash
# Monitor scraper progress

echo "=========================================="
echo "SCRAPER PROGRESS MONITOR"
echo "$(date)"
echo "=========================================="
echo ""

echo "=== EDMONTON (Task: bb94796) ==="
if [ -f /tmp/claude/-Users-mike/tasks/bb94796.output ]; then
  # Show last 15 lines
  tail -15 /tmp/claude/-Users-mike/tasks/bb94796.output
  echo ""
  # Activity count
  EDMONTON_COUNT=$(grep -o 'Total: [0-9]* activities' /tmp/claude/-Users-mike/tasks/bb94796.output | tail -1)
  echo "Latest: $EDMONTON_COUNT"
else
  echo "Not started yet"
fi

echo ""
echo "=== CALGARY (Task: bf50185) ==="
if [ -f /tmp/claude/-Users-mike/tasks/bf50185.output ]; then
  # Show last 15 lines
  tail -15 /tmp/claude/-Users-mike/tasks/bf50185.output
  echo ""
  # Activity count
  CALGARY_COUNT=$(grep -o 'Total: [0-9]* activities' /tmp/claude/-Users-mike/tasks/bf50185.output | tail -1)
  echo "Latest: $CALGARY_COUNT"
else
  echo "Not started yet"
fi

echo ""
echo "=========================================="
echo "Run 'bash scripts/monitor-scrapers.sh' to refresh"
echo "=========================================="
