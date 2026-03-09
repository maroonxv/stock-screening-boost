import { v4 as uuidv4 } from "uuid";
import { InvalidInsightError } from "~/server/domain/intelligence/errors";
import type {
  ResearchReminderStatus,
  ResearchReminderType,
} from "~/server/domain/intelligence/types";

const REMINDER_TYPES: ResearchReminderType[] = ["REVIEW"];
const REMINDER_STATUSES: ResearchReminderStatus[] = [
  "PENDING",
  "TRIGGERED",
  "CANCELLED",
];

export type ResearchReminderParams = {
  id?: string;
  userId: string;
  insightId: string;
  stockCode: string;
  reminderType: ResearchReminderType;
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
  private readonly _insightId: string;
  private readonly _stockCode: string;
  private readonly _reminderType: ResearchReminderType;
  private readonly _scheduledAt: Date;
  private _status: ResearchReminderStatus;
  private readonly _payload: Record<string, unknown>;
  private _triggeredAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(params: ResearchReminderParams) {
    this._id = params.id ?? uuidv4();
    this._userId = params.userId;
    this._insightId = params.insightId;
    this._stockCode = params.stockCode;
    this._reminderType = params.reminderType;
    this._scheduledAt = params.scheduledAt;
    this._status = params.status ?? "PENDING";
    this._payload = params.payload;
    this._triggeredAt = params.triggeredAt ?? null;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? this._createdAt;
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get insightId(): string {
    return this._insightId;
  }

  get stockCode(): string {
    return this._stockCode;
  }

  get reminderType(): ResearchReminderType {
    return this._reminderType;
  }

  get scheduledAt(): Date {
    return this._scheduledAt;
  }

  get status(): ResearchReminderStatus {
    return this._status;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get triggeredAt(): Date | null {
    return this._triggeredAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(params: ResearchReminderParams): ResearchReminder {
    if (!params.userId.trim()) {
      throw new InvalidInsightError("提醒缺少 userId");
    }

    if (!params.insightId.trim()) {
      throw new InvalidInsightError("提醒缺少 insightId");
    }

    if (!params.stockCode.trim()) {
      throw new InvalidInsightError("提醒缺少股票代码");
    }

    if (!REMINDER_TYPES.includes(params.reminderType)) {
      throw new InvalidInsightError("无效的提醒类型");
    }

    const status = params.status ?? "PENDING";
    if (!REMINDER_STATUSES.includes(status)) {
      throw new InvalidInsightError("无效的提醒状态");
    }

    if (Number.isNaN(params.scheduledAt.getTime())) {
      throw new InvalidInsightError("提醒时间无效");
    }

    return new ResearchReminder({
      ...params,
      status,
    });
  }

  markTriggered(triggeredAt = new Date()): void {
    this._status = "TRIGGERED";
    this._triggeredAt = triggeredAt;
    this._updatedAt = triggeredAt;
  }

  cancel(cancelledAt = new Date()): void {
    this._status = "CANCELLED";
    this._updatedAt = cancelledAt;
  }

  toDict(): Record<string, unknown> {
    return {
      id: this._id,
      userId: this._userId,
      insightId: this._insightId,
      stockCode: this._stockCode,
      reminderType: this._reminderType,
      scheduledAt: this._scheduledAt.toISOString(),
      status: this._status,
      payload: this._payload,
      triggeredAt: this._triggeredAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromDict(data: Record<string, unknown>): ResearchReminder {
    return ResearchReminder.create({
      id: data.id as string | undefined,
      userId: data.userId as string,
      insightId: data.insightId as string,
      stockCode: data.stockCode as string,
      reminderType: data.reminderType as ResearchReminderType,
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
