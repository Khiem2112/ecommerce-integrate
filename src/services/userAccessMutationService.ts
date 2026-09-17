import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/services/authentication/authCredentialService';
import type {
  DbClient,
  MembershipRemovalResult,
  OrganizationRoleCode,
  PasswordResetResult,
  UserAccessDetail,
  UserProvisioningResult,
} from '@/types';
import { canonicalizeEmail } from '@/utils/email';
import { appendOrganizationAuditService } from './organizationAuditService';
import {
  canActorAssignRole,
  canActorManageTarget,
  canActorManageUsers,
  canActorResetPassword,
} from './userAccessPermissionService';
import { getUserAccessDetailService } from './userAccessQueryService';

export type ProvisionUserAccessInput = {
  readonly email: string;
  readonly displayName: string;
  readonly contactEmail?: string | null;
  readonly role: OrganizationRoleCode;
  readonly customPassword?: string | null;
  readonly idempotencyKey: string;
};

export type UpdateUserAccessInput = {
  readonly userId: number;
  readonly expectedVersion: number;
  readonly displayName: string;
  readonly contactEmail?: string | null;
  readonly role: OrganizationRoleCode;
  readonly idempotencyKey: string;
};

export type ResetUserPasswordInput = {
  readonly userId: number;
  readonly customPassword?: string | null;
  readonly idempotencyKey: string;
};

export type RemoveUserAccessInput = {
  readonly userId: number;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
};

function generateTemporaryPassword(): string {
  const chars =
    'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(14);
  let pwd = '';
  for (let i = 0; i < 14; i++) {
    pwd += chars[randomBytes[i] % chars.length];
  }
  return pwd;
}

async function getActorActiveRole(
  actorUserId: number,
  organizationId: number,
  tx: DbClient,
): Promise<OrganizationRoleCode> {
  const membership = await tx.organizationMember.findFirst({
    where: {
      userId: actorUserId,
      organizationId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
    },
    include: {
      role: true,
    },
  });

  if (!membership) {
    throw new Error('Không có quyền truy cập tổ chức làm việc.');
  }

  return membership.role.code as OrganizationRoleCode;
}

