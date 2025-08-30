#!/bin/bash

# CRITICAL: Prevent deployments to wrong GCP project
CURRENT_PROJECT=$(gcloud config get-value project)
CORRECT_PROJECT="kids-activity-tracker-2024"
FORBIDDEN_PROJECT="elevated-pod-459203-n5"

if [ "$CURRENT_PROJECT" = "$FORBIDDEN_PROJECT" ]; then
    echo "❌ ERROR: You are in the WRONG project!"
    echo "   Current: $CURRENT_PROJECT (Murmans Picks)"
    echo "   This is the Kids Activity Tracker - must use: $CORRECT_PROJECT"
    echo ""
    echo "🔄 Switching to correct project..."
    gcloud config set project $CORRECT_PROJECT
    echo "✅ Now using: $CORRECT_PROJECT"
    echo ""
elif [ "$CURRENT_PROJECT" != "$CORRECT_PROJECT" ]; then
    echo "⚠️  WARNING: Not in Kids Activity Tracker project"
    echo "   Current: $CURRENT_PROJECT"
    echo "   Expected: $CORRECT_PROJECT"
    echo ""
    echo "🔄 Switching to correct project..."
    gcloud config set project $CORRECT_PROJECT
    echo "✅ Now using: $CORRECT_PROJECT"
else
    echo "✅ Correct project: $CORRECT_PROJECT"
fi

export GCLOUD_PROJECT=$CORRECT_PROJECT