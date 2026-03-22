import { v4 as uuidv4 } from "uuid";
import { InvalidInsightError } from "~/server/domain/intelligence/errors";
import type {
  ResearchReminderStatus,
  ResearchReminderTargetType,
  ResearchReminderType,
} from "~/server/domain/intelligence/types";

const REMINDER_TYPES: ResearchReminderType[] = ["REVIEW"];
const REMINDER_TARGET_TYPES: ResearchReminderTargetType[] = ["TIMING_REVIEW"];
const REMINDER_STATUSES: ResearchReminderStatus[] = [
  "PENDING",
  "TRIGGERED",
  "CANCELLED",
];

export type ResearchReminderParams = {
  id?: string;
  userId: string;
  timingReviewRecordId?: string;
  stockCode: string;
  reminderType: ResearchReminderType;
  targetType: ResearchReminderTargetType;
  scheduledAt: Date;
  status?: ResearchReminderStatus;
  payload: Record<string, unknown>;
  triggeredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export class ResearchReminder {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _timingReviewRecordId: string | null;
  private readonly _stockCode: string;
  private readonly _reminderType: ResearchReminderType;
  private readonly _targetType: ResearchReminderTargetType;
  private readonly _scheduledAt: Date;
  private _status: ResearchReminderStatus;
  private readonly _payload: Record<string, unknown>;
  private _triggeredAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(params: ResearchReminderParams) {
    this._id = params.id ?? uuidv4();
    this._userId = params.userId;
    this._timingReviewRecordId = params.timingReviewRecordId ?? null;
    this._stockCode = params.stockCode;
    this._reminderType = params.reminderType;
    this._targetType = params.targetType;
    this._scheduledAt = params.scheduledAt;
    this._status = params.status ?? "PENDING";
    this._payload = params.payload;
    this._triggeredAt = params.triggeredAt ?? null;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? this._createdAt;
  }

  get id() {
    return this._id;
  }

  get userId() {
    return this._userId;
  }

  get timingReviewRecordId() {
    return this._timingReviewRecordId;
  }

  get reminderType() {
    return this._reminderType;
  }

  get targetType() {
    return this._targetType;
  }

  get stockCode() {
    return this._stockCode;
  }

  get scheduledAt() {
    return this._scheduledAt;
  }

  get status() {
    return this._status;
  }

  get payload() {
    return this._payload;
  }

  get triggeredAt() {
    return this._triggeredAt;
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }

  static create(params: ResearchReminderParams) {
    if (!params.userId.trim()) {
      throw new InvalidInsightError("提醒缺少 userId");
    }

    if (!params.timingReviewRecordId?.trim()) {
      throw new InvalidInsightError("择时复查提醒缺少 timingReviewRecordId");
    }

    if (!params.stockCode.trim()) {
      throw new InvalidInsightError("提醒缺少股票代码");
    }

    if (!REMINDER_TYPES.includes(params.reminderType)) {
      throw new InvalidInsightError("无效的提醒类型");
    }

    if (!REMINDER_TARGET_TYPES.includes(params.targetType)) {
      throw new InvalidInsightError("无效的提醒目标类型");
    }

    const status = params.status ?? "PENDING";
    if (!REMINDER_STATUSES.includes(status)) {
      throw new InvalidInsightError("无效的提醒状态");
    }

    return new ResearchReminder({
      ...params,
      status,
    });
  }

  markTriggered(triggeredAt = new Date()) {
    this._status = "TRIGGERED";
    this._triggeredAt = triggeredAt;
    this._updatedAt = triggeredAt;
  }

  cancel(cancelledAt = new Date()) {
    this._status = "CANCELLED";
    this._updatedAt = cancelledAt;
  }

  toDict() {
    return {
      id: this._id,
      userId: this._userId,
      timingReviewRecordId: this._timingReviewRecordId,
      stockCode: this._stockCode,
      reminderType: this._reminderType,
      targetType: this._targetType,
      scheduledAt: this._scheduledAt.toISOString(),
      status: this._status,
      payload: this._payload,
      triggeredAt: this._triggeredAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromDict(data: Record<string, unknown>) {
    return ResearchReminder.create({
      id: data.id as string | undefined,
      userId: data.userId as string,
      timingReviewRecordId: data.timingReviewRecordId as string | undefined,
      stockCode: data.stockCode as string,
      reminderType: data.reminderType as ResearchReminderType,
      targetType: data.targetType as ResearchReminderTargetType,
      scheduledAt: new Date(data.scheduledAt as string),
      status: data.status as ResearchReminderStatus,
      payload: data.payload as Record<string, unknown>,
      triggeredAt: data.triggeredAt
        ? new Date(data.triggeredAt as string)
        : null,
      createdAt: data.createdAt
        ? new Date(data.createdAt as string)
        : undefined,
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt as string)
        : undefined,
    });
  }
}