export async function provisionUserAccessService(
  actorUserId: number,
  activeOrgId: number,
  input: ProvisionUserAccessInput,
  tx: DbClient = prisma,
): Promise<UserProvisioningResult> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  if (!canActorManageUsers(actorRole)) {
    throw new Error('Chỉ Owner hoặc Admin mới có quyền thêm người dùng.');
  }

  if (!canActorAssignRole(actorRole, input.role)) {
    throw new Error('Bạn không có quyền gán vai trò này.');
  }

  // Idempotency check: if this operation was already committed for this correlation ID, return safe result
  const existingAudit = await tx.organizationAuditLog.findFirst({
    where: {
      organizationId: activeOrgId,
      correlationId: input.idempotencyKey,
    },
  });

  if (existingAudit && existingAudit.targetId) {
    const existingUserId = parseInt(existingAudit.targetId, 10);
    const existingMember = await tx.organizationMember.findFirst({
      where: {
        organizationId: activeOrgId,
        userId: existingUserId,
      },
    });

    return {
      outcome: 'already_active',
      userId: existingUserId,
      membershipId: existingMember?.id ?? 0,
      message: 'Yêu cầu này đã được xử lý trước đó.',
    };
  }

  const normalizedEmail = canonicalizeEmail(input.email);
  const trimmedDisplayName = input.displayName.trim();
  const trimmedContactEmail = input.contactEmail?.trim() || null;

  // Retrieve role and active status catalog IDs
  const [roleRecord, activeStatus] = await Promise.all([
    tx.organizationRoleCatalog.findFirst({
      where: { code: input.role, isActive: true },
    }),
    tx.organizationMembershipStatus.findFirst({
      where: { code: 'active', isActive: true },
    }),
  ]);

  if (!roleRecord || !activeStatus) {
    throw new Error('Dữ liệu vai trò hoặc trạng thái không khả dụng.');
  }

  const existingUser = await tx.user.findFirst({
    where: {
      email: normalizedEmail,
    },
  });

  // Branch A: Global user does NOT exist -> Create User + Credential + OrganizationMember atomically
  if (!existingUser) {
    const rawPassword =
      input.customPassword && input.customPassword.trim().length >= 8
        ? input.customPassword.trim()
        : generateTemporaryPassword();

    const passwordHash = await hashPassword(rawPassword);
    const subjectId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;

    const newUser = await tx.user.create({
      data: {
        subjectId,
        displayName: trimmedDisplayName,
        email: normalizedEmail,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      },
    });

    const newMember = await tx.organizationMember.create({
      data: {
        organizationId: activeOrgId,
        userId: newUser.id,
        displayName: trimmedDisplayName,
        contactEmail: trimmedContactEmail,
        roleId: roleRecord.id,
        membershipStatusId: activeStatus.id,
        version: 1,
        isActive: true,
      },
    });

    await appendOrganizationAuditService(
      {
        organizationId: activeOrgId,
        actorUserId,
        action: 'user.provision',
        targetType: 'user_access',
        targetId: String(newUser.id),
        correlationId: input.idempotencyKey,
        afterSnapshot: {
          role: input.role,
          displayName: trimmedDisplayName,
          outcome: 'created',
        },
      },
      tx,
    );

    return {
      outcome: 'created',
      userId: newUser.id,
      membershipId: newMember.id,
      temporaryPassword: rawPassword,
      mustChangePassword: true,
    };
  }

  // Branch B: Global user exists -> check membership in active organization
  const existingMembership = await tx.organizationMember.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: existingUser.id,
    },
    include: {
      membershipStatus: true,
    },
  });

  // Sub-branch B1: No membership in active organization -> Attach
  if (!existingMembership) {
    const newMember = await tx.organizationMember.create({
      data: {
        organizationId: activeOrgId,
        userId: existingUser.id,
        displayName: trimmedDisplayName,
        contactEmail: trimmedContactEmail,
        roleId: roleRecord.id,
        membershipStatusId: activeStatus.id,
        version: 1,
        isActive: true,
      },
    });

    await appendOrganizationAuditService(
      {
        organizationId: activeOrgId,
        actorUserId,
        action: 'user.attach',
        targetType: 'user_access',
        targetId: String(existingUser.id),
        correlationId: input.idempotencyKey,
        afterSnapshot: {
          role: input.role,
          displayName: trimmedDisplayName,
          outcome: 'attached',
        },
      },
      tx,
    );

    return {
      outcome: 'attached',
      userId: existingUser.id,
      membershipId: newMember.id,
    };
  }

  // Sub-branch B2: Membership is removed -> Restore existing record
  if (existingMembership.membershipStatus.code === 'removed') {
    const updatedMember = await tx.organizationMember.update({
      where: {
        id: existingMembership.id,
      },
      data: {
        membershipStatusId: activeStatus.id,
        isActive: true,
        displayName: trimmedDisplayName,
        contactEmail: trimmedContactEmail,
        roleId: roleRecord.id,
        version: { increment: 1 },
      },
    });

    await appendOrganizationAuditService(
      {
        organizationId: activeOrgId,
        actorUserId,
        action: 'user.restore',
        targetType: 'user_access',
        targetId: String(existingUser.id),
        correlationId: input.idempotencyKey,
        beforeSnapshot: {
          status: 'removed',
        },
        afterSnapshot: {
          status: 'active',
          role: input.role,
          displayName: trimmedDisplayName,
          outcome: 'restored',
        },
      },
      tx,
    );

    return {
      outcome: 'restored',
      userId: existingUser.id,
      membershipId: updatedMember.id,
    };
  }

  // Sub-branch B3: Membership already active
  return {
    outcome: 'already_active',
    userId: existingUser.id,
    membershipId: existingMembership.id,
    message: 'Người dùng đã là thành viên đang hoạt động trong tổ chức này.',
  };
}

export async function updateUserAccessService(
  actorUserId: number,
  activeOrgId: number,
  input: UpdateUserAccessInput,
  tx: DbClient = prisma,
): Promise<UserAccessDetail> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  const targetMember = await tx.organizationMember.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: input.userId,
    },
    include: {
      role: true,
    },
  });

  if (!targetMember) {
    throw new Error('Không tìm thấy thành viên trong tổ chức.');
  }

  const targetRole = targetMember.role.code as OrganizationRoleCode;

  if (!canActorManageTarget(actorRole, actorUserId, targetRole, input.userId)) {
    throw new Error('Bạn không có quyền chỉnh sửa thành viên này.');
  }

  if (targetRole !== input.role && !canActorAssignRole(actorRole, input.role)) {
    throw new Error('Bạn không có quyền gán vai trò được chọn.');
  }

  // Optimistic concurrency check
  if (targetMember.version !== input.expectedVersion) {
    throw new Error(
      'Dữ liệu đã được cập nhật bởi một người dùng khác. Vui lòng tải lại trang.',
    );
  }

  const roleRecord = await tx.organizationRoleCatalog.findFirst({
    where: { code: input.role, isActive: true },
  });

  if (!roleRecord) {
    throw new Error('Vai trò được chọn không khả dụng.');
  }

  const trimmedDisplayName = input.displayName.trim();
  const trimmedContactEmail = input.contactEmail?.trim() || null;

  await tx.organizationMember.update({
    where: {
      id: targetMember.id,
    },
    data: {
      displayName: trimmedDisplayName,
      contactEmail: trimmedContactEmail,
      roleId: roleRecord.id,
      version: { increment: 1 },
    },
  });

  await appendOrganizationAuditService(
    {
      organizationId: activeOrgId,
      actorUserId,
      action: 'user.update',
      targetType: 'user_access',
      targetId: String(input.userId),
      correlationId: input.idempotencyKey,
      beforeSnapshot: {
        displayName: targetMember.displayName,
        contactEmail: targetMember.contactEmail,
        role: targetRole,
        version: targetMember.version,
      },
      afterSnapshot: {
        displayName: trimmedDisplayName,
        contactEmail: trimmedContactEmail,
        role: input.role,
        version: targetMember.version + 1,
      },
    },
    tx,
  );

  const detail = await getUserAccessDetailService(actorUserId, activeOrgId, input.userId, tx);
  if (!detail) {
    throw new Error('Lỗi khi lấy thông tin sau cập nhật.');
  }

  return detail;
}

