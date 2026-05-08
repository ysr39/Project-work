# ── ECR Repository ────────────────────────────────────────────────────────────
resource "aws_ecr_repository" "api" {
  name                 = "${local.prefix}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${local.prefix}-api-ecr" }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${local.prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ── CloudWatch Log Group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.prefix}/api"
  retention_in_days = 30
}

# ── Task Definition ───────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",        value = "production" },
      { name = "PORT",            value = "3000" },
      { name = "DATABASE_HOST",   value = aws_db_instance.postgres.address },
      { name = "DATABASE_PORT",   value = tostring(aws_db_instance.postgres.port) },
      { name = "DATABASE_NAME",   value = var.db_name },
      { name = "DATABASE_SSL",    value = "true" },
      { name = "REDIS_HOST",      value = aws_elasticache_replication_group.redis.primary_endpoint_address },
      { name = "REDIS_PORT",      value = "6379" },
      { name = "REDIS_TLS",       value = "true" },
      { name = "FRONTEND_URL",    value = "https://${var.admin_domain}" },
      { name = "ADMIN_URL",       value = "https://${var.admin_domain}" },
    ]

    # Secrets from SSM Parameter Store (populated separately)
    secrets = [
      { name = "DATABASE_USER",             valueFrom = "/${var.project}/${var.environment}/DATABASE_USER" },
      { name = "DATABASE_PASSWORD",         valueFrom = "/${var.project}/${var.environment}/DATABASE_PASSWORD" },
      { name = "REDIS_PASSWORD",            valueFrom = "/${var.project}/${var.environment}/REDIS_PASSWORD" },
      { name = "JWT_SECRET",                valueFrom = "/${var.project}/${var.environment}/JWT_SECRET" },
      { name = "JWT_REFRESH_SECRET",        valueFrom = "/${var.project}/${var.environment}/JWT_REFRESH_SECRET" },
      { name = "STRIPE_SECRET_KEY",         valueFrom = "/${var.project}/${var.environment}/STRIPE_SECRET_KEY" },
      { name = "STRIPE_WEBHOOK_SECRET",     valueFrom = "/${var.project}/${var.environment}/STRIPE_WEBHOOK_SECRET" },
      { name = "TWILIO_ACCOUNT_SID",        valueFrom = "/${var.project}/${var.environment}/TWILIO_ACCOUNT_SID" },
      { name = "TWILIO_AUTH_TOKEN",         valueFrom = "/${var.project}/${var.environment}/TWILIO_AUTH_TOKEN" },
      { name = "TWILIO_PHONE_NUMBER",       valueFrom = "/${var.project}/${var.environment}/TWILIO_PHONE_NUMBER" },
      { name = "GOOGLE_MAPS_API_KEY",       valueFrom = "/${var.project}/${var.environment}/GOOGLE_MAPS_API_KEY" },
      { name = "AWS_ACCESS_KEY_ID",         valueFrom = "/${var.project}/${var.environment}/AWS_ACCESS_KEY_ID" },
      { name = "AWS_SECRET_ACCESS_KEY",     valueFrom = "/${var.project}/${var.environment}/AWS_SECRET_ACCESS_KEY" },
      { name = "FIREBASE_PROJECT_ID",       valueFrom = "/${var.project}/${var.environment}/FIREBASE_PROJECT_ID" },
      { name = "FIREBASE_PRIVATE_KEY",      valueFrom = "/${var.project}/${var.environment}/FIREBASE_PRIVATE_KEY" },
      { name = "FIREBASE_CLIENT_EMAIL",     valueFrom = "/${var.project}/${var.environment}/FIREBASE_CLIENT_EMAIL" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# ── Application Load Balancer ─────────────────────────────────────────────────
resource "aws_lb" "api" {
  name               = "${local.prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb"
    enabled = true
  }
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${local.prefix}-alb-logs-${local.account_id}"
  force_destroy = false
}

resource "aws_lb_target_group" "api" {
  name        = "${local.prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 3600
    enabled         = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn_regional

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ── ECS Service ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "api" {
  name                               = "${local.prefix}-api-service"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.api_desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 120
  force_new_deployment               = true

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener.https]
}

# ── Auto Scaling ──────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "api" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.prefix}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 65.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${local.prefix}-api-mem-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
