output "vpc_id" {
  value = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "Point api.taxipool.app CNAME to this"
  value       = aws_lb.api.dns_name
}

output "cloudfront_domain" {
  description = "Point admin.taxipool.app CNAME to this"
  value       = aws_cloudfront_distribution.admin.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by CI to create cache invalidations"
  value       = aws_cloudfront_distribution.admin.id
}

output "ecr_repository_url" {
  description = "Push Docker images here"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "rds_endpoint" {
  value     = aws_db_instance.postgres.address
  sensitive = true
}

output "redis_primary_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "admin_s3_bucket" {
  value = aws_s3_bucket.admin.bucket
}

output "github_actions_role_arn" {
  description = "Set as AWS_ROLE_ARN secret in GitHub"
  value       = aws_iam_role.github_actions.arn
}
