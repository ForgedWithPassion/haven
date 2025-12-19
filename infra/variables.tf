variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "ssh_fingerprint" {
  description = "SSH key fingerprint for droplet access"
  type        = string
}

variable "base_domain" {
  description = "Base domain name (e.g., forge3d.com)"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for the application (e.g., haven)"
  type        = string
  default     = "haven"
}

variable "domain" {
  description = "Full domain name for the application (computed from base_domain and subdomain)"
  type        = string
  default     = ""
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "fra1"
}

variable "droplet_size" {
  description = "Droplet size slug"
  type        = string
  default     = "s-1vcpu-1gb"
}

variable "ghcr_username" {
  description = "GitHub Container Registry username"
  type        = string
}

variable "ghcr_pat" {
  description = "GitHub Container Registry Personal Access Token (with read:packages scope)"
  type        = string
  sensitive   = true
}

variable "spaces_access_key" {
  description = "DigitalOcean Spaces access key"
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key"
  type        = string
  sensitive   = true
}

variable "spaces_bucket" {
  description = "DigitalOcean Spaces bucket name for Terraform state"
  type        = string
  default     = "haven-terraform-state"
}

variable "spaces_region" {
  description = "DigitalOcean Spaces region"
  type        = string
  default     = "fra1"
}
