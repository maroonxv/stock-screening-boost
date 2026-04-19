const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const AUTO_REFRESH_HOUR = 8;
const AUTO_REFRESH_MINUTE = 30;

type ShanghaiClock = {
  date: string;
  hour: number;
  minute: number;
};

function readPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getShanghaiClock(now: Date): ShanghaiClock {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = readPart(parts, "year");
  const month = readPart(parts, "month");
  const day = readPart(parts, "day");
  const hour = Number(readPart(parts, "hour"));
  const minute = Number(readPart(parts, "minute"));

  return {
    date: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

export function hasReachedMarketContextAutoRefreshCutoff(now: Date) {
  const clock = getShanghaiClock(now);

  return (
    clock.hour > AUTO_REFRESH_HOUR ||
    (clock.hour === AUTO_REFRESH_HOUR && clock.minute >= AUTO_REFRESH_MINUTE)
  );
}
