"""
Core base models — abstract mixins inherited by every platform model.

Rules:
  - TimestampedModel    : created_at / updated_at on every table
  - UUIDPrimaryKeyModel : UUID PK for public-facing resources
  - OrgScopedModel      : enforces multi-tenancy via organization FK
"""

import uuid

from django.db import models


class TimestampedModel(models.Model):
    """Abstract — adds created_at / updated_at to every descendant."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class UUIDPrimaryKeyModel(models.Model):
    """Abstract — replaces integer PK with UUID."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class OrgScopedModel(TimestampedModel):
    """
    Abstract — every model that belongs to an organization.
    Concrete subclasses MUST declare the `organization` FK themselves
    so they can set the correct related_name.
    This base just enforces the pattern via abstract = True.
    """

    class Meta:
        abstract = True
