import Link from "next/link";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

function formatExecutedAt(executedAt: Date | null): string {
  if (!executedAt) {
    return "暂无执行记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(executedAt);
}

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  let strategyCount: number | null = null;
  let watchListCount: number | null = null;
  let recentSessionCount: number | null = null;
  let latestExecutedAt: Date | null = null;
  let loadError: string | null = null;

  if (signedIn) {
    try {
      const [strategies, watchLists, recentSessions] = await Promise.all([
        api.screening.listStrategies({ limit: 100, offset: 0 }),
        api.watchlist.list(),
        api.screening.listRecentSessions({ limit: 10, offset: 0 }),
      ]);

      strategyCount = strategies.length;
      watchListCount = watchLists.length;
      recentSessionCount = recentSessions.length;
      latestExecutedAt = recentSessions[0]?.executedAt ?? null;
    } catch {
      loadError = "概览数据加载失败，请检查登录状态与后端服务。";
    }
  }

  const metricCards = [
    {
      label: "筛选策略",
      value: strategyCount,
      unit: "个",
      hint: "可复用的选股规则模板",
    },
    {
      label: "自选股列表",
      value: watchListCount,
      unit: "组",
      hint: "支持标签与备注管理",
    },
    {
      label: "最近会话",
      value: recentSessionCount,
      unit: "次",
      hint: "近 10 次策略执行记录",
    },
  ];

  return (
    <HydrateClient>
      <main className="market-shell px-6 py-10 text-[var(--market-text)] sm:py-14">
        <div className="market-frame flex w-full max-w-6xl flex-col gap-8">
          <header className="market-panel rounded-3xl p-6 md:p-8">
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.32em] text-[#8adfff]">
              STOCK SCREENING BOOST
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#f0f7ff] sm:text-5xl">
              股票筛选平台
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#9bb4cc] sm:text-base">
              基于 Next.js + tRPC + Prisma + FastAPI 的混合架构投研平台，
              用策略筛选、会话回溯和自选股管理，把注意力聚焦在高价值标的上。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/screening"
                className="market-button-positive rounded-full px-5 py-2 text-sm font-semibold transition"
              >
                打开筛选研究台
              </Link>
              <Link
                href="/workflows"
                className="market-button-primary rounded-full px-5 py-2 text-sm font-semibold transition"
              >
                打开工作流中心
              </Link>
              <Link
                href={signedIn ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full border border-[#71cfff]/70 bg-[#103e5d] px-5 py-2 text-sm font-semibold text-[#dbf3ff] transition hover:border-[#95deff] hover:bg-[#15577f]"
              >
                {signedIn ? "退出登录" : "登录平台"}
              </Link>
              <Link
                href="http://localhost:8000/docs"
                target="_blank"
                className="rounded-full border border-[#4f6880] bg-[#0a1626]/70 px-5 py-2 text-sm font-semibold text-[#c9deef] transition hover:border-[#74cfff] hover:text-[#e4f4ff]"
              >
                打开数据服务文档
              </Link>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {metricCards.map((card) => (
              <article
                key={card.label}
                className="market-soft-panel rounded-2xl p-5"
              >
                <p className="text-sm text-[#9db6cc]">{card.label}</p>
                <p className="market-data mt-2 text-4xl font-semibold text-[#6fe3ff]">
                  {signedIn ? (card.value ?? "-") : "--"}
                  <span className="ml-1 text-base text-[#7f99b3]">
                    {card.unit}
                  </span>
                </p>
                <p className="mt-2 text-xs text-[#829cb5]">{card.hint}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <article className="market-panel rounded-2xl p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#eef6ff]">
                运行状态
              </h2>
              <div className="mt-4 grid gap-3 text-sm text-[#c6dbee] sm:grid-cols-2">
                <p className="market-soft-panel rounded-xl px-4 py-3">
                  前端服务:{" "}
                  <span className="market-data text-[#64f4c2]">
                    http://localhost:3000
                  </span>
                </p>
                <p className="market-soft-panel rounded-xl px-4 py-3">
                  数据服务:{" "}
                  <span className="market-data text-[#64f4c2]">
                    http://localhost:8000
                  </span>
                </p>
                <p className="market-soft-panel rounded-xl px-4 py-3 sm:col-span-2">
                  数据库:{" "}
                  <span className="market-data text-[#64f4c2]">
                    localhost:5432
                  </span>
                </p>
              </div>
            </article>

            <article className="market-panel rounded-2xl p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#eef6ff]">
                当前账号
              </h2>
              <p className="mt-3 text-sm text-[#a0b9d0]">
                {signedIn
                  ? `已登录: ${session?.user?.name ?? session?.user?.email ?? "未命名用户"}`
                  : "未登录，登录后可查看策略与会话数据。"}
              </p>
              <p className="mt-3 text-sm text-[#a0b9d0]">
                最近执行:{" "}
                <span className="market-data text-[#66d7ff]">
                  {signedIn
                    ? formatExecutedAt(latestExecutedAt)
                    : "登录后可查看"}
                </span>
              </p>
              {loadError ? (
                <p className="mt-3 rounded-lg border border-[#f5c46f]/45 bg-[#5a4222]/45 px-3 py-2 text-xs text-[#ffd798]">
                  {loadError}
                </p>
              ) : null}
            </article>
          </section>
        </div>
      </main>
    </HydrateClient>
  );
}
