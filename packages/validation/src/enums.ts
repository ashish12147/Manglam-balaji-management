import {
  ACCESS_TYPES,
  API_ERROR_CODES,
  APPROVAL_SOURCES,
  ATTENDANCE_STATUSES,
  AUDIENCE_TYPES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  DAILY_HELP_STATUSES,
  DAILY_HELP_TYPES,
  DEVICE_STATUSES,
  EMERGENCY_CATEGORIES,
  EMERGENCY_STATUSES,
  FILE_UPLOAD_STATUSES,
  IDEMPOTENCY_STATUSES,
  MAINTENANCE_CHARGE_STATUSES,
  MEMBERSHIP_RELATIONSHIPS,
  MEMBERSHIP_STATUSES,
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  OCCUPANCY_TYPES,
  OFFLINE_MUTATION_OPERATIONS,
  OFFLINE_SYNC_STATUSES,
  OUTBOX_STATUSES,
  PARCEL_DECISIONS,
  PARCEL_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRE_APPROVAL_STATUSES,
  RECEIPT_STATUSES,
  SESSION_STATUSES,
  USER_STATUSES,
  VISIT_APPROVAL_STATUSES,
  VISITOR_CATEGORIES,
  VISIT_SOURCES,
  VISIT_STATUSES,
} from '@manglam/types';
import { z } from 'zod';

export const userStatusSchema = z.enum(USER_STATUSES);
export const sessionStatusSchema = z.enum(SESSION_STATUSES);
export const deviceStatusSchema = z.enum(DEVICE_STATUSES);
export const membershipRelationshipSchema = z.enum(MEMBERSHIP_RELATIONSHIPS);
export const occupancyTypeSchema = z.enum(OCCUPANCY_TYPES);
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);
export const visitorCategorySchema = z.enum(VISITOR_CATEGORIES);
export const visitSourceSchema = z.enum(VISIT_SOURCES);
export const visitStatusSchema = z.enum(VISIT_STATUSES);
export const visitApprovalStatusSchema = z.enum(VISIT_APPROVAL_STATUSES);
export const approvalSourceSchema = z.enum(APPROVAL_SOURCES);
export const accessTypeSchema = z.enum(ACCESS_TYPES);
export const preApprovalStatusSchema = z.enum(PRE_APPROVAL_STATUSES);
export const dailyHelpTypeSchema = z.enum(DAILY_HELP_TYPES);
export const dailyHelpStatusSchema = z.enum(DAILY_HELP_STATUSES);
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export const parcelStatusSchema = z.enum(PARCEL_STATUSES);
export const parcelDecisionSchema = z.enum(PARCEL_DECISIONS);
export const noticeCategorySchema = z.enum(NOTICE_CATEGORIES);
export const noticePrioritySchema = z.enum(NOTICE_PRIORITIES);
export const noticeStatusSchema = z.enum(NOTICE_STATUSES);
export const audienceTypeSchema = z.enum(AUDIENCE_TYPES);
export const complaintPrioritySchema = z.enum(COMPLAINT_PRIORITIES);
export const complaintStatusSchema = z.enum(COMPLAINT_STATUSES);
export const maintenanceChargeStatusSchema = z.enum(MAINTENANCE_CHARGE_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const receiptStatusSchema = z.enum(RECEIPT_STATUSES);
export const emergencyCategorySchema = z.enum(EMERGENCY_CATEGORIES);
export const emergencyStatusSchema = z.enum(EMERGENCY_STATUSES);
export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const notificationDeliveryStatusSchema = z.enum(NOTIFICATION_DELIVERY_STATUSES);
export const fileUploadStatusSchema = z.enum(FILE_UPLOAD_STATUSES);
export const outboxStatusSchema = z.enum(OUTBOX_STATUSES);
export const offlineSyncStatusSchema = z.enum(OFFLINE_SYNC_STATUSES);
export const idempotencyStatusSchema = z.enum(IDEMPOTENCY_STATUSES);
export const offlineMutationOperationSchema = z.enum(OFFLINE_MUTATION_OPERATIONS);
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
