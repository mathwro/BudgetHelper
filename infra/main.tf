module "static-website" {
  source                           = "github.com/mathwro/IAC-Library//Terraform/website-project?ref=main"
  resource_group_name              = "value"
  project_name                     = "value"
  existing_dns_zone_resource_group = "p-dns"
  existing_dns_zone_name           = "mwrobel.io"
  custom_domain                    = "https://mwrobel.io/projects/budget-helper"
  swa_sku                          = "Free"
  ENV_Variables                    = var.ENV_Variables
}