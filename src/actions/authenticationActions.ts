'use server';

import { cookies, headers } from 'next/headers';
import { signIn, signOut } from '@/auth';
import { AUTH_CONFIG } from '@/config/authentication';
import {
  loginFormSchema,
  mandatoryPasswordChangeSchema,
  selectOrganizationSchema,
  voluntaryPasswordChangeSchema,
  type LoginFormValues,
  type MandatoryPasswordChangeValues,
  type SelectOrganizationValues,
  type VoluntaryPasswordChangeValues,
} from '@/forms';
import {
  checkRateLimit,
  getActiveOrganizationContextService,
  getAuthenticatedSessionContextService,
  getUserActiveMembershipCountService,
  hashPassword,
  logAuthSecurityEvent,
  recordFailedAttempt,
  requireAuthenticatedUserService,
  resetRateLimit,
  switchActiveOrganizationContextService,
  updateUserPasswordService,
  verifyUserCredentialsService,
  verifyUserPasswordByIdService,
} from '@/services';
import type {
  ActionResponse,
  ActiveSessionContext,
  LoginResult,
  UserSessionProjection,
} from '@/types';
import { validateSafeReturnUrl } from '@/utils';

async function getClientMetadata(): Promise<{ ip: string; userAgent?: string }> {
  const headerStore = await headers();
  const rawIp =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = headerStore.get('user-agent') || undefined;
  return { ip: rawIp, userAgent };
}

async function getRequestedOrgIdFromCookie(): Promise<number | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(AUTH_CONFIG.ACTIVE_ORG_COOKIE_NAME)?.value;
    const parsed = raw ? parseInt(raw, 10) : null;
    return parsed && !isNaN(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Server Action: User Login (NextAuth Credentials + Decoupled Org Context)
 */
export async function loginAction(
  payload: LoginFormValues,
): Promise<ActionResponse<LoginResult>> {
  try {
    const parsed = loginFormSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Dữ liệu đăng nhập không hợp lệ.',
      };
    }

    const { email, password, returnUrl } = parsed.data;
    const { ip, userAgent } = await getClientMetadata();

    // Validate in-memory rate limit threshold against abusive attempts
    const rateLimit = checkRateLimit(ip, email);
    if (!rateLimit.allowed) {
      logAuthSecurityEvent({
        event: 'AUTH_RATE_LIMITED',
        email,
        ip,
        userAgent,
        reason: `Exceeded attempt limit. Retry in ${rateLimit.retryAfterSeconds}s`,
      });
      return {
        success: false,
        error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`,
      };
    }

    // Perform timing-safe credential verification against user database
    const credResult = await verifyUserCredentialsService(email, password);
    if (!credResult) {
      const updatedRate = recordFailedAttempt(ip, email);
      logAuthSecurityEvent({
        event: 'AUTH_LOGIN_FAILED',
        email,
        ip,
        userAgent,
        reason: 'Invalid email or password',
      });

      if (!updatedRate.allowed) {
        return {
          success: false,
          error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${updatedRate.retryAfterSeconds} giây.`,
        };
      }

      return {
        success: false,
        error: 'Thông tin đăng nhập không chính xác hoặc tài khoản không thể truy cập.',
      };
    }

    // Reset failed attempt counts upon authenticated credential verification
    resetRateLimit(ip, email);

    const { user } = credResult;

    // Authenticate user session with Auth.js credentials provider
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    // Resolve initial active organization context preference and persist session cookie
    let verifiedActiveOrgId: number | null = null;
    const activeOrg = await getActiveOrganizationContextService(user.id);
    if (activeOrg.organizationId) {
      verifiedActiveOrgId = activeOrg.organizationId;
      const cookieStore = await cookies();
      cookieStore.set(
        AUTH_CONFIG.ACTIVE_ORG_COOKIE_NAME,
        String(verifiedActiveOrgId),
        AUTH_CONFIG.ACTIVE_ORG_COOKIE_OPTIONS,
      );
    }

    // Compute session state constraints and determine post-login destination
    let computedState: 'restricted_password_change' | 'context_pending' | 'active' =
      verifiedActiveOrgId ? 'active' : 'context_pending';

    let destination = '/conversations';
    if (user.mustChangePassword) {
      computedState = 'restricted_password_change';
      destination = '/change-password';
    } else if (computedState === 'context_pending') {
      const membershipCount = await getUserActiveMembershipCountService(user.id);
      destination = membershipCount > 0 ? '/select-organization' : '/no-active-membership';
    } else if (returnUrl) {
      destination = validateSafeReturnUrl(returnUrl);
    }

    logAuthSecurityEvent({
      event: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      ip,
      userAgent,
    });

    const userProjection: UserSessionProjection = {
      id: user.id,
      subjectId: user.subjectId,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      activeOrganizationId: verifiedActiveOrgId,
    };

    return {
      success: true,
      data: {
        redirectUrl: destination,
        user: userProjection,
        computedState,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Đăng nhập thất bại.',
    };
  }
}

