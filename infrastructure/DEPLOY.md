# TaxiPool — Deployment Guide

## Architecture

```
Internet
   │
   ▼
Route 53
   ├── api.taxipool.app  ──► ALB (HTTPS/443) ──► ECS Fargate (API ×2)
   │                                                    │
   │                                              RDS PostgreSQL (Multi-AZ)
   │                                              ElastiCache Redis (+ replica)
   │
   └── admin.taxipool.app ──► CloudFront ──► S3 (static build)
```

---

## Prerequisites

| Tool        | Version |
|-------------|---------|
| Terraform   | ≥ 1.6   |
| AWS CLI     | ≥ 2.x   |
| Docker      | ≥ 24    |
| Node.js     | 20 LTS  |

---

## First-Time Setup

### 1. Bootstrap Terraform state bucket

```bash
aws s3 mb s3://taxipool-terraform-state --region ap-south-1
aws s3api put-bucket-versioning \
  --bucket taxipool-terraform-state \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name taxipool-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

### 2. Provision AWS infrastructure

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Save the outputs — you'll need them in the next steps:

```bash
terraform output -json > infra-outputs.json
```

### 3. Store secrets in SSM Parameter Store

```bash
# Repeat for each secret. Use SecureString type for all.
aws ssm put-parameter \
  --name "/taxipool/production/DATABASE_PASSWORD" \
  --value "YOUR_DB_PASSWORD" \
  --type SecureString \
  --region ap-south-1

# Required parameters:
#   DATABASE_USER, DATABASE_PASSWORD
#   REDIS_PASSWORD
#   JWT_SECRET, JWT_REFRESH_SECRET
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
#   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
#   GOOGLE_MAPS_API_KEY
#   FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY  (only if not using task role)
```

### 4. Set up GitHub repository secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret                | Value                                          |
|-----------------------|------------------------------------------------|
| `AWS_ROLE_ARN`        | From `terraform output github_actions_role_arn`|
| `ADMIN_S3_BUCKET`     | From `terraform output admin_s3_bucket`        |
| `CF_DISTRIBUTION_ID`  | From `terraform output cloudfront_distribution_id` |

### 5. Run initial DB migrations

```bash
# SSH into a temporary ECS task or run via a one-off Fargate task:
aws ecs run-task \
  --cluster taxipool-production-cluster \
  --task-definition taxipool-production-api \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["npx","typeorm","migration:run","-d","dist/database/data-source.js"]}]}'
```

### 6. Configure DNS

After `terraform apply`, point your DNS records:

```
api.taxipool.app    CNAME  <alb_dns_name>
admin.taxipool.app  CNAME  <cloudfront_domain>
```

### 7. Issue TLS certificates

```bash
# If not already done — certbot for Nginx (self-hosted) or
# request ACM certificates through the AWS Console for ALB/CloudFront.
# CloudFront certificate MUST be requested in us-east-1.
```

---

## Day-to-Day Deployments

All deployments are **automated via GitHub Actions** on push to `main`.

### Trigger a manual deploy

```bash
# Force a new ECS deployment (uses existing task definition):
aws ecs update-service \
  --cluster taxipool-production-cluster \
  --service taxipool-production-api-service \
  --force-new-deployment
```

### Roll back API

```bash
# List recent task definition revisions:
aws ecs list-task-definitions --family-prefix taxipool-production-api

# Roll back to a specific revision:
aws ecs update-service \
  --cluster taxipool-production-cluster \
  --service taxipool-production-api-service \
  --task-definition taxipool-production-api:N
```

### Roll back Admin panel

```bash
# List S3 object versions for index.html:
aws s3api list-object-versions \
  --bucket taxipool-production-admin-<account-id> \
  --prefix index.html

# Restore a specific version:
aws s3api copy-object \
  --bucket taxipool-production-admin-<account-id> \
  --copy-source "taxipool-production-admin-<account-id>/index.html?versionId=XXXXX" \
  --key index.html

# Invalidate CloudFront:
aws cloudfront create-invalidation \
  --distribution-id XXXXX \
  --paths "/*"
```

---

## Local Development

```bash
# Start all backing services (Postgres + Redis):
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# Run API in watch mode:
cd apps/api && npm run dev

# Run Admin in dev mode:
cd apps/admin && npm run dev
```

### Full local stack (containerized):

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

---

## Operations

### View API logs

```bash
aws logs tail /ecs/taxipool-production/api --follow
```

### Scale API manually

```bash
aws ecs update-service \
  --cluster taxipool-production-cluster \
  --service taxipool-production-api-service \
  --desired-count 4
```

### Connect to RDS (via bastion or SSM session)

```bash
# Open SSM port-forwarding session to RDS:
aws ssm start-session \
  --target <ecs-task-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<rds-endpoint>"],"portNumber":["5432"],"localPortNumber":["5432"]}'

psql -h localhost -U taxipool_admin -d taxipool
```

### Stripe webhook registration

Register endpoint after deploy:

```bash
stripe listen --forward-to https://api.taxipool.app/api/v1/payments/webhook
# For production, register via Stripe Dashboard:
# https://dashboard.stripe.com/webhooks
# Events to enable:
#   payment_intent.succeeded
#   payment_intent.payment_failed
#   payment_intent.canceled
#   charge.refund.updated
#   account.updated
#   transfer.failed
```

---

## Health Checks

| Endpoint                            | Expected |
|-------------------------------------|----------|
| `GET https://api.taxipool.app/api/health` | `200 { status: "ok" }` |
| `GET https://admin.taxipool.app`         | `200`                  |

---

## Cost Estimate (ap-south-1, ~100 daily active users)

| Resource              | Spec                    | Est. $/month |
|-----------------------|-------------------------|-------------|
| ECS Fargate (2 tasks) | 0.5 vCPU, 1 GB          | ~$30        |
| RDS PostgreSQL        | db.t3.medium, Multi-AZ  | ~$80        |
| ElastiCache Redis     | cache.t3.micro ×2       | ~$25        |
| ALB                   |                         | ~$20        |
| CloudFront + S3       | Admin static assets     | ~$5         |
| NAT Gateway (2)       |                         | ~$65        |
| **Total**             |                         | **~$225**   |
