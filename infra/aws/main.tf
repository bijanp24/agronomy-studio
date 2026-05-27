locals {
  name_prefix = "${var.project_name}-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "random_password" "auth_db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "redshift" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "auth_db" {
  name        = "${local.name_prefix}/auth-db/master"
  description = "Master credentials for the ${local.name_prefix} auth database."
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "auth_db" {
  secret_id = aws_secretsmanager_secret.auth_db.id
  secret_string = jsonencode({
    username = var.auth_db_username
    password = random_password.auth_db.result
  })
}

resource "aws_secretsmanager_secret" "redshift" {
  name        = "${local.name_prefix}/redshift/admin"
  description = "Admin credentials for the ${local.name_prefix} Redshift namespace."
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "redshift" {
  secret_id = aws_secretsmanager_secret.redshift.id
  secret_string = jsonencode({
    username = var.redshift_admin_username
    password = random_password.redshift.result
  })
}

resource "aws_security_group" "auth_db" {
  name        = "${local.name_prefix}-auth-db"
  description = "Auth database access for ${local.name_prefix}."
  vpc_id      = var.vpc_id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "auth_db" {
  for_each = toset(var.allowed_cidr_blocks)

  security_group_id = aws_security_group.auth_db.id
  cidr_ipv4         = each.value
  from_port         = 5432
  ip_protocol       = "tcp"
  to_port           = 5432
}

resource "aws_vpc_security_group_egress_rule" "auth_db" {
  security_group_id = aws_security_group.auth_db.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_db_subnet_group" "auth_db" {
  name       = "${local.name_prefix}-auth-db"
  subnet_ids = var.private_subnet_ids
  tags       = local.tags
}

resource "aws_db_instance" "auth_db" {
  identifier             = "${local.name_prefix}-auth-db"
  allocated_storage      = var.auth_db_allocated_storage_gb
  db_name                = var.auth_db_name
  db_subnet_group_name   = aws_db_subnet_group.auth_db.name
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.auth_db_instance_class
  password               = random_password.auth_db.result
  publicly_accessible    = false
  skip_final_snapshot    = var.environment != "production"
  storage_encrypted      = true
  username               = var.auth_db_username
  vpc_security_group_ids = [aws_security_group.auth_db.id]
  tags                   = local.tags
}

resource "aws_security_group" "redshift" {
  name        = "${local.name_prefix}-redshift"
  description = "Redshift access for ${local.name_prefix}."
  vpc_id      = var.vpc_id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "redshift" {
  for_each = toset(var.allowed_cidr_blocks)

  security_group_id = aws_security_group.redshift.id
  cidr_ipv4         = each.value
  from_port         = 5439
  ip_protocol       = "tcp"
  to_port           = 5439
}

resource "aws_vpc_security_group_egress_rule" "redshift" {
  security_group_id = aws_security_group.redshift.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_redshiftserverless_namespace" "analytics" {
  namespace_name      = "${local.name_prefix}-analytics"
  db_name             = var.redshift_database_name
  admin_username      = var.redshift_admin_username
  admin_user_password = random_password.redshift.result
  tags                = local.tags
}

resource "aws_redshiftserverless_workgroup" "analytics" {
  workgroup_name      = "${local.name_prefix}-analytics"
  namespace_name      = aws_redshiftserverless_namespace.analytics.namespace_name
  base_capacity       = var.redshift_base_capacity
  publicly_accessible = false
  security_group_ids  = [aws_security_group.redshift.id]
  subnet_ids          = var.private_subnet_ids
  tags                = local.tags
}
