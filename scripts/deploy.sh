#!/bin/bash
set -e

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="formpilot-backend"

echo "Building and pushing container..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME backend/

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --session-affinity \
  --timeout 300 \
  --set-env-vars "GOOGLE_API_KEY=$(gcloud secrets versions access latest --secret=gemini-api-key)"

echo "Deployment Successful! URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
