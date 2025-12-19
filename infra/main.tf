terraform {
  required_version = ">= 1.6.3"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

locals {
  # Compute full domain from base_domain and subdomain
  full_domain = "${var.subdomain}.${var.base_domain}"
}

# Droplet resource
resource "digitalocean_droplet" "haven" {
  image    = "ubuntu-22-04-x64"
  name     = "haven-${var.environment}"
  region   = var.region
  size     = var.droplet_size
  ssh_keys = [var.ssh_fingerprint]

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    domain        = local.full_domain
    email         = var.letsencrypt_email
    ghcr_username = var.ghcr_username
    ghcr_pat      = var.ghcr_pat
  })

  tags = ["haven", var.environment]
}

# Firewall
resource "digitalocean_firewall" "haven" {
  name = "haven-${var.environment}-fw"

  droplet_ids = [digitalocean_droplet.haven.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow all outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
