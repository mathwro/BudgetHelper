variable "subscription_id" {
  description = "The subscription ID for the Azure resources."
  type        = string
}

variable "ENV_Variables" {
  description = "The Google Client ID for authentication"
  type        = map(string)
  sensitive   = true
  default     = {}
}