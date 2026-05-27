variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = contains(["dev", "test", "production"], var.environment)
    error_message = "Environment must be dev, test, or production."
  }
}

variable "project_name" {
  description = "Project name used for resource naming."
  type        = string
  default     = "agronomy-studio"
}

variable "vpc_id" {
  description = "VPC ID where databases should be created."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS and Redshift."
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect to database endpoints."
  type        = list(string)
  default     = []
}

variable "auth_db_name" {
  description = "Initial auth database name."
  type        = string
  default     = "auth"
}

variable "auth_db_username" {
  description = "Auth database master username."
  type        = string
  default     = "auth_admin"
}

variable "auth_db_instance_class" {
  description = "RDS instance class for the auth database."
  type        = string
  default     = "db.t4g.micro"
}

variable "auth_db_allocated_storage_gb" {
  description = "Allocated RDS storage in GB."
  type        = number
  default     = 20
}

variable "redshift_database_name" {
  description = "Initial Redshift database name."
  type        = string
  default     = "agronomy"
}

variable "redshift_admin_username" {
  description = "Redshift admin username."
  type        = string
  default     = "redshift_admin"
}

variable "redshift_base_capacity" {
  description = "Redshift Serverless base RPU capacity."
  type        = number
  default     = 8
}
