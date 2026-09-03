#!/usr/bin/env bash
set -e

# ==============================================================================
# Praxirence AWS Production Deployment Script
# Deploys FastAPI Backend Container to AWS ECR and AWS App Runner / ECS
# ==============================================================================

AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_REPO_NAME="praxirence-backend"
IMAGE_TAG="latest"

echo "🏥 Deploying Praxirence Backend to AWS (Region: $AWS_REGION)..."

# 1. Fetch AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

echo "✅ Detected AWS Account: $AWS_ACCOUNT_ID"

# 2. Create ECR repository if it does not exist
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || \
aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION" --image-scanning-configuration scanOnPush=true

# 3. Authenticate Docker with AWS ECR
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# 4. Build and Tag Docker Image
echo "🔨 Building backend Docker image..."
docker build -t "$ECR_REPO_NAME:$IMAGE_TAG" -f backend/Dockerfile backend/
docker tag "$ECR_REPO_NAME:$IMAGE_TAG" "$ECR_URI:$IMAGE_TAG"

# 5. Push Image to ECR
echo "🚀 Pushing image to ECR ($ECR_URI:$IMAGE_TAG)..."
docker push "$ECR_URI:$IMAGE_TAG"

echo "🎉 Docker image successfully deployed to AWS ECR!"
echo "To create or update the live AWS App Runner service, run:"
echo "aws apprunner create-service --cli-input-json file://deploy/aws/apprunner.json --region $AWS_REGION"
