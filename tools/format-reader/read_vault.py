#!/usr/bin/env python3
"""
read_vault.py -- an independent reader for the Nayose vault export format,
version 1.

This implementation is written using ONLY docs/format/v1.md as its source of
truth. It does not depend on, and was not written by consulting, any
TypeScript source in this project. Its purpose is to demonstrate that the
published specification is sufficient, on its own, to build a working,
conformant reader in a different language.

Scope (per the format-reader task): this script reads the assertion log,
checks the format version, reconstructs entities and projected "current"
field values (including the user-asserted-wins conflict rule and the
override marker), and surfaces provenance. It deliberately does NOT perform
share-integrity summation (checking whether a work's shares sum to a whole),
does not write or edit vault files, and has no rendering/GUI.

Usage:
    python3 read_vault.py <vault.json>

Standard library only.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Optional


SUPPORTED_FORMAT_VERSION = 1

# The six entity-kind strings defined in docs/format/v1.md section 3.
ENTITY_KINDS = {
    "Party",
    "Account",
    "Work",
    "Recording",
    "Release",
    "Registration",
}

SOURCE_CLASSES = {"registry-issued", "user-asserted"}

SHARE_FIELD_PREFIX = "share:"


class VaultFormatError(Exception):
    """Raised when a file cannot be read as a version-1 Nayose vault."""


# ---------------------------------------------------------------------------
# Section 1: the envelope
# ---------------------------------------------------------------------------


def load_vault(path: str) -> dict:
    """Load and validate the top-level envelope of a vault file.

    Per docs/format/v1.md section 1: the top-level JSON value must be an
    object with the exact marker field `nayoseVault: "nayose-vault"`, an
    integer `formatVersion`, and an object `body`.

    Per section 7: `formatVersion` must be checked for EXACT equality to the
    integer 1. Any other value (including a differently-typed value, a
    missing field, or a different integer) must be refused, with the
    declared value reported to the caller.
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()

    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise VaultFormatError(f"file is not valid JSON: {exc}") from exc

    if not isinstance(doc, dict):
        raise VaultFormatError(
            "top-level JSON value must be an object, got "
            f"{type(doc).__name__}"
        )

    if doc.get("nayoseVault") != "nayose-vault":
        raise VaultFormatError(
            "file does not declare the 'nayoseVault' marker field with "
            "value 'nayose-vault'; this is not a recognizable Nayose vault "
            f"file (found: {doc.get('nayoseVault')!r})"
        )

    declared_version = doc.get("formatVersion")
    # Strict, exact-integer-match check (section 7). Note: in Python,
    # `True == 1` and `isinstance(True, int)` are both true, so we must
    # explicitly exclude bool to avoid a `formatVersion: true` file being
    # mistaken for version 1.
    is_supported = (
        isinstance(declared_version, int)
        and not isinstance(declared_version, bool)
        and declared_version == SUPPORTED_FORMAT_VERSION
    )
    if not is_supported:
        raise VaultFormatError(
            "file declares an unsupported format version: "
            f"{declared_version!r} (this reader only supports the exact "
            f"integer {SUPPORTED_FORMAT_VERSION}); refusing to read"
        )

    body = doc.get("body")
    if not isinstance(body, dict):
        raise VaultFormatError(
            f"'body' must be a JSON object, got {type(body).__name__}"
        )

    return doc


def get_assertions(doc: dict) -> list[dict]:
    """Return body.assertions, treating a missing key as an empty list.

    Per section 1: "A reader MUST treat a missing `body.assertions` the
    same as an empty array, not as an error."
    """
    body = doc["body"]
    assertions = body.get("assertions", [])
    if not isinstance(assertions, list):
        raise VaultFormatError(
            "'body.assertions' must be a JSON array, got "
            f"{type(assertions).__name__}"
        )
    return assertions


# ---------------------------------------------------------------------------
# Section 3: the entity model ($type-assertion convention)
# ---------------------------------------------------------------------------


def find_entities(assertions: list[dict]) -> dict[str, str]:
    """Scan the assertion log for entities and their kinds.

    Per section 3: an entity is identified purely by the presence of at
    least one assertion with fieldName == "$type" for that entityId. If
    more than one $type assertion exists for the same entityId, the most
    recent one (by append order / array index) wins -- this is the general
    "most-recent-wins for a raw read" convention, not the full section-5
    conflict rule (which does not apply to $type).

    Returns a mapping of entityId -> kind, in first-seen order.
    """
    entity_kind: dict[str, str] = {}
    for assertion in assertions:
        if assertion.get("fieldName") == "$type":
            entity_id = assertion["entityId"]
            # Later occurrences (greater array index) overwrite earlier
            # ones, since we iterate in append order -- this naturally
            # implements "most recent wins."
            entity_kind[entity_id] = assertion["value"]
    return entity_kind


# ---------------------------------------------------------------------------
# Section 5: the projection rule
# ---------------------------------------------------------------------------


