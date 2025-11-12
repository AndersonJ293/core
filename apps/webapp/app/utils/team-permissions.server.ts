import { json } from "@remix-run/node";
import { permissionService, PermissionError } from "~/services/permission.server";
import { requireUser } from "~/services/session.server";

export async function requireTeamMember(request: Request, teamId?: string) {
  const user = await requireUser(request);

  if (!teamId) {
    throw new Response('Team ID is required', { status: 400 });
  }

  const membership = await permissionService.requireTeamMember(user.id, teamId);
  return { user, teamId, membership };
}

export async function requireTeamAdmin(request: Request, teamId?: string) {
  const user = await requireUser(request);

  if (!teamId) {
    throw new Response('Team ID is required', { status: 400 });
  }

  const membership = await permissionService.requireTeamAdmin(user.id, teamId);
  return { user, teamId, membership };
}

export async function requireTeamOwner(request: Request, teamId?: string) {
  const user = await requireUser(request);

  if (!teamId) {
    throw new Response('Team ID is required', { status: 400 });
  }

  const membership = await permissionService.requireTeamOwner(user.id, teamId);
  return { user, teamId, membership };
}

export async function requireSpaceReadAccess(request: Request, spaceId: string) {
  const user = await requireUser(request);

  if (!spaceId) {
    throw new Response('Space ID is required', { status: 400 });
  }

  const check = await permissionService.checkSpaceAccess(user.id, spaceId, 'read');

  if (!check.allowed) {
    throw new Response(
      json({ error: check.reason || 'Permission denied' }),
      { status: 403 }
    );
  }

  return { user, spaceId };
}

export async function requireSpaceWriteAccess(request: Request, spaceId: string) {
  const user = await requireUser(request);

  if (!spaceId) {
    throw new Response('Space ID is required', { status: 400 });
  }

  const check = await permissionService.checkSpaceAccess(user.id, spaceId, 'write');

  if (!check.allowed) {
    throw new Response(
      json({ error: check.reason || 'Permission denied' }),
      { status: 403 }
    );
  }

  return { user, spaceId };
}

export async function requireSpaceAdminAccess(request: Request, spaceId: string) {
  const user = await requireUser(request);

  if (!spaceId) {
    throw new Response('Space ID is required', { status: 400 });
  }

  const check = await permissionService.checkSpaceAccess(user.id, spaceId, 'admin');

  if (!check.allowed) {
    throw new Response(
      json({ error: check.reason || 'Permission denied' }),
      { status: 403 }
    );
  }

  return { user, spaceId };
}
