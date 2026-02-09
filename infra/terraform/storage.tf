# NFS-backed storage for persistent data
#
# Vision training data, uploads, and generated audio are stored on the NAS
# and mounted via NFS. This allows all pods to share the same data.

# NFS PersistentVolume for vision training data
resource "kubernetes_persistent_volume" "vision_training" {
  metadata {
    name = "vision-training-pv"
    labels = {
      type = "nfs"
      app  = "abaci-vision"
    }
  }

  spec {
    capacity = {
      storage = "50Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/vision-training"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "vision_training" {
  metadata {
    name      = "vision-training-data"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "50Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "abaci-vision"
      }
    }
  }
}

# NFS PersistentVolume for uploads
resource "kubernetes_persistent_volume" "uploads" {
  metadata {
    name = "uploads-pv"
    labels = {
      type = "nfs"
      app  = "abaci-uploads"
    }
  }

  spec {
    capacity = {
      storage = "10Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/uploads"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "uploads" {
  metadata {
    name      = "uploads-data"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "10Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "abaci-uploads"
      }
    }
  }
}

# NFS PersistentVolume for generated TTS audio clips
resource "kubernetes_persistent_volume" "audio" {
  metadata {
    name = "audio-pv"
    labels = {
      type = "nfs"
      app  = "abaci-audio"
    }
  }

  spec {
    capacity = {
      storage = "5Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/audio"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "audio" {
  metadata {
    name      = "audio-data"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "5Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "abaci-audio"
      }
    }
  }
}
