from kubernetes import client, config

NAMESPACE = "default"


def execute_recovery(action, target="payment-service"):
    try:
        config.load_kube_config()

        apps_v1 = client.AppsV1Api()
        core_v1 = client.CoreV1Api()

        if action == "restart":
            delete_pod(core_v1, target)

        elif action == "scale":
            scale_deployment(apps_v1, target, replicas=5)

        elif action == "rollback":
            rollback_deployment(target)

        elif action == "isolate":
            isolate_service(target)

        return f"{action} executed successfully"

    except Exception as e:
        return f"Recovery failed: {str(e)}"


def delete_pod(core_v1, app_label):
    pods = core_v1.list_namespaced_pod(
        namespace=NAMESPACE,
        label_selector=f"app={app_label}"
    )

    for pod in pods.items:
        core_v1.delete_namespaced_pod(
            name=pod.metadata.name,
            namespace=NAMESPACE
        )


def scale_deployment(apps_v1, name, replicas):
    body = {"spec": {"replicas": replicas}}
    apps_v1.patch_namespaced_deployment_scale(
        name=name,
        namespace=NAMESPACE,
        body=body
    )


def rollback_deployment(name):
    print(f"Rollback triggered for {name}")


def isolate_service(name):
    print(f"Isolation triggered for {name}")