/**
 * Server Action: User Logout
 */
export async function logoutAction(): Promise<ActionResponse<null>> {
  try {
    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const authContext = await getAuthenticatedSessionContextService(requestedOrgId).catch(() => null);

    const cookieStore = await cookies();
    cookieStore.delete(AUTH_CONFIG.ACTIVE_ORG_COOKIE_NAME);

    if (authContext?.user?.id) {
      logAuthSecurityEvent({
        event: 'AUTH_LOGOUT',
        userId: authContext.user.id,
      });
    }

    await signOut({ redirect: false });

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Đăng xuất thất bại.',
    };
  }
}

/**
 * Server Action: Mandatory Password Change (Temporary Password Flow)
 */
export async function changeMandatoryPasswordAction(
  payload: MandatoryPasswordChangeValues,
): Promise<ActionResponse<null>> {
  try {
    const parsed = mandatoryPasswordChangeSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Mật khẩu không hợp lệ.',
      };
    }

    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const context = await getAuthenticatedSessionContextService(requestedOrgId);
    if (!context) {
      return {
        success: false,
        error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      };
    }

    if (!context.user.mustChangePassword) {
      return {
        success: false,
        error: 'Tài khoản không ở trạng thái yêu cầu đổi mật khẩu bắt buộc.',
      };
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    const { ip, userAgent } = await getClientMetadata();

    await updateUserPasswordService(context.user.id, newHash, false);

    logAuthSecurityEvent({
      event: 'AUTH_PASSWORD_CHANGED',
      userId: context.user.id,
      email: context.user.email,
      ip,
      userAgent,
      reason: 'mandatory_change_completed',
    });

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Đổi mật khẩu thất bại.',
    };
  }
}

/**
 * Server Action: Voluntary Password Change (/settings/security)
 */
export async function changePasswordAction(
  payload: VoluntaryPasswordChangeValues,
): Promise<ActionResponse<null>> {
  try {
    const parsed = voluntaryPasswordChangeSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
      };
    }

    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const context = await requireAuthenticatedUserService(requestedOrgId);

    // Verify current password against stored hash in database using timing-safe comparison
    const isCurrentValid = await verifyUserPasswordByIdService(
      context.user.id,
      parsed.data.currentPassword,
    );
    if (!isCurrentValid) {
      return {
        success: false,
        error: 'Mật khẩu hiện tại không chính xác.',
      };
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    const { ip, userAgent } = await getClientMetadata();

    await updateUserPasswordService(context.user.id, newHash, false);

    logAuthSecurityEvent({
      event: 'AUTH_PASSWORD_CHANGED',
      userId: context.user.id,
      email: context.user.email,
      ip,
      userAgent,
      reason: 'voluntary_change_completed',
    });

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Đổi mật khẩu thất bại.',
    };
  }
}

/**
 * Server Action: Select Organization when in context_pending state
 */
export async function selectAuthenticationOrganizationAction(
  payload: SelectOrganizationValues,
): Promise<ActionResponse<null>> {
  try {
    const parsed = selectOrganizationSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Tổ chức không hợp lệ.',
      };
    }

    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const context = await requireAuthenticatedUserService(requestedOrgId);

    // Persist chosen organization context preference in database
    await switchActiveOrganizationContextService(
      context.user.id,
      parsed.data.organizationId,
    );

    // Synchronize active organization identifier to decoupled session cookie
    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_CONFIG.ACTIVE_ORG_COOKIE_NAME,
      String(parsed.data.organizationId),
      AUTH_CONFIG.ACTIVE_ORG_COOKIE_OPTIONS,
    );

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chọn tổ chức thất bại.',
    };
  }
}

/**
 * Server Action: Query authenticated session context and active organization.
 * Provides an orchestrated gateway for UI components without direct service calls.
 */
export async function getAuthenticatedSessionContextAction(): Promise<
  ActionResponse<ActiveSessionContext | null>
> {
  try {
    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const data = await getAuthenticatedSessionContextService(requestedOrgId);
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Không thể xác thực phiên làm việc.',
    };
  }
}

/**
 * Server Action: Query active organization membership count for current authenticated user.
 */
export async function getUserActiveMembershipCountAction(): Promise<
  ActionResponse<number>
> {
  try {
    const requestedOrgId = await getRequestedOrgIdFromCookie();
    const context = await getAuthenticatedSessionContextService(requestedOrgId);
    if (!context?.user?.id) {
      return { success: true, data: 0 };
    }
    const count = await getUserActiveMembershipCountService(context.user.id);
    return {
      success: true,
      data: count,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Không thể kiểm tra số lượng tổ chức.',
    };
  }
}
