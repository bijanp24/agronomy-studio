output "auth_db_endpoint" {
  description = "RDS auth database endpoint."
  value       = aws_db_instance.auth_db.endpoint
}

output "auth_db_secret_arn" {
  description = "Secrets Manager ARN for auth database credentials."
  value       = aws_secretsmanager_secret.auth_db.arn
}

output "redshift_endpoint" {
  description = "Redshift Serverless endpoint."
  value       = aws_redshiftserverless_workgroup.analytics.endpoint
}

output "redshift_secret_arn" {
  description = "Secrets Manager ARN for Redshift admin credentials."
  value       = aws_secretsmanager_secret.redshift.arn
}
