terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
  ])
  
  service = each.value
  disable_on_destroy = false
}

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "postgres" {
  name             = "kids-activity-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier = "db-f1-micro" # Change to larger instance for production
    
    ip_configuration {
      ipv4_enabled    = true
      private_network = null
      
      authorized_networks {
        name  = "allow-cloud-run"
        value = "0.0.0.0/0" # Restrict this in production
      }
    }
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }
    
    database_flags {
      name  = "max_connections"
      value = "50"
    }
  }
  
  deletion_protection = true
}

# Database
resource "google_sql_database" "app_db" {
  name     = "kidsactivity"
  instance = google_sql_database_instance.postgres.name
}

# Database user
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_user" "app_user" {
  name     = "appuser"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

# Redis instance
resource "google_redis_instance" "cache" {
  name           = "kids-activity-redis-${var.environment}"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region
  
  redis_version = "REDIS_7_0"
  display_name  = "Kids Activity Tracker Redis"
  
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
      }
    }
  }
}

# Secrets
resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  
  secret_data = "postgresql://${google_sql_user.app_user.name}:${google_sql_user.app_user.password}@${google_sql_database_instance.postgres.public_ip_address}:5432/${google_sql_database.app_db.name}?sslmode=require"
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "redis-url"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret = google_secret_manager_secret.redis_url.id
  
  secret_data = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
}

# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "kids-activity-cloud-run"
  display_name = "Kids Activity Cloud Run Service Account"
}

# Grant necessary permissions
resource "google_project_iam_member" "cloud_run_permissions" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/redis.editor",
    "roles/secretmanager.secretAccessor",
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Scheduler for hourly scraping
resource "google_cloud_scheduler_job" "scraper" {
  name             = "kids-activity-scraper"
  description      = "Triggers activity scraping every hour"
  schedule         = "0 * * * *" # Every hour
  time_zone        = "America/Los_Angeles"
  attempt_deadline = "600s"
  
  http_target {
    http_method = "POST"
    uri         = "https://kids-activity-api-${var.project_id}.a.run.app/api/v1/scraper/trigger"
    
    body = base64encode(jsonencode({
      providerId = "all"
    }))
    
    headers = {
      "Content-Type" = "application/json"
    }
    
    oidc_token {
      service_account_email = google_service_account.cloud_run.email
    }
  }
  
  retry_config {
    retry_count = 3
  }
}

# Outputs
output "database_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "service_account_email" {
  value = google_service_account.cloud_run.email
}