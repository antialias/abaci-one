#!/usr/bin/env python3
"""
Detect available training hardware by querying TensorFlow.

This script outputs JSON with information about what hardware
TensorFlow will use for training.
"""

import json
import os
import platform
import sys

# Suppress TensorFlow logging during detection
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'


def get_hardware_info() -> dict:
    """Detect available hardware for TensorFlow training."""
    result = {
        "available": False,
        "device": "unknown",
        "deviceName": "Unknown",
        "deviceType": "unknown",
        "details": {},
        "error": None,
    }

    # Get system info
    result["details"]["platform"] = platform.system()
    result["details"]["machine"] = platform.machine()
    result["details"]["processor"] = platform.processor()

    try:
        import tensorflow as tf

        result["details"]["tensorflowVersion"] = tf.__version__

        # List all physical devices
        gpus = tf.config.list_physical_devices('GPU')
        cpus = tf.config.list_physical_devices('CPU')

        # Check for Apple Silicon Metal (MPS)
        # TensorFlow on Apple Silicon uses 'GPU' device type with Metal
        is_apple_silicon = (
            platform.system() == "Darwin" and
            platform.machine() == "arm64"
        )

        if gpus:
            # GPU available (could be NVIDIA CUDA or Apple Metal)
            gpu = gpus[0]
            result["available"] = True
            result["deviceType"] = "gpu"

            if is_apple_silicon:
                result["device"] = "metal"
                result["deviceName"] = "Apple Silicon GPU (Metal)"

                # Try to get chip info from system_profiler
                try:
                    import subprocess
                    sp_output = subprocess.check_output(
                        ["system_profiler", "SPHardwareDataType", "-json"],
                        text=True,
                        timeout=5
                    )
                    sp_data = json.loads(sp_output)
                    hardware = sp_data.get("SPHardwareDataType", [{}])[0]
                    chip_type = hardware.get("chip_type", "")
                    if chip_type:
                        result["deviceName"] = f"{chip_type} GPU (Metal)"
                        result["details"]["chipType"] = chip_type

                    # Get memory info
                    memory = hardware.get("physical_memory", "")
                    if memory:
                        result["details"]["systemMemory"] = memory

                except Exception:
                    pass  # Use default name
            else:
                # Likely NVIDIA GPU
                result["device"] = "cuda"
                result["deviceName"] = gpu.name
                result["details"]["gpuCount"] = len(gpus)

                # Try to get more GPU details
                try:
                    gpu_details = tf.config.experimental.get_device_details(gpu)
                    if gpu_details:
                        result["details"]["gpuDetails"] = gpu_details
                except Exception:
                    pass

        elif cpus:
            # CPU only
            result["available"] = True
            result["device"] = "cpu"
            result["deviceType"] = "cpu"
            result["deviceName"] = "CPU"

            # Get CPU info
            if is_apple_silicon:
                try:
                    import subprocess
                    sp_output = subprocess.check_output(
                        ["system_profiler", "SPHardwareDataType", "-json"],
                        text=True,
                        timeout=5
                    )
                    sp_data = json.loads(sp_output)
                    hardware = sp_data.get("SPHardwareDataType", [{}])[0]
                    chip_type = hardware.get("chip_type", "")
                    if chip_type:
                        result["deviceName"] = f"{chip_type} CPU"
                        result["details"]["chipType"] = chip_type
                except Exception:
                    pass
            else:
                # Try to get CPU name on other systems
                cpu_name = platform.processor()
                if cpu_name:
                    result["deviceName"] = cpu_name

        else:
            result["error"] = "No compute devices found"

    except ImportError as e:
        result["error"] = f"TensorFlow not installed: {e}"
    except Exception as e:
        result["error"] = f"Error detecting hardware: {e}"

    return result


if __name__ == "__main__":
    info = get_hardware_info()
    print(json.dumps(info))