def field_history(
    assertions: list[dict], entity_id: str, field_name: str
) -> list[dict]:
    """Every assertion for one (entityId, fieldName) pair, in append order."""
    return [
        a
        for a in assertions
        if a.get("entityId") == entity_id and a.get("fieldName") == field_name
    ]


def deep_equal(a: Any, b: Any) -> bool:
    """Deep structural equality per section 5.3: order-independent for
    object keys, order-dependent for array elements."""
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return False
        return all(deep_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(deep_equal(x, y) for x, y in zip(a, b))
    # bool/int overlap in Python (True == 1); JSON has distinct types, so
    # guard against a bool comparing equal to a structurally-different
    # number.
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return a == b


def project_field(
    assertions: list[dict], entity_id: str, field_name: str
) -> Optional[dict]:
    """Derive the "current" value of one (entityId, fieldName) pair.

    Implements docs/format/v1.md section 5 exactly: split the field
    history into user-asserted and registry-issued sublists (preserving
    order), user-asserted wins if any exist (branch 1), else the most
    recent registry-issued assertion wins (branch 2). The override marker
    is computed only in branch 1, by deep-comparing the winning
    user-asserted value against the most recent registry-issued value (if
    any).

    Returns None if the field has no assertions at all (section 5.4).
    """
    history = field_history(assertions, entity_id, field_name)
    if not history:
        return None

    user_assertions = [a for a in history if a.get("sourceClass") == "user-asserted"]
    registry_assertions = [
        a for a in history if a.get("sourceClass") == "registry-issued"
    ]

    for a in history:
        if a.get("sourceClass") not in SOURCE_CLASSES:
            raise VaultFormatError(
                f"assertion id={a.get('id')!r} has an invalid sourceClass "
                f"{a.get('sourceClass')!r}; must be 'registry-issued' or "
                "'user-asserted'"
            )

    most_recent_registry = registry_assertions[-1] if registry_assertions else None

    if user_assertions:
        current = user_assertions[-1]
        is_override = False
        result = {
            "value": current["value"],
            "sourceAssertionId": current["id"],
            "source": current["source"],
            "sourceClass": current["sourceClass"],
            "isOverride": False,
        }
        if most_recent_registry is not None:
            if not deep_equal(current["value"], most_recent_registry["value"]):
                is_override = True
                result["isOverride"] = True
                result["overriddenRegistryValue"] = most_recent_registry["value"]
                result["overriddenRegistrySource"] = most_recent_registry["source"]
                result["overriddenRegistryAssertionId"] = most_recent_registry["id"]
        return result

    # Branch 2: no user assertions, but registry assertions exist (history
    # is non-empty and every assertion is one class or the other, so this
    # branch is reached whenever branch 1 is not).
    current = most_recent_registry
    assert current is not None  # non-empty history guarantees this
    return {
        "value": current["value"],
        "sourceAssertionId": current["id"],
        "source": current["source"],
        "sourceClass": current["sourceClass"],
        "isOverride": False,
    }


def all_field_names(assertions: list[dict], entity_id: str) -> list[str]:
    """Every distinct fieldName asserted for one entity, in first-seen
    order (used to enumerate what to project for an entity)."""
    seen: list[str] = []
    seen_set: set[str] = set()
    for a in assertions:
        if a.get("entityId") == entity_id:
            fn = a["fieldName"]
            if fn not in seen_set:
                seen_set.add(fn)
                seen.append(fn)
    return seen


# ---------------------------------------------------------------------------
# Section 4: share:{partyId} fields
# ---------------------------------------------------------------------------


def find_shares(assertions: list[dict], work_entity_id: str) -> dict[str, dict]:
    """Enumerate raw (unreduced) Fraction shares recorded on a Work.

    Per section 4: scan for every assertion whose entityId equals the
    Work's id and whose fieldName starts with the literal "share:" prefix;
    everything after the prefix is the asserting Party's id. This returns
    the PROJECTED (current) share per party, not the raw history, since a
    share can be corrected the same way any other field can.

    Deliberately out of scope (per this task): summing shares to check
    they total to a whole. Section 6 documents that as informative
    background only; this reader surfaces raw/projected shares and stops
    there.
    """
    party_ids: list[str] = []
    seen: set[str] = set()
    for a in assertions:
        if a.get("entityId") == work_entity_id:
            field_name = a.get("fieldName", "")
            if field_name.startswith(SHARE_FIELD_PREFIX):
                party_id = field_name[len(SHARE_FIELD_PREFIX) :]
                if party_id not in seen:
                    seen.add(party_id)
                    party_ids.append(party_id)

    shares: dict[str, dict] = {}
    for party_id in party_ids:
        field_name = f"{SHARE_FIELD_PREFIX}{party_id}"
        projection = project_field(assertions, work_entity_id, field_name)
        if projection is not None:
            shares[party_id] = projection
    return shares


# ---------------------------------------------------------------------------
# Reporting / CLI
# ---------------------------------------------------------------------------


def format_projection(projection: dict) -> str:
    lines = [
        f"    value              = {projection['value']!r}",
        f"    sourceAssertionId   = {projection['sourceAssertionId']!r}",
        f"    source              = {projection['source']!r}",
        f"    sourceClass         = {projection['sourceClass']!r}",
        f"    isOverride          = {projection['isOverride']!r}",
    ]
    if projection["isOverride"]:
        lines.append(
            f"    overriddenRegistryValue         = "
            f"{projection['overriddenRegistryValue']!r}"
        )
        lines.append(
            f"    overriddenRegistrySource        = "
            f"{projection['overriddenRegistrySource']!r}"
        )
        lines.append(
            f"    overriddenRegistryAssertionId   = "
            f"{projection['overriddenRegistryAssertionId']!r}"
        )
    return "\n".join(lines)


def print_report(doc: dict) -> None:
    assertions = get_assertions(doc)

    print(f"Format version check: OK (declared formatVersion = "
          f"{doc['formatVersion']}, supported = {SUPPORTED_FORMAT_VERSION})")
    print(f"Total assertions in log: {len(assertions)}")
    print()

    entities = find_entities(assertions)
    print(f"Entities found ({len(entities)}):")
    for entity_id, kind in entities.items():
        print(f"  - {entity_id}  [{kind}]")
    print()

    print("Projected current field values:")
    for entity_id, kind in entities.items():
        print(f"  Entity {entity_id} ({kind}):")
        for field_name in all_field_names(assertions, entity_id):
            if field_name.startswith(SHARE_FIELD_PREFIX):
                # Reported separately below, grouped per Work.
                continue
            projection = project_field(assertions, entity_id, field_name)
            print(f"  [{entity_id}].{field_name}:")
            print(format_projection(projection))
        if kind == "Work":
            shares = find_shares(assertions, entity_id)
            if shares:
                print(f"  Shares recorded on Work {entity_id}:")
                for party_id, projection in shares.items():
                    print(f"    party {party_id}:")
                    for line in format_projection(projection).split("\n"):
                        print(f"  {line}")
        print()


# ---------------------------------------------------------------------------
# Self-verification (bare asserts, run only against the known fixture)
# ---------------------------------------------------------------------------


def run_self_tests(doc: dict, assertions: list[dict]) -> None:
    """Self-verification against tools/format-reader/fixtures/sample-vault.json.

    This is intentionally specific to that fixture's known contents (it is
    not a general-purpose test suite) -- it exists to demonstrate, via bare
    `assert` statements and no test framework, that this reader's
    implementation produces exactly the values the fixture was constructed
    to exercise: a plain field, a registry/user conflict with override
    marking, and a share fraction.
    """
    entities = find_entities(assertions)
    assert entities == {"p-1": "Party", "p-2": "Party", "w-1": "Work"}, entities

    # Plain field: p-1's displayName, no registry assertion at all.
    display_name = project_field(assertions, "p-1", "displayName")
    assert display_name is not None
    assert display_name["value"] == "Jane Songwriter"
    assert display_name["sourceAssertionId"] == "2"
    assert display_name["sourceClass"] == "user-asserted"
    assert display_name["isOverride"] is False
    assert "overriddenRegistryValue" not in display_name

    # Conflict/override case: w-1's title, registry then user, disagreeing.
    title = project_field(assertions, "w-1", "title")
    assert title is not None
    assert title["value"] == "Sunrise Song"
    assert title["sourceAssertionId"] == "7"
    assert title["source"] == "manual-entry"
    assert title["sourceClass"] == "user-asserted"
    assert title["isOverride"] is True
    assert title["overriddenRegistryValue"] == "Sunrise Song (Registry Title)"
    assert title["overriddenRegistrySource"] == "ascap"
    assert title["overriddenRegistryAssertionId"] == "6"

    # Share fractions: raw, unreduced Fraction values surfaced via
    # projection, no summation performed.
    shares = find_shares(assertions, "w-1")
    assert set(shares.keys()) == {"p-1", "p-2"}
    assert shares["p-1"]["value"] == {"numerator": 1, "denominator": 3}
    assert shares["p-1"]["isOverride"] is False
    assert shares["p-2"]["value"] == {"numerator": 2, "denominator": 3}
    assert shares["p-2"]["isOverride"] is False

    # $type itself also projects cleanly (most-recent-wins, not a
    # registry/user conflict case, per section 3).
    work_type = project_field(assertions, "w-1", "$type")
    assert work_type is not None
    assert work_type["value"] == "Work"

    print("Self-tests (bare asserts against the known fixture): PASSED")


def is_known_fixture(path: str) -> bool:
    return path.replace("\\", "/").rstrip("/").endswith(
        "fixtures/sample-vault.json"
    )


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: python3 {argv[0]} <vault.json>", file=sys.stderr)
        return 2

    path = argv[1]
    try:
        doc = load_vault(path)
    except VaultFormatError as exc:
        print(f"error: refusing to read {path!r}: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"error: could not open {path!r}: {exc}", file=sys.stderr)
        return 1

    assertions = get_assertions(doc)
    print_report(doc)

    if is_known_fixture(path):
        run_self_tests(doc, assertions)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
