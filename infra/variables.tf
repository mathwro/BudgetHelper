variable "project_name" {
  description = "The name of the project."
  type        = string
}

variable "subscription_id" {
  description = "The subscription ID for the Azure resources."
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group."
  type        = string
}

variable "location" {
  description = "The Azure region where resources will be created."
  type        = string
  default     = "West Europe"
}

variable "environment" {
  description = "The environment (prod or dev)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "dev"], var.environment)
    error_message = "Environment must be either 'prod' or 'dev'."
  }
}

variable "swa_sku" {
  description = "The SKU for the Static Web App (Free, Standard, or Premium)"
  type        = string
  default     = "Free"

  validation {
    condition     = contains(["Free", "Standard"], var.swa_sku)
    error_message = "swa_sku must be one of 'Free' or 'Standard'."
  }
}

variable "custom_domain" {
  description = "The custom domain name for the static web app"
  type        = string

  validation {
    condition     = trimspace(var.custom_domain) != ""
    error_message = "custom_domain is required and must be a hostname or URL."
  }

  validation {
    condition = can(regex(
      "^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$",
      trim(split(":", split("/", replace(replace(trimspace(var.custom_domain), "https://", ""), "http://", ""))[0])[0], ".")
    ))
    error_message = "custom_domain must contain a valid hostname (for example 'website.com', 'projects.website.com', or 'https://website.com/projects/my-project')."
  }

  validation {
    condition = (
      trimspace(var.existing_dns_zone_name) == "" ||
      lower(trim(split(":", split("/", replace(replace(trimspace(var.custom_domain), "https://", ""), "http://", ""))[0])[0], ".")) == lower(trimspace(var.existing_dns_zone_name)) ||
      endswith(lower(trim(split(":", split("/", replace(replace(trimspace(var.custom_domain), "https://", ""), "http://", ""))[0])[0], ".")), ".${lower(trimspace(var.existing_dns_zone_name))}")
    )
    error_message = "The hostname in custom_domain must match existing_dns_zone_name (apex) or be a subdomain of it."
  }
}

variable "existing_dns_zone_name" {
  description = "The name of an existing DNS zone to use for the custom domain"
  type        = string
  default     = ""

  validation {
    condition     = trimspace(var.existing_dns_zone_name) != ""
    error_message = "existing_dns_zone_name is required (for example 'website.com')."
  }
}

variable "existing_dns_zone_resource_group" {
  description = "The resource group name of the existing DNS zone"
  type        = string
  default     = ""

  validation {
    condition     = trimspace(var.existing_dns_zone_resource_group) != ""
    error_message = "existing_dns_zone_resource_group is required."
  }
}

variable "ENV_Variables" {
  description = "The Google Client ID for authentication"
  type        = map(string)
  sensitive   = true
  default     = {}
}