export interface PermissionSubject {
  permissions?: string[] | undefined;
  roles?: Array<string | { code?: string; name?: string }> | undefined;
}

function isSuperAdmin(subject: PermissionSubject) {
  return (subject.roles ?? []).some((role) => {
    const value = typeof role === 'string' ? role : (role.code ?? role.name ?? '');
    return value.toUpperCase().replace(/[ -]/g, '_') === 'SUPER_ADMIN';
  });
}

export function hasPermission(subject: PermissionSubject | null, required?: string) {
  if (!required) return true;
  if (!subject) return false;
  if (isSuperAdmin(subject)) return true;

  const permissions = subject.permissions ?? [];
  if (permissions.includes('*') || permissions.includes(required)) return true;

  const [namespace] = required.split('.');
  return Boolean(namespace && permissions.includes(`${namespace}.*`));
}
