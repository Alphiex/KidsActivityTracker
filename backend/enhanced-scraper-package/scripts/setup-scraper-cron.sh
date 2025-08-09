#!/bin/bash

# Setup cron job for automatic activity scraping
# This script sets up a daily cron job to run the enhanced scraper

echo "🕐 Setting up automatic scraper cron job..."
echo "=========================================="

# Create the cron script
cat > /home/ubuntu/run-activity-scraper.sh << 'EOF'
#!/bin/bash
# NVRC Activity Scraper Cron Script

# Set up environment
export PATH=/usr/local/bin:/usr/bin:/bin
export NODE_ENV=production

# Log file
LOG_FILE="/home/ubuntu/KidsActivityTracker/backend/logs/cron-scraper-$(date +%Y%m%d).log"

echo "Starting scheduled scraper run at $(date)" >> "$LOG_FILE"

# Change to backend directory
cd /home/ubuntu/KidsActivityTracker/backend

# Run the enhanced scraper
./scripts/run-enhanced-scraper.sh >> "$LOG_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    echo "Scraper completed successfully at $(date)" >> "$LOG_FILE"
else
    echo "Scraper failed at $(date)" >> "$LOG_FILE"
    # Send alert (you can add email notification here)
fi

echo "----------------------------------------" >> "$LOG_FILE"
EOF

# Make the script executable
chmod +x /home/ubuntu/run-activity-scraper.sh

# Add to crontab (runs daily at 2 AM)
# First, check if the cron job already exists
if crontab -l 2>/dev/null | grep -q "run-activity-scraper.sh"; then
    echo "⚠️  Cron job already exists!"
    echo "Current cron jobs:"
    crontab -l | grep "run-activity-scraper.sh"
else
    # Add the cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/run-activity-scraper.sh") | crontab -
    echo "✅ Cron job added successfully!"
fi

echo ""
echo "📅 Scraper Schedule:"
echo "  - Runs daily at 2:00 AM server time"
echo "  - Logs are saved to: backend/logs/"
echo "  - Activities are automatically imported to database"
echo ""
echo "To view cron jobs: crontab -l"
echo "To edit cron jobs: crontab -e"
echo "To remove cron job: crontab -r"
echo ""
echo "✅ Cron setup complete!"