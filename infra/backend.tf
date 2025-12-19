# Terraform backend configuration for DigitalOcean Spaces
# Requires Terraform >= 1.6.3
terraform {
  backend "s3" {
    # These values are provided via -backend-config flags in CI/CD
    # bucket = "haven-terraform-state"
    # key    = "terraform.tfstate"

    # DigitalOcean Spaces endpoint (Terraform 1.6.3+ format)
    endpoints = {
      s3 = "https://fra1.digitaloceanspaces.com"
    }

    # Required but not used by DO Spaces
    region = "us-east-1"

    # Deactivate AWS-specific checks (required for non-AWS S3 storage)
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }
}
