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

variable "machine_id" {
  description = "Unique machine identifier used to avoid name collisions (e.g. firewall name)"
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

variable "firewall_enabled" {
  description = "Whether to create a firewall"
  type        = bool
  default     = true
}

variable "firewall_inbound_rules" {
  description = "List of inbound firewall rules"
  type = list(object({
    protocol         = string
    port_range       = string
    source_addresses = list(string)
  }))
  default = [
    { protocol = "tcp", port_range = "22", source_addresses = ["0.0.0.0/0", "::/0"] }
  ]
}

provider "digitalocean" {
  token = var.do_token
}

locals {
  // DO firewall names must be unique within an account, and must also match DO's
  // naming constraints. We sanitize user-provided droplet names to avoid 422 errors.
  //
  // Strategy:
  // - lowercase
  // - replace invalid chars with '-'
  // - collapse multiple '-' and trim leading/trailing '-'
  // - cap length (DO max is 64 chars)
  // - always include a machine_id-derived suffix for uniqueness
  name_lower         = lower(var.name)
  name_sanitized_1   = regexreplace(local.name_lower, "[^a-z0-9-]", "-")
  name_sanitized_2   = regexreplace(local.name_sanitized_1, "-{2,}", "-")
  name_sanitized     = trim(local.name_sanitized_2, "-")
  name_base          = length(local.name_sanitized) > 0 ? local.name_sanitized : "machine"
  firewall_name_raw  = "${local.name_base}-fw-${substr(var.machine_id, 0, 12)}"
  firewall_name      = trim(substr(local.firewall_name_raw, 0, 64), "-")
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
  count = var.firewall_enabled ? 1 : 0
  
  name = local.firewall_name
  
  droplet_ids = [digitalocean_droplet.main.id]
  
  dynamic "inbound_rule" {
    for_each = var.firewall_inbound_rules
    content {
      protocol         = inbound_rule.value.protocol
      port_range       = inbound_rule.value.port_range
      source_addresses = inbound_rule.value.source_addresses
    }
  }
  
  # All outbound allowed
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
  value = var.firewall_enabled ? digitalocean_firewall.main[0].id : null
}