export async function resetUserPasswordService(
  actorUserId: number,
  activeOrgId: number,
  input: ResetUserPasswordInput,
  tx: DbClient = prisma,
): Promise<PasswordResetResult> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  const targetMember = await tx.organizationMember.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: input.userId,
    },
    include: {
      role: true,
      user: true,
    },
  });

  if (!targetMember) {
    throw new Error('Không tìm thấy thành viên trong tổ chức.');
  }

  const targetRole = targetMember.role.code as OrganizationRoleCode;

  if (!canActorResetPassword(actorRole, actorUserId, targetRole, input.userId)) {
    throw new Error('Bạn không có quyền đặt lại mật khẩu cho thành viên này.');
  }

  const rawPassword =
    input.customPassword && input.customPassword.trim().length >= 8
      ? input.customPassword.trim()
      : generateTemporaryPassword();

  const passwordHash = await hashPassword(rawPassword);

  await tx.user.update({
    where: {
      id: input.userId,
    },
    data: {
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  await appendOrganizationAuditService(
    {
      organizationId: activeOrgId,
      actorUserId,
      action: 'user.password_reset',
      targetType: 'user_access',
      targetId: String(input.userId),
      correlationId: input.idempotencyKey,
      afterSnapshot: {
        mustChangePassword: true,
      },
    },
    tx,
  );

  return {
    userId: input.userId,
    displayName: targetMember.displayName,
    temporaryPassword: rawPassword,
    mustChangePassword: true,
  };
}

export async function removeUserAccessService(
  actorUserId: number,
  activeOrgId: number,
  input: RemoveUserAccessInput,
  tx: DbClient = prisma,
): Promise<MembershipRemovalResult> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  const targetMember = await tx.organizationMember.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: input.userId,
    },
    include: {
      role: true,
    },
  });

  if (!targetMember) {
    throw new Error('Không tìm thấy thành viên trong tổ chức.');
  }

  const targetRole = targetMember.role.code as OrganizationRoleCode;

  if (actorUserId === input.userId) {
    throw new Error('Bạn không thể tự gỡ quyền truy cập của chính mình.');
  }

  if (targetRole === 'owner') {
    throw new Error('Không thể gỡ quyền thành viên Owner của tổ chức.');
  }

  if (!canActorManageTarget(actorRole, actorUserId, targetRole, input.userId)) {
    throw new Error('Bạn không có quyền gỡ bỏ thành viên này.');
  }

  if (targetMember.version !== input.expectedVersion) {
    throw new Error(
      'Dữ liệu đã được cập nhật bởi một người dùng khác. Vui lòng thử lại.',
    );
  }

  const removedStatus = await tx.organizationMembershipStatus.findFirst({
    where: { code: 'removed', isActive: true },
  });

  if (!removedStatus) {
    throw new Error('Trạng thái không khả dụng.');
  }

  // Soft-remove membership by updating status to removed and isActive to false
  await tx.organizationMember.update({
    where: {
      id: targetMember.id,
    },
    data: {
      membershipStatusId: removedStatus.id,
      isActive: false,
      version: { increment: 1 },
    },
  });

  // Clean up context preference if active
  await tx.organizationContextPreference.deleteMany({
    where: {
      userId: input.userId,
      organizationId: activeOrgId,
    },
  });

  await appendOrganizationAuditService(
    {
      organizationId: activeOrgId,
      actorUserId,
      action: 'user.remove',
      targetType: 'user_access',
      targetId: String(input.userId),
      correlationId: input.idempotencyKey,
      beforeSnapshot: {
        role: targetRole,
        status: 'active',
      },
      afterSnapshot: {
        status: 'removed',
      },
    },
    tx,
  );

  return {
    userId: input.userId,
    organizationId: activeOrgId,
    status: 'removed',
    targetMustRelog: true,
  };
}
