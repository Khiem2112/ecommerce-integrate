# TypeScript Commenting Guidelines: Good vs. Bad Practice

This reference demonstrates the standard commenting convention for the codebase:
- **Rule**: Write concise block comments explaining **domain purpose, business rules, and algorithmic intent** (the "Why", not just "What").
- **Prohibitions**:
  - Do **NOT** prefix comments with positional indicators or step numbers (no `// 1. ...`, `// Step X`, `// Part A`).
  - Do **NOT** write redundant comments that merely restate obvious TypeScript syntax (e.g., `// Call function`, `// Return result`).
  - Do **NOT** write vague or meaningless comments (e.g., `// Do check`, `// Process data`).

---

### ❌ BAD PRACTICE: Redundant Syntax Restatements or Vague Comments Without Domain Intent
```typescript
// ❌ INCORRECT: Trivial comments restating code syntax, vague labels without business rationale
export function validateGrounding(response: RagResponse, context: FullCustomerContext): GroundingResult {
  // Check PII
  const piiViolations = detectPiiViolations(response.responseText);

  // Check policy
  const policyViolations = checkVoucherPolicyViolations(response.responseText);

  // Verify facts
  const ungroundedFacts = verifyFactGrounding(response.groundedFactsUsed, context.evidence.facts);

  // Merge violations array
  const allViolations = [...piiViolations, ...policyViolations];

  // Calculate score and validate
  const precision = calculateGroundingPrecision(response, ungroundedFacts, allViolations);
  const isGroundingValid = isSafeAndGrounded(allViolations, ungroundedFacts);

  // Return object
  return {
    isValid: isGroundingValid,
    groundingPrecision: precision,
    violations: allViolations,
    sanitizedResponse: sanitizeResponseByGrounding(response, ungroundedFacts, isGroundingValid, precision),
  };
}
```

---

### ✅ GOOD PRACTICE: Descriptive Block Comments Explaining Domain Intent & Rationale
```typescript
// ✅ CORRECT: Descriptive block comments explaining domain purpose and intent without positional numbering
export function validateGrounding(response: RagResponse, context: FullCustomerContext): GroundingResult {
  // Validate text against sensitive PII exposure patterns (phone, email, payment cards)
  const piiViolations = detectPiiViolations(response.responseText);

  // Enforce marketplace voucher limits to prevent unauthorized compensation commitments
  const policyViolations = checkVoucherPolicyViolations(response.responseText);

  // Cross-reference referenced claim IDs against Layer 1-3 ground-truth evidence facts
  const ungroundedFacts = verifyFactGrounding(response.groundedFactsUsed, context.evidence.facts);

  const allViolations = [...piiViolations, ...policyViolations];

  // Evaluate precision score and downgrade action if grounding confidence is below threshold
  const precision = calculateGroundingPrecision(response, ungroundedFacts, allViolations);
  const isGroundingValid = isSafeAndGrounded(allViolations, ungroundedFacts);

  return {
    isValid: isGroundingValid,
    groundingPrecision: precision,
    violations: allViolations,
    sanitizedResponse: sanitizeResponseByGrounding(response, ungroundedFacts, isGroundingValid, precision),
  };
}
```
