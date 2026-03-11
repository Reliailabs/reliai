from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from app.core.settings import get_settings
from app.processors.base_processor import BaseProcessor


@dataclass(frozen=True)
class ProcessorDescriptor:
    processor_id: str
    processor_type: str
    version: str
    topic: str


class ProcessorRegistry:
    def __init__(self) -> None:
        self._processor_classes: dict[str, type[BaseProcessor]] = {}
        self._subscriptions: dict[str, list[str]] = defaultdict(list)

    def register_processor(self, processor_class: type[BaseProcessor]) -> None:
        if not processor_class.name:
            raise ValueError("processor must declare a name")
        if not processor_class.topic:
            raise ValueError("processor must declare a topic")
        self._processor_classes[processor_class.name] = processor_class
        subscriptions = self._subscriptions[processor_class.topic]
        if processor_class.name not in subscriptions:
            subscriptions.append(processor_class.name)

    def get_processor(self, name: str) -> type[BaseProcessor]:
        return self._processor_classes[name]

    def list_processor_names(self) -> list[str]:
        return list(self._processor_classes.keys())

    def list_descriptors(self) -> list[ProcessorDescriptor]:
        return [
            ProcessorDescriptor(
                processor_id=processor_class.name,
                processor_type=processor_class.processor_type,
                version=processor_class.version,
                topic=processor_class.topic,
            )
            for processor_class in self._processor_classes.values()
        ]

    def subscribed_topics(self) -> list[str]:
        return list(self._subscriptions.keys())

    def processors_for_topic(
        self,
        topic: str,
        *,
        enabled_processors: set[str] | None = None,
    ) -> list[BaseProcessor]:
        names = self._subscriptions.get(topic, [])
        if enabled_processors is not None:
            names = [name for name in names if name in enabled_processors]
        return [self._processor_classes[name]() for name in names]


_registry = ProcessorRegistry()
_defaults_registered = False


def register_processor(processor_class: type[BaseProcessor]) -> None:
    _registry.register_processor(processor_class)


def enabled_processor_names() -> set[str]:
    raw = get_settings().enabled_processors
    return {item.strip() for item in raw.split(",") if item.strip()}


def get_processor_registry() -> ProcessorRegistry:
    global _defaults_registered
    if not _defaults_registered:
        from app.processors.automation_processor import AutomationProcessor
        from app.processors.deployment_processor import DeploymentProcessor
        from app.processors.evaluation_processor import EvaluationProcessor
        from app.processors.regression_processor import RegressionProcessor
        from app.processors.reliability_graph_processor import ReliabilityGraphProcessor
        from app.processors.reliability_metrics_processor import ReliabilityMetricsProcessor
        from app.processors.sdk_metrics_processor import SDKMetricsProcessor
        from app.processors.warehouse_processor import WarehouseProcessor

        for processor_class in (
            AutomationProcessor,
            DeploymentProcessor,
            EvaluationProcessor,
            RegressionProcessor,
            ReliabilityGraphProcessor,
            ReliabilityMetricsProcessor,
            SDKMetricsProcessor,
            WarehouseProcessor,
        ):
            register_processor(processor_class)
        _defaults_registered = True
    return _registry


def processors_for_topic(
    topic: str,
    *,
    enabled_processors: Iterable[str] | None = None,
) -> list[BaseProcessor]:
    enabled = set(enabled_processors) if enabled_processors is not None else enabled_processor_names()
    return get_processor_registry().processors_for_topic(topic, enabled_processors=enabled)


def core_processor_descriptors() -> list[ProcessorDescriptor]:
    return get_processor_registry().list_descriptors()
