variable "project_id" {
  description = "Existing billing-enabled Google Cloud project."
  type        = string
}

variable "region" {
  type    = string
  default = "us-east1"
}

variable "zone" {
  type    = string
  default = "us-east1-b"
}

variable "machine_type" {
  description = "Starting size for a personal deployment, including on-VM Docker builds."
  type        = string
  default     = "e2-medium"
}

resource "google_project_service" "required" {
  for_each           = toset(["compute.googleapis.com", "iam.googleapis.com", "iap.googleapis.com", "oslogin.googleapis.com"])
  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "lookout" {
  name                    = "lookout"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required]
}

resource "google_compute_subnetwork" "lookout" {
  name          = "lookout"
  ip_cidr_range = "10.42.0.0/24"
  network       = google_compute_network.lookout.id
  region        = var.region
}

resource "google_compute_firewall" "web" {
  name          = "lookout-web"
  network       = google_compute_network.lookout.name
  target_tags   = ["lookout"]
  source_ranges = ["0.0.0.0/0"]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_firewall" "ssh" {
  name          = "lookout-iap-ssh"
  network       = google_compute_network.lookout.name
  target_tags   = ["lookout"]
  source_ranges = ["35.235.240.0/20"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_service_account" "vm" {
  account_id   = "lookout-vm"
  display_name = "Lookout VM (no project roles)"
  depends_on   = [google_project_service.required]
}

resource "google_compute_address" "api" {
  name       = "lookout-api"
  region     = var.region
  depends_on = [google_project_service.required]
}

resource "google_compute_instance" "backend" {
  name         = "lookout-backend"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["lookout"]
  labels       = { app = "lookout" }
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 30
      type  = "pd-balanced"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.lookout.id
    access_config {
      nat_ip = google_compute_address.api.address
    }
  }
  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }
  metadata = {
    enable-oslogin         = "TRUE"
    block-project-ssh-keys = "TRUE"
  }
  metadata_startup_script = file("${path.module}/startup.sh")
  shielded_instance_config {
    enable_secure_boot = true
  }
}

output "project_id" {
  value = var.project_id
}

output "zone" {
  value = google_compute_instance.backend.zone
}

output "instance_name" {
  value = google_compute_instance.backend.name
}

output "api_ip" {
  value = google_compute_address.api.address
}
