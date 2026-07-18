import 'reflect-metadata';

import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { OperationsController } from '../../src/modules/operations/operations.controller.js';
import {
  complaintAssignSchema,
  noticeCreateSchema,
  operationsListQuerySchema,
  paymentCreateSchema,
} from '../../src/modules/operations/operations.schemas.js';

function routes(): Set<string> {
  const result = new Set<string>();
  for (const name of Object.getOwnPropertyNames(OperationsController.prototype)) {
    const handler = Object.getOwnPropertyDescriptor(OperationsController.prototype, name)?.value;
    if (typeof handler !== 'function') continue;
    const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (path !== undefined && method !== undefined) {
      result.add(`${RequestMethod[method]} /${path}`);
    }
  }
  return result;
}

describe('operations API contract', () => {
  it('exposes the high-value admin resource routes', () => {
    const actual = routes();
    for (const route of [
      'GET /admin/dashboard',
      'GET /users',
      'GET /guards',
      'GET /guards/devices',
      'GET /visitors/visits',
      'GET /visitors/approvals',
      'GET /parcels',
      'GET /notices',
      'POST /notices',
      'POST /notices/:noticeId/publish',
      'GET /complaints',
      'POST /complaints/:complaintId/assign',
      'POST /complaints/:complaintId/transition',
      'GET /maintenance/charges',
      'GET /maintenance/payments',
      'POST /maintenance/payments',
      'POST /maintenance/allocations',
      'GET /emergencies',
      'POST /emergencies/:alertId/acknowledge',
      'POST /emergencies/:alertId/respond',
      'POST /emergencies/:alertId/resolve',
    ])
      expect(actual.has(route), route).toBe(true);
  });

  it('bounds and validates cursor pagination', () => {
    expect(operationsListQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(operationsListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(operationsListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('requires a concrete audience for notices', () => {
    const parsed = noticeCreateSchema.safeParse({
      audienceType: 'ALL_RESIDENTS',
      targetIds: [],
      body: 'Water supply will be unavailable during scheduled maintenance.',
      category: 'WATER',
      acknowledgementRequired: true,
      title: 'Scheduled water maintenance',
    });
    expect(parsed.success).toBe(true);
    expect(
      noticeCreateSchema.safeParse({
        audienceType: 'FLAT',
        targetIds: [],
        body: 'No audience',
        category: 'GENERAL',
        title: 'Invalid notice',
      }).success,
    ).toBe(false);
  });

  it('matches admin complaint and offline-payment payload names', () => {
    expect(
      complaintAssignSchema.safeParse({
        assignedToUserId: '3c59e547-3667-4db8-9837-411240bf43d2',
        note: 'Assigned to the electrical maintenance team.',
      }).success,
    ).toBe(true);
    expect(
      paymentCreateSchema.safeParse({
        amount: 2500,
        flatId: '5df3bade-d9bf-477f-b47a-32fcf088a851',
        method: 'UPI_EXTERNAL',
        receivedAt: '2026-07-18T10:00:00+05:30',
        reference: 'UPI-20260718-0001',
      }).success,
    ).toBe(true);
  });
});
