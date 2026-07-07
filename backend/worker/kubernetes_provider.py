"""KubernetesRuntimeProvider — 真实 K8s 操作，K8s 逻辑只在此文件中。

安全策略（随每次 deploy 同步创建）：
  - Pod securityContext: runAsNonRoot, runAsUser=1000, 无 ServiceAccount token
  - 容器 securityContext: allowPrivilegeEscalation=false, readOnlyRootFilesystem=true, drop ALL
  - NetworkPolicy ingress: 只允许 haze-system Namespace（Gateway 所在）
  - NetworkPolicy egress: 允许 DNS + 外部 HTTPS，禁止访问内部集群网络

Mock 模式：本地开发环境无 kubeconfig 时自动启用，所有 K8s 操作变为 no-op，
Worker 仍可完整运行（镜像构建、Gateway 路由写入、DB 状态推进）。
生产环境须确保 kubeconfig 或 in-cluster ServiceAccount 可用。
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import kubernetes
import kubernetes.client
import kubernetes.client.exceptions
import kubernetes.config
from kubernetes.config.config_exception import ConfigException

from app.modules.mcp_runtime.models import McpDeployment
from worker.config import WorkerSettings

logger = logging.getLogger(__name__)


class KubernetesRuntimeProvider:
    """调用 kubernetes Python SDK 操作 haze-runtime Namespace 下的 MCP Server 资源。"""

    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._mock = False  # 无 kubeconfig 时降级为 mock 模式

        try:
            if settings.k8s_in_cluster:
                kubernetes.config.load_incluster_config()
                api_client = kubernetes.client.ApiClient()
            else:
                cfg = kubernetes.client.Configuration()
                kubernetes.config.load_kube_config(
                    config_file=settings.k8s_config_path,
                    client_configuration=cfg,
                )
                if not settings.k8s_verify_ssl:
                    # 本地开发：Docker Desktop 自签名证书导致 SSLEOFError，跳过校验
                    cfg.verify_ssl = False
                    import urllib3  # noqa: PLC0415
                    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                    logger.warning("K8S_VERIFY_SSL=false：已禁用 TLS 证书验证，仅限本地开发使用")
                api_client = kubernetes.client.ApiClient(cfg)
            self._apps = kubernetes.client.AppsV1Api(api_client)
            self._core = kubernetes.client.CoreV1Api(api_client)
            self._net = kubernetes.client.NetworkingV1Api(api_client)
        except ConfigException as exc:
            # 本地开发环境无 kubeconfig 时自动降级，生产环境应确保配置正确
            logger.warning(
                "未找到有效的 kubeconfig，KubernetesRuntimeProvider 进入 Mock 模式"
                "（K8s 操作将被跳过）。原因：%s", exc
            )
            self._mock = True
            self._apps = None
            self._core = None
            self._net = None

    # ── 内部工具 ──────────────────────────────────────────────────────────────

    @staticmethod
    def _labels(deployment_name: str, asset_code: str) -> dict[str, str]:
        return {
            "app": deployment_name,
            "haze.io/type": "mcp-server",
            "haze.io/asset-code": asset_code,
        }

    def _create_or_patch(self, resource_type: str, name: str, namespace: str, body: object) -> None:
        """通用 create-or-patch：先 create，409 冲突则 replace（整体更新）。"""
        try:
            if resource_type == "deployment":
                self._apps.create_namespaced_deployment(namespace, body)
            elif resource_type == "service":
                self._core.create_namespaced_service(namespace, body)
            elif resource_type == "networkpolicy":
                self._net.create_namespaced_network_policy(namespace, body)
        except kubernetes.client.exceptions.ApiException as exc:
            if exc.status != 409:
                raise
            # 已存在则替换
            if resource_type == "deployment":
                self._apps.replace_namespaced_deployment(name, namespace, body)
            elif resource_type == "service":
                # Service replace 需要先读取 resourceVersion
                existing = self._core.read_namespaced_service(name, namespace)
                body.metadata.resource_version = existing.metadata.resource_version
                self._core.replace_namespaced_service(name, namespace, body)
            elif resource_type == "networkpolicy":
                self._net.replace_namespaced_network_policy(name, namespace, body)

    # ── 核心操作 ──────────────────────────────────────────────────────────────

    def _delete_if_exists(self, resource_type: str, name: str, namespace: str) -> None:
        try:
            if resource_type == "deployment":
                self._apps.delete_namespaced_deployment(name, namespace)
            elif resource_type == "service":
                self._core.delete_namespaced_service(name, namespace)
            elif resource_type == "networkpolicy":
                self._net.delete_namespaced_network_policy(name, namespace)
        except kubernetes.client.exceptions.ApiException as exc:
            if exc.status != 404:
                raise

    def deploy(
        self,
        dep: McpDeployment,
        port: int,
        endpoint: str,
    ) -> tuple[str, str, str]:
        """创建（或更新）Deployment / Service / NetworkPolicy。

        返回 (image_url, internal_service_name, internal_url)。
        Mock 模式下跳过 K8s 操作，直接返回占位值供 DB 字段记录。
        """
        name = dep.deployment_name
        ns = dep.namespace
        image = dep.image_url or self._settings.mcp_placeholder_image

        if self._mock:
            # Mock 模式：target_url 指向本机端口，便于手动运行 server.py 做本地测试
            mock_url = f"http://localhost:{port}{endpoint}"
            logger.info("[Mock] deploy 跳过 K8s 资源创建，deployment=%s，mock target_url=%s", name, mock_url)
            return image, name, mock_url

        s = self._settings
        asset_code = name.removeprefix("mcp-")  # mcp-{code} → {code}
        labels = self._labels(name, asset_code)

        # ── Deployment ────────────────────────────────────────────────────────
        deployment = kubernetes.client.V1Deployment(
            metadata=kubernetes.client.V1ObjectMeta(
                name=name,
                namespace=ns,
                labels=labels,
            ),
            spec=kubernetes.client.V1DeploymentSpec(
                replicas=1,
                selector=kubernetes.client.V1LabelSelector(
                    match_labels={"app": name},
                ),
                template=kubernetes.client.V1PodTemplateSpec(
                    metadata=kubernetes.client.V1ObjectMeta(labels=labels),
                    spec=kubernetes.client.V1PodSpec(
                        automount_service_account_token=False,
                        security_context=kubernetes.client.V1PodSecurityContext(
                            run_as_non_root=True,
                            run_as_user=1000,
                            run_as_group=1000,
                            fs_group=1000,
                        ),
                        containers=[
                            kubernetes.client.V1Container(
                                name="mcp-server",
                                image=image,
                                # IfNotPresent：本地有镜像时直接使用，不再拉取
                                # Docker Desktop K8s 共享宿主机镜像存储，build 后无需 push 即可用
                                # 生产环境（in-cluster）同样适用，镜像由 Worker push 后首次拉取会缓存
                                image_pull_policy="IfNotPresent",
                                ports=[kubernetes.client.V1ContainerPort(container_port=port)],
                                resources=kubernetes.client.V1ResourceRequirements(
                                    requests={
                                        "cpu": s.mcp_cpu_request,
                                        "memory": s.mcp_memory_request,
                                    },
                                    limits={
                                        "cpu": s.mcp_cpu_limit,
                                        "memory": s.mcp_memory_limit,
                                    },
                                ),
                                security_context=kubernetes.client.V1SecurityContext(
                                    allow_privilege_escalation=False,
                                    read_only_root_filesystem=True,
                                    capabilities=kubernetes.client.V1Capabilities(
                                        drop=["ALL"],
                                    ),
                                ),
                                volume_mounts=[
                                    kubernetes.client.V1VolumeMount(
                                        name="tmp",
                                        mount_path="/tmp",
                                    )
                                ],
                            )
                        ],
                        volumes=[
                            kubernetes.client.V1Volume(
                                name="tmp",
                                empty_dir=kubernetes.client.V1EmptyDirVolumeSource(),
                            )
                        ],
                    ),
                ),
            ),
        )
        self._create_or_patch("deployment", name, ns, deployment)

        # ── Service
        # in-cluster（生产）用 ClusterIP，Gateway Pod 通过集群 DNS 访问；
        # 本地开发用 NodePort，Worker/Gateway 跑在宿主机，需要 localhost:NodePort 访问
        service_type = "ClusterIP" if s.k8s_in_cluster else "NodePort"
        service = kubernetes.client.V1Service(
            metadata=kubernetes.client.V1ObjectMeta(
                name=name,
                namespace=ns,
                labels=labels,
            ),
            spec=kubernetes.client.V1ServiceSpec(
                selector={"app": name},
                ports=[
                    kubernetes.client.V1ServicePort(
                        port=port,
                        target_port=port,
                    )
                ],
                type=service_type,
            ),
        )
        self._create_or_patch("service", name, ns, service)

        # ── NetworkPolicy ─────────────────────────────────────────────────────
        netpol_name = f"{name}-netpol"
        netpol = kubernetes.client.V1NetworkPolicy(
            metadata=kubernetes.client.V1ObjectMeta(
                name=netpol_name,
                namespace=ns,
            ),
            spec=kubernetes.client.V1NetworkPolicySpec(
                pod_selector=kubernetes.client.V1LabelSelector(
                    match_labels={"app": name},
                ),
                policy_types=["Ingress", "Egress"],
                ingress=[
                    kubernetes.client.V1NetworkPolicyIngressRule(
                        _from=[
                            kubernetes.client.V1NetworkPolicyPeer(
                                namespace_selector=kubernetes.client.V1LabelSelector(
                                    match_labels={
                                        "kubernetes.io/metadata.name": "haze-system"
                                    }
                                )
                            )
                        ]
                    )
                ],
                egress=[
                    # DNS（UDP/TCP 53）
                    kubernetes.client.V1NetworkPolicyEgressRule(
                        ports=[
                            kubernetes.client.V1NetworkPolicyPort(port=53, protocol="UDP"),
                            kubernetes.client.V1NetworkPolicyPort(port=53, protocol="TCP"),
                        ]
                    ),
                    # 允许外部（禁止内部 RFC 1918 网段）
                    kubernetes.client.V1NetworkPolicyEgressRule(
                        to=[
                            kubernetes.client.V1NetworkPolicyPeer(
                                ip_block=kubernetes.client.V1IPBlock(
                                    cidr="0.0.0.0/0",
                                    _except=[
                                        "10.0.0.0/8",
                                        "172.16.0.0/12",
                                        "192.168.0.0/16",
                                    ],
                                )
                            )
                        ]
                    ),
                ],
            ),
        )
        self._create_or_patch("networkpolicy", netpol_name, ns, netpol)

        # 根据 Service 类型确定 Gateway 使用的 target_url
        if s.k8s_in_cluster:
            # 生产：Gateway Pod 与 MCP Pod 同在集群内，直接用集群 DNS
            internal_url = f"http://{name}.{ns}.svc.cluster.local:{port}{endpoint}"
        else:
            proxy_base = s.k8s_proxy_base_url.rstrip("/")
            if proxy_base:
                # kubectl proxy 模式（Windows kind 开发环境，需先运行 kubectl proxy --port=8090）
                internal_url = f"{proxy_base}/api/v1/namespaces/{ns}/services/{name}:{port}/proxy{endpoint}"
            else:
                # NodePort 模式（Linux 宿主机开发，localhost:NodePort 直接可达）
                svc = self._core.read_namespaced_service(name, ns)
                node_port = svc.spec.ports[0].node_port
                internal_url = f"http://localhost:{node_port}{endpoint}"

        return image, name, internal_url

    def wait_for_ready(self, dep: McpDeployment, timeout_seconds: int) -> bool:
        """轮询 Deployment.status.ready_replicas 直到 >= 1 或超时。Mock 模式立即返回 True。"""
        if self._mock:
            logger.info("[Mock] wait_for_ready 立即返回 True，deployment=%s", dep.deployment_name)
            return True

        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            d = self._apps.read_namespaced_deployment(dep.deployment_name, dep.namespace)
            if (d.status.ready_replicas or 0) >= 1:
                return True
            time.sleep(self._settings.pod_ready_poll_seconds)
        return False

    def start(self, dep: McpDeployment) -> None:
        """将 replicas 设为 1，恢复已停止的服务。"""
        if self._mock:
            logger.info("[Mock] start 跳过 K8s patch，deployment=%s", dep.deployment_name)
            return
        self._apps.patch_namespaced_deployment(
            dep.deployment_name,
            dep.namespace,
            {"spec": {"replicas": 1}},
        )

    def stop(self, dep: McpDeployment) -> None:
        """将 replicas 设为 0，停止服务（保留 K8s 资源）。"""
        if self._mock:
            logger.info("[Mock] stop 跳过 K8s patch，deployment=%s", dep.deployment_name)
            return
        self._apps.patch_namespaced_deployment(
            dep.deployment_name,
            dep.namespace,
            {"spec": {"replicas": 0}},
        )

    def restart(self, dep: McpDeployment) -> None:
        """更新 Pod annotation 触发滚动重启，不停机。"""
        if self._mock:
            logger.info("[Mock] restart 跳过 K8s patch，deployment=%s", dep.deployment_name)
            return
        ts = datetime.now(timezone.utc).isoformat()
        self._apps.patch_namespaced_deployment(
            dep.deployment_name,
            dep.namespace,
            {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": ts,
                            }
                        }
                    }
                }
            },
        )

    def delete(self, dep: McpDeployment) -> None:
        """Delete Deployment / Service / NetworkPolicy resources."""
        if self._mock:
            logger.info("[Mock] delete skip K8s resources, deployment=%s", dep.deployment_name)
            return
        name = dep.deployment_name
        ns = dep.namespace
        self._delete_if_exists("deployment", name, ns)
        self._delete_if_exists("service", name, ns)
        self._delete_if_exists("networkpolicy", f"{name}-netpol", ns)

    def get_deployment_status(self, deployment_name: str, namespace: str) -> dict | None:
        """查询 K8s Deployment 当前副本状态，返回 None 表示资源不存在。

        返回 dict：ready_replicas, replicas, deploy_status（running/stopped/deploying）
        Mock 模式：返回空字典（不做任何同步，保持 DB 原状）。
        """
        if self._mock:
            return None  # Mock 模式无法查询真实 K8s，跳过同步

        try:
            d = self._apps.read_namespaced_deployment(deployment_name, namespace)
            desired = d.spec.replicas or 0
            ready = d.status.ready_replicas or 0
            if desired == 0:
                deploy_status = "stopped"
            elif ready >= desired:
                deploy_status = "running"
            else:
                deploy_status = "deploying"
            return {"ready_replicas": ready, "replicas": desired, "deploy_status": deploy_status}
        except kubernetes.client.exceptions.ApiException as exc:
            if exc.status == 404:
                return None  # K8s 资源已不存在
            raise

    def get_pod_logs(self, dep: McpDeployment, tail_lines: int = 100) -> str:
        """返回最新 Pod 日志，无 Pod 时返回空字符串。"""
        if self._mock:
            return "[Mock 模式：无 K8s 集群，Pod 日志不可用]"

        pods = self._core.list_namespaced_pod(
            dep.namespace,
            label_selector=f"app={dep.deployment_name}",
        )
        if not pods.items:
            return ""
        pod_name = pods.items[0].metadata.name
        try:
            return self._core.read_namespaced_pod_log(
                pod_name,
                dep.namespace,
                tail_lines=tail_lines,
            )
        except kubernetes.client.exceptions.ApiException:
            return ""
