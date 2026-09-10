# <Feature Name>

- **Status:** Draft
- **Owner:** <name or role>
- **Last updated:** <YYYY-MM-DD>

## Approval

- **Status:** Pending
- **Approver:** Not recorded
- **Approval date:** Not recorded
- **Decision or notes:** Not recorded

## Outcome

- **Actor:** <role>
- **Trigger:** <event or intent>
- **Job to be done:** <what the actor must accomplish>
- **Successful outcome:** <observable result>
- **In scope:** <behavior covered>
- **Out of scope:** <behavior deliberately excluded>

## Context And Constraints

- **Preconditions:** <required setup, data, or access>
- **Source of truth:** <authoritative records and limits>
- **Permissions and ownership:** <who can view, act, approve, or resolve>
- **Consequential actions:** <actions requiring confirmation, safeguards, or audit>

## State Model

| State | Meaning | Operator can do | Exit or terminal condition |
| --- | --- | --- | --- |
| <state> | <meaning> | <allowed action> | <condition> |

## Primary Path

1. <operator-visible step>
2. <system response and information shown>
3. <operator decision or action>
4. <durable outcome>

## Decisions And Branches

| Condition or decision | System behavior | Operator guidance or next action | Owner |
| --- | --- | --- | --- |
| <condition> | <behavior> | <guidance> | <role or system> |

## States And Recovery

| Situation | What is shown or preserved | Next safe action | Recovery or escalation |
| --- | --- | --- | --- |
| Loading | <truthful progress or wait state> | <allowed action> | <behavior> |
| Empty | <why there is no work> | <next useful action> | <behavior> |
| Stale | <staleness signal and impact> | <refresh, review, or continue rule> | <behavior> |
| Partial success | <completed and unresolved work> | <review or retry rule> | <behavior> |
| Error | <clear failure and unaffected work> | <retry or alternative> | <owner and handoff> |
| Cancelled or interrupted | <durable state after interruption> | <resume or discard rule> | <behavior> |

## Audit And Duplicate Prevention

- **What is recorded:** <actor, time, scope, decision, result, or evidence>
- **Duplicate prevention:** <how repeated submissions or overlapping work are handled>
- **Resume or retry eligibility:** <which conditions can be retried and which require review>

## Acceptance Criteria

- [ ] observable behavior and outcome
- [ ] meaningful branch or recovery outcome
- [ ] state visibility, auditability, or duplicate-prevention outcome
- [ ] permission, privacy, or evidence requirement
