terraform {
  required_version = ">= 1.9, < 2.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-east1"
}
variable "image" {
  type = string
  validation {
    condition     = can(regex("@sha256:[a-f0-9]{64}$", var.image))
    error_message = "Supply the immutable image digest built from landed main."
  }
}
variable "staging_bucket" { type = string }
variable "supabase_url" { type = string }
variable "service_role_secret" { type = string }
variable "service_role_version" { type = string }
variable "allowed_origins" { type = string }
variable "maintenance_paused" {
  type    = bool
  default = true
}
variable "oauth_secret" {
  type     = string
  default  = null
  nullable = true
}
variable "oauth_version" {
  type    = string
  default = "latest"
}

data "google_project" "current" {}
locals {
  api_url = "https://lookout-api-${data.google_project.current.number}.${var.region}.run.app"
  common = {
    SUPABASE_URL                  = var.supabase_url
    LOOKOUT_SEARCH_STAGING_BUCKET = google_storage_bucket.staging.name
    LOOKOUT_SUBMISSION_ENABLED    = "false"
  }
  api_env = merge(local.common, {
    LOOKOUT_PROCESS              = "api"
    LOOKOUT_EXECUTION_ENABLED    = "false"
    LOOKOUT_EVENT_DELIVERY_MODE  = "request"
    LOOKOUT_GCP_PROJECT          = var.project_id
    LOOKOUT_GCP_REGION           = var.region
    LOOKOUT_CLOUD_RUN_JOB        = google_cloud_run_v2_job.discovery.name
    LOOKOUT_ALLOWED_HOSTS        = trimprefix(local.api_url, "https://")
    LOOKOUT_ALLOWED_ORIGINS      = var.allowed_origins
    LOOKOUT_MAINTENANCE_AUDIENCE = local.api_url
    LOOKOUT_SCHEDULER_EMAIL      = google_service_account.scheduler.email
    LOOKOUT_OAUTH_ENABLED        = var.oauth_secret == null ? "false" : "true"
  })
}

resource "google_project_service" "required" {
  for_each           = toset(["run.googleapis.com", "cloudscheduler.googleapis.com", "storage.googleapis.com", "secretmanager.googleapis.com", "iam.googleapis.com"])
  service            = each.key
  disable_on_destroy = false
}

resource "google_service_account" "api" {
  account_id = "lookout-run-api"
  depends_on = [google_project_service.required]
}
resource "google_service_account" "worker" {
  account_id = "lookout-run-worker"
  depends_on = [google_project_service.required]
}
resource "google_service_account" "scheduler" {
  account_id = "lookout-run-scheduler"
  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "staging" {
  name                        = var.staging_bucket
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }
  depends_on = [google_project_service.required]
}
resource "google_storage_bucket_iam_member" "api" {
  bucket = google_storage_bucket.staging.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"
}
resource "google_storage_bucket_iam_member" "worker" {
  bucket = google_storage_bucket.staging.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.worker.email}"
}
resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each  = { api = google_service_account.api.email, worker = google_service_account.worker.email }
  secret_id = var.service_role_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value}"
}
resource "google_secret_manager_secret_iam_member" "oauth" {
  count     = var.oauth_secret == null ? 0 : 1
  secret_id = var.oauth_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_job" "discovery" {
  name                = "lookout-discovery"
  location            = var.region
  deletion_protection = true
  template {
    task_count  = 1
    parallelism = 1
    template {
      service_account = google_service_account.worker.email
      timeout         = "1800s"
      max_retries     = 0
      containers {
        image = var.image
        resources { limits = { cpu = "1", memory = "2Gi" } }
        dynamic "env" {
          for_each = merge(local.common, { LOOKOUT_PROCESS = "worker-once", LOOKOUT_EXECUTION_ENABLED = "true" })
          content {
            name  = env.key
            value = env.value
          }
        }
        env {
          name = "SUPABASE_SERVICE_ROLE_KEY"
          value_source {
            secret_key_ref {
              secret  = var.service_role_secret
              version = var.service_role_version
            }
          }
        }
      }
    }
  }
  depends_on = [google_secret_manager_secret_iam_member.runtime, google_storage_bucket_iam_member.worker]
}
resource "google_cloud_run_v2_job_iam_member" "invoke" {
  location = var.region
  name     = google_cloud_run_v2_job.discovery.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name                = "lookout-api"
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"
  template {
    service_account                  = google_service_account.api.email
    timeout                          = "1200s"
    max_instance_request_concurrency = 20
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image = var.image
      resources {
        limits            = { cpu = "1", memory = "2Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      dynamic "env" {
        for_each = local.api_env
        content {
          name  = env.key
          value = env.value
        }
      }
      env {
        name = "SUPABASE_SERVICE_ROLE_KEY"
        value_source {
          secret_key_ref {
            secret  = var.service_role_secret
            version = var.service_role_version
          }
        }
      }
      dynamic "env" {
        for_each = var.oauth_secret == null ? [] : [var.oauth_secret]
        content {
          name = "LOOKOUT_OAUTH_CONFIG_JSON"
          value_source {
            secret_key_ref {
              secret  = env.value
              version = var.oauth_version
            }
          }
        }
      }
    }
  }
  depends_on = [google_cloud_run_v2_job_iam_member.invoke, google_secret_manager_secret_iam_member.runtime, google_secret_manager_secret_iam_member.oauth, google_storage_bucket_iam_member.api]
}
resource "google_cloud_run_v2_service_iam_member" "public" {
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
resource "google_cloud_scheduler_job" "maintenance" {
  paused           = var.maintenance_paused
  name             = "lookout-maintenance"
  region           = var.region
  schedule         = "* * * * *"
  attempt_deadline = "1200s"
  http_target {
    uri         = "${local.api_url}/internal/maintenance"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.api_url
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.public]
}

output "api_url" { value = local.api_url }
output "service_uri" { value = google_cloud_run_v2_service.api.uri }
output "discovery_job" { value = google_cloud_run_v2_job.discovery.name }
