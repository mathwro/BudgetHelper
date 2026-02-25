terraform {
  backend "azurerm" {
    # Backend configuration will be provided via terraform init parameters
    # or environment variables during CI/CD execution
  }
}