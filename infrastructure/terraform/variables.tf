variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"   # Mumbai — close to Indian user base
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "project" {
  description = "Project name prefix for all resource names"
  type        = string
  default     = "taxipool"
}

# ── VPC ────────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

# ── ECS ────────────────────────────────────────────────────────────────────────
variable "api_image" {
  description = "ECR image URI for the API (e.g. 123456789.dkr.ecr.region.amazonaws.com/taxipool-api:latest)"
  type        = string
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "api_cpu" {
  type    = number
  default = 512   # 0.5 vCPU
}

variable "api_memory" {
  type    = number
  default = 1024  # 1 GB
}

# ── RDS ────────────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "db_name" {
  type    = string
  default = "taxipool"
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

# ── ElastiCache ────────────────────────────────────────────────────────────────
variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

# ── Admin panel ────────────────────────────────────────────────────────────────
variable "admin_domain" {
  type    = string
  default = "admin.taxipool.app"
}

variable "api_domain" {
  type    = string
  default = "api.taxipool.app"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1 for CloudFront)"
  type        = string
}

variable "acm_certificate_arn_regional" {
  description = "ACM certificate ARN in ap-south-1 for ALB"
  type        = string
}
