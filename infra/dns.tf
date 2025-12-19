# DNS A record for subdomain pointing to the droplet
resource "digitalocean_record" "haven" {
  domain = var.base_domain
  type   = "A"
  name   = var.subdomain
  value  = digitalocean_droplet.haven.ipv4_address
  ttl    = 300
}
