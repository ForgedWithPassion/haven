output "droplet_ip" {
  description = "Public IP address of the droplet"
  value       = digitalocean_droplet.haven.ipv4_address
}

output "droplet_id" {
  description = "ID of the droplet"
  value       = digitalocean_droplet.haven.id
}

output "droplet_urn" {
  description = "URN of the droplet"
  value       = digitalocean_droplet.haven.urn
}

output "app_url" {
  description = "Application URL"
  value       = "https://${local.full_domain}"
}

output "websocket_url" {
  description = "WebSocket URL for relay"
  value       = "wss://${local.full_domain}/ws"
}
