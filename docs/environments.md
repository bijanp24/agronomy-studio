# Environments

Agronomy Studio should use three long-lived environments with promotion through GitHub:

| Environment | Branch | Frontend deploy | Data plane |
| --- | --- | --- | --- |
| Dev | `dev` | Netlify deploy alias `dev` | Isolated dev AWS resources |
| Test | `test` | Netlify deploy alias `test` | Isolated test AWS resources |
| Production | `master` | Netlify production deploy | Isolated production AWS resources |

## Pipeline

Pull requests into `dev`, `test`, and `master` run the CI workflow:

1. `npm ci`
2. `npm run test:ci`
3. `npm run build:prod`

Pushes to the environment branches run the Netlify deploy workflow:

1. `dev` builds with `npm run build:dev` and publishes a Netlify deploy alias named `dev`.
2. `test` builds with `npm run build:test` and publishes a Netlify deploy alias named `test`.
3. `master` builds with `npm run build:prod` and publishes the production Netlify deploy.

The workflow expects these GitHub repository secrets:

| Secret | Purpose |
| --- | --- |
| `NETLIFY_AUTH_TOKEN` | Netlify CLI token used to publish deploys |
| `NETLIFY_SITE_ID` | Netlify site identifier |

## Cloud Resources

The first infrastructure scaffold is AWS because Redshift is AWS-native. The Terraform starter under `infra/aws` creates:

- Amazon Redshift Serverless namespace and workgroup for analytics.
- Amazon RDS for PostgreSQL for auth/application relational data.
- Security groups scoped to configured CIDR ranges.
- Generated database credentials stored in AWS Secrets Manager.

The Terraform workflow is manual for applies. Pull requests only plan and validate infrastructure changes.

Required GitHub environment configuration:

| Name | Type | Purpose |
| --- | --- | --- |
| `AWS_ROLE_TO_ASSUME` | Secret | OIDC role GitHub Actions can assume |
| `AWS_REGION` | Variable | AWS region, defaults to `us-west-2` |

## Open Items

- Confirm whether auth belongs in this repo, an existing backend repo, or a new service.
- Confirm whether the auth database should be PostgreSQL, MySQL, or SQL Server. This scaffold uses PostgreSQL because it is the least coupled AWS option for application auth.
- Confirm VPC, subnet, and CIDR values before applying Terraform.
- Decide whether Netlify branch deploys alone are enough, or whether all deploys should be driven by GitHub Actions as currently scaffolded.
