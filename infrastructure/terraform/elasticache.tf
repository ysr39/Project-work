# ── ElastiCache Redis (cluster mode disabled, primary + replica) ───────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"   # enable keyspace notifications for TTL expiry (OTP, etc.)
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.prefix}-redis"
  description          = "TaxiPool Redis cluster"

  node_type            = var.redis_node_type
  num_cache_clusters   = 2   # primary + one replica
  port                 = 6379
  engine_version       = "7.1"
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 3
  snapshot_window          = "02:00-03:00"

  tags = { Name = "${local.prefix}-redis" }
}
