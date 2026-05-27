# AWS Infrastructure

This Terraform module is a starter for environment-isolated Agronomy Studio data resources.

It provisions:

- Redshift Serverless for analytics/query workloads.
- RDS PostgreSQL for auth and relational application data.
- Secrets Manager secrets for generated database credentials.
- Security groups for Redshift and RDS access.

## Usage

Create one tfvars file per environment under `env/`:

```bash
cp env/dev.tfvars.example env/dev.tfvars
```

Fill in the VPC, private subnet IDs, and allowed CIDR ranges, then run:

```bash
terraform init
terraform plan -var-file=env/dev.tfvars
```

Do not commit real `*.tfvars` files. Commit only `*.tfvars.example` files.

## State

This starter intentionally does not hard-code a Terraform backend. Before applying shared infrastructure, configure a remote backend such as S3 with DynamoDB locking or Terraform Cloud.
