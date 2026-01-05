terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Droplet name"
  type        = string
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "size" {
  description = "Droplet size"
  type        = string
  default     = "s-1vcpu-1gb"
}

variable "image" {
  description = "Droplet image"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "ssh_keys" {
  description = "List of SSH key IDs or fingerprints"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to the droplet"
  type        = list(string)
  default     = []
}

variable "user_data" {
  description = "Cloud-init user data"
  type        = string
  default     = ""
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_droplet" "main" {
  name     = var.name
  region   = var.region
  size     = var.size
  image    = var.image
  ssh_keys = var.ssh_keys
  tags     = var.tags
  
  user_data = var.user_data != "" ? var.user_data : null
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "digitalocean_firewall" "main" {
  name = "${var.name}-fw"
  
  droplet_ids = [digitalocean_droplet.main.id]
  
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
  
  # All outbound
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

output "droplet_id" {
  value = digitalocean_droplet.main.id
}

output "public_ip" {
  value = digitalocean_droplet.main.ipv4_address
}

output "private_ip" {
  value = digitalocean_droplet.main.ipv4_address_private
}

output "status" {
  value = digitalocean_droplet.main.status
}

output "region" {
  value = digitalocean_droplet.main.region
}

output "size" {
  value = digitalocean_droplet.main.size
}

output "firewall_id" {
  value = digitalocean_firewall.main.id
}

