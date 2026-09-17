---
name: form-conventions
description: >
  Implements and reviews OmniCart forms with React Hook Form, Zod, disabled
  native browser validation, and localized validation messages. Load for form
  components, form hooks, or user-facing Zod validation schemas.
---

# Form Implementation Conventions

This skill owns form implementation boundaries. Use `../flow-forms/SKILL.md`
for UX decisions such as field count, validation timing, step structure, and
error-summary behavior.

## RHF and Zod Are The Validation Authority

- Use React Hook Form for form state and submission.
- Use a Zod schema through `zodResolver` for validation.
- Submit through RHF `handleSubmit`; do not duplicate validation in ad-hoc
  component conditionals.
- Put `noValidate` on the `<form>` so browser-native validation bubbles do not
  bypass RHF error handling or show unlocalized copy.
- Keep semantic input attributes such as `type`, `inputMode`, and
  `autoComplete`. They improve keyboards and autofill but are not the source of
  validation messages.
- Render errors from `formState.errors` and connect them to their controls with
  `aria-invalid` and `aria-describedby` where the shared field primitive does
  not already do so.

Server Actions must validate the submitted payload again. Client validation is
interaction feedback, not a trust boundary.

### ❌ Wrong — Missing noValidate, ad-hoc validation in submit handler, untrusted server action

```tsx
// ❌ WRONG: Missing noValidate allows browser default bubbles to show unlocalized messages
export function BadLoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // WRONG: Manual conditional validation instead of Zod schema authority
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Invalid email');
      return;
    }
    await loginAction({ email }); // Server action assumes client validated!
  };

  return (
    <form onSubmit={handleManualSubmit}>
      <input
        type="email"
        required // Triggers unlocalized browser native bubble!
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <span>{error}</span>}
      <button type="submit">Sign In</button>
    </form>
  );
}
```

### ✅ Correct — RHF + zodResolver, noValidate, accessible ARIA error link, server-side re-validation

```tsx
// Client Form Component
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input, Button } from '@/components/atoms';
import { loginSchema, type LoginInput } from '@/forms/schemas';

export function GoodLoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (values: LoginInput) => {
    // Form already validated by Zod schema through RHF handleSubmit
    await loginAction(values);
  };

  return (
    // noValidate prevents browser-native bubbles from overriding localized errors
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-xs font-semibold text-foreground">
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          {...register('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
        />
        {errors.email && (
          <p id="login-email-error" className="text-xs text-semantic-error" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Sign In
      </Button>
    </form>
  );
}

// Server Action Boundary (Re-validates payload)
export async function loginAction(input: unknown): Promise<ActionResponse<void>> {
  // Never trust client validation alone; server action must execute safeParse
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } };
  }
  // Proceed with parsed.data ...
}
```

---

## Localize Every User-Facing Validation Message

Review every changed form-related file, including files under `src/forms`, not
only TSX markup and dictionaries. Literal English or Vietnamese Zod messages,
RHF messages, error banners, and toasts are user-facing strings and must not be
hardcoded.

Use one of these stable patterns:

1. A schema factory accepts already translated messages and the component
   creates the schema from `useTranslations`.
2. A shared/server schema emits stable translation keys or error codes and the
   presentation boundary translates them before display.

Do not display a translation key such as
`authentication.login.errors.emailRequired` directly to the user. Do not call
React translation hooks from module-scope schema files.

Every new validation key must exist at the same path in both
`src/messages/vi.json` and `src/messages/en.json`. The rules and automated
checks in `../i18n-check/SKILL.md` remain authoritative for dictionary parity
and language purity.

### ❌ Wrong — Hardcoded literal messages or hook called at module level

```typescript
// in src/forms/userFormSchema.ts:

// ❌ WRONG: Hardcoding literal strings prevents localization
export const badUserSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
  displayName: z.string().min(1, 'Display name is required'), // English literal in Vietnamese flow!
});

// ❌ WRONG: Calling React translation hook at module scope (crashes outside React render)
import { useTranslations } from 'next-intl';
const t = useTranslations('validation'); // Invalid hook call!
export const crashedSchema = z.object({
  email: z.string().min(1, t('emailRequired')),
});
```

### ✅ Correct — Schema factory accepting translated messages

```typescript
// in src/forms/userAccessFormSchema.ts:
export type UserProvisionValidationMessages = {
  readonly emailRequired?: string;
  readonly invalidEmail?: string;
  readonly displayNameRequired?: string;
};

// Schema factory function
export function getUserProvisionSchema(messages?: UserProvisionValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages?.emailRequired ?? 'Login email is required')
      .email(messages?.invalidEmail ?? 'Invalid email address')
      .max(254),
    displayName: z
      .string()
      .trim()
      .min(1, messages?.displayNameRequired ?? 'Display name is required')
      .max(120),
  });
}

// Default export for server validation fallback
export const userProvisionSchema = getUserProvisionSchema();
```

```tsx
// in src/components/organisms/User/UserAccessForm.tsx:
export function UserAccessForm() {
  const t = useTranslations('userAccess.validation');

  // Schema created via useMemo with localized messages injected
  const schema = useMemo(
    () =>
      getUserProvisionSchema({
        emailRequired: t('emailRequired'),
        invalidEmail: t('invalidEmail'),
        displayNameRequired: t('displayNameRequired'),
      }),
    [t],
  );

  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  });
  ...
}
```

---

## Reuse Schemas And Inferred Types

Reuse the same Zod schema or a deliberate shared base for client and server
validation when their accepted contracts are the same. Derive form values with
`z.input`, `z.output`, or `z.infer`; do not hand-copy a parallel form-value
type.

Split schemas only when the boundaries intentionally differ, such as a client
form accepting a confirmation field that the server command does not persist.
Document the transformation rather than maintaining two silently divergent
shapes.

### ❌ Wrong — Hand-written parallel TypeScript types and divergent schemas

```typescript
// ❌ WRONG: Hand-crafted type duplicates Zod schema and drifts over time
export const userUpdateSchema = z.object({
  userId: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'member', 'owner']),
});

// Redundant and fragile: if schema adds a field, this manual type does not update!
export type UserUpdateFormValues = {
  userId: number;
  displayName: string;
  role: string; // Lost string literal union safety!
};
```

### ✅ Correct — Inferred types with z.infer and shared base schema extension

```typescript
// in src/forms/schemas/userAccessSchema.ts:

// 1. Shared base contract
export const baseUserSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(254).optional().nullable(),
  role: z.enum(['admin', 'member', 'viewer']),
});

// 2. Client-specific extension (e.g. with confirmation field)
export const clientUserCreateSchema = baseUserSchema.extend({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

// 3. Server-persisted command schema (only base + password, no confirmation)
export const serverUserCreateSchema = baseUserSchema.extend({
  password: z.string().min(8).max(128),
  idempotencyKey: z.string().trim().min(1).max(191),
});

// 4. Authoritative inferred types: zero manual duplication
export type ClientUserCreateValues = z.infer<typeof clientUserCreateSchema>;
export type ServerUserCreateValues = z.infer<typeof serverUserCreateSchema>;
```

