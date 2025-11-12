"use client";

import { Fragment, useEffect, useState } from "react";

type PoolKey = "PE" | "PC" | "PRE";
type ScenarioId = "internal" | "prefunded" | "loc";
type ViewMode = "cash" | "drag";

interface SimulationParams {
  peCash: number;
  pcCash: number;
  preCash: number;
  cashPool: number;
  borrowRate: number;
  idleRate: number;
  days: number;
}

interface PoolState {
  key: PoolKey;
  name: string;
  cash: number;
  borrow: number;
  interestOwed: number;
  interestPaid: number;
  interestEarned: number;
  cashDrag: number;
  borrowDrag: number;
}

interface CashPoolState {
  cash: number;
  interestEarned: number;
  interestReceivable: number;
  activity: number;
  cashDrag: number;
  borrowDrag: number;
}

interface DailyRecord {
  day: number;
  pools: PoolState[];
  cashPool: CashPoolState;
  activity: Record<PoolKey | "CP", number>;
  totals: {
    borrowed: number;
    repaid: number;
    interestByPool: Record<PoolKey | "CP", number>;
    drag: number;
  };
}

interface PoolSummary {
  key: PoolKey;
  name: string;
  interestPaid: number;
  endingCash: number;
  endingBorrow: number;
}

interface SimulationSummary {
  privatePools: PoolSummary[];
  cashPool: {
    interestEarned: number;
    endingCash: number;
  };
  totals: {
    borrowed: number;
    repaid: number;
    days: number;
  };
}

interface SimulationResult {
  records: DailyRecord[];
  summary: SimulationSummary;
}

type DayEvent = Record<PoolKey, number>;

const POOL_CONFIGS: { key: PoolKey; name: string; color: string }[] = [
  { key: "PE", name: "Private Equity", color: "#2563eb" },
  { key: "PC", name: "Private Credit", color: "#0ea5e9" },
  { key: "PRE", name: "Private Real Estate", color: "#f97316" },
];

const POOL_HEADER_LABELS: Record<PoolKey, string> = {
  PE: "Private Equity Pool",
  PC: "Private Credit Pool",
  PRE: "Private Real Estate Pool",
};

const POOL_CASH_HEADERS = [
  "Cash",
  "Activity",
  "Borrow",
  "Int Owed",
  "Int Earn",
] as const;

const POOL_DRAG_HEADERS = ["Cash Drag", "Borrow Drag", "Total Drag"] as const;

const EXPECTED_RETURNS: Record<PoolKey, number> = {
  PE: 8.0,
  PC: 8.2,
  PRE: 7.2,
};

const AVERAGE_EXPECTED_RETURN =
  (EXPECTED_RETURNS.PE + EXPECTED_RETURNS.PC + EXPECTED_RETURNS.PRE) / 3;

const DEFAULT_PARAMS: SimulationParams = {
  peCash: 0,
  pcCash: 0,
  preCash: 0,
  cashPool: 50,
  borrowRate: 4.25,
  idleRate: 4.25,
  days: 30,
};

const PREFUNDED_PARAMS: SimulationParams = {
  ...DEFAULT_PARAMS,
  peCash: 30,
  pcCash: 30,
  preCash: 30,
  cashPool: 0,
};

const LOC_PARAMS: SimulationParams = {
  ...DEFAULT_PARAMS,
  borrowRate: DEFAULT_PARAMS.borrowRate + 0.4,
  idleRate: DEFAULT_PARAMS.idleRate,
  cashPool: 0,
};

const SCENARIOS: {
  id: ScenarioId;
  name: string;
  description: string;
  params: SimulationParams;
}[] = [
  {
    id: "prefunded",
    name: "Pre-Funded Pools",
    description:
      "Each investment pool begins with $30M cash which is used to fund commitments as they come in. Cash is assumed to earn 4.25% when idle.",
    params: PREFUNDED_PARAMS,
  },
  {
    id: "internal",
    name: "Internal Cash Pool",
    description:
      "Internally funded borrowing facility allows individual pools to hold zero starting cash and draw needed funds from a centralized pool to meet funding needs. Idle cash earns 4.25%. Pools borrow at 4.25%.",
    params: DEFAULT_PARAMS,
  },
  {
    id: "loc",
    name: "External LOC",
    description:
      "Pools tap an external bank line; draws cost cash rate (4.25%) + 40 bps and no idle cash is reserved.",
    params: LOC_PARAMS,
  },
];

export default function Home() {
  const [results, setResults] = useState<Record<
    ScenarioId,
    SimulationResult
  > | null>(null);
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("prefunded");
  const [viewMode, setViewMode] = useState<ViewMode>("cash");
  const [showSummary, setShowSummary] = useState(false);

  const runAllScenarios = () => {
    const dayEvents = generateDayEvents(DEFAULT_PARAMS.days);
    const scenarioResults = SCENARIOS.reduce((acc, scenario) => {
      acc[scenario.id] = runSimulation(scenario.params, dayEvents, scenario.id);
      return acc;
    }, {} as Record<ScenarioId, SimulationResult>);
    setResults(scenarioResults);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      runAllScenarios();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleRerun = () => {
    runAllScenarios();
  };

  const activeScenarioMeta = SCENARIOS.find(
    (scenario) => scenario.id === activeScenario
  )!;
  const currentResult = results ? results[activeScenario] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-8xl flex-col gap-8 p-6">
        <section className="space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
                  Internal Cash Pool Analysis
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  {showSummary
                    ? "Scenario Comparison Summary"
                    : `${activeScenarioMeta.name}: liquidity, interest, and borrowing over ${activeScenarioMeta.params.days} days`}
                </h1>
                <p className="text-sm text-slate-600">
                  {showSummary
                    ? "Track cumulative performance drag across all scenarios to compare outcomes."
                    : activeScenarioMeta.description}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRerun}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Rerun Simulation
              </button>
            </div>
            {/* <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Capital calls 10% • distributions 7%
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Borrow rate {activeScenarioMeta.params.borrowRate}% • Idle rate{" "}
                {activeScenarioMeta.params.idleRate}%
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1">
                Cash Pool starting cash{" "}
                {formatMillions(activeScenarioMeta.params.cashPool, 1)}
              </span>
            </div> */}
          </header>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ScenarioTabs
              scenarios={SCENARIOS}
              activeId={activeScenario}
              onChange={(id) => {
                setShowSummary(false);
                setActiveScenario(id);
              }}
              summaryActive={showSummary}
              onSummary={() => setShowSummary(true)}
            />
            {!showSummary && (
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            )}
          </div>

          {showSummary ? (
            results ? (
              <SummaryTable results={results} />
            ) : (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                <p className="text-lg font-medium">Simulating scenarios…</p>
                <p className="mt-2 text-sm">
                  Results will appear here as soon as the first run finishes.
                </p>
              </section>
            )
          ) : currentResult ? (
            <SimulationResults
              result={currentResult}
              scenarioId={activeScenario}
              viewMode={viewMode}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <p className="text-lg font-medium">Simulating scenarios…</p>
              <p className="mt-2 text-sm">
                Results will appear here as soon as the first run finishes.
              </p>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

function SimulationResults({
  result,
  scenarioId,
  viewMode,
}: {
  result: SimulationResult;
  scenarioId: ScenarioId;
  viewMode: ViewMode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ResultsTable
          records={result.records}
          scenarioId={scenarioId}
          viewMode={viewMode}
        />
      </section>
    </div>
  );
}

function ScenarioTabs({
  scenarios,
  activeId,
  onChange,
  summaryActive,
  onSummary,
}: {
  scenarios: { id: ScenarioId; name: string }[];
  activeId: ScenarioId;
  onChange: (id: ScenarioId) => void;
  summaryActive: boolean;
  onSummary: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          onClick={() => onChange(scenario.id)}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeId === scenario.id && !summaryActive
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          {scenario.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onSummary}
        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
          summaryActive
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
        }`}
      >
        Summary
      </button>
    </div>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const options: { label: string; value: ViewMode }[] = [
    { label: "Cash Metrics", value: "cash" },
    { label: "Investment Drag", value: "drag" },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 transition ${
            option.value === mode
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SummaryTable({
  results,
}: {
  results: Record<ScenarioId, SimulationResult>;
}) {
  const days = results[SCENARIOS[0].id].records.length;
  const scenarioOrder = SCENARIOS.map((scenario) => scenario.id);

  const monthlyDragTotals = scenarioOrder.map((id) => {
    const latestRecord = results[id].records.at(-1);
    const poolDrag =
      latestRecord?.pools.reduce((sum, pool) => sum + pool.cashDrag, 0) ?? 0;
    const cashPoolDrag = latestRecord?.cashPool.cashDrag ?? 0;
    const borrowDrag =
      latestRecord?.pools.reduce((sum, pool) => sum + pool.borrowDrag, 0) ?? 0;
    return {
      id,
      name: SCENARIOS.find((scenario) => scenario.id === id)!.name,
      value: poolDrag + cashPoolDrag + borrowDrag,
    };
  });

  const runningTotals: Record<ScenarioId, number> = {
    prefunded: 0,
    internal: 0,
    loc: 0,
  };

  const rowData = Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const values: Record<ScenarioId, number> = {
      prefunded: results.prefunded.records[index]?.totals.drag ?? 0,
      internal: results.internal.records[index]?.totals.drag ?? 0,
      loc: results.loc.records[index]?.totals.drag ?? 0,
    };
    runningTotals.prefunded += values.prefunded;
    runningTotals.internal += values.internal;
    runningTotals.loc += values.loc;
    return {
      day: dayNumber,
      values: { ...values },
      cumulative: { ...runningTotals },
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Daily Total Drag Comparison
      </h2>
      <p className="text-sm text-slate-500">
        All figures show the daily drag and the running total (cash + borrow)
        per scenario.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {monthlyDragTotals.map((entry) => (
          <div
            key={`cash-drag-${entry.id}`}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600"
          >
            <p className="font-semibold text-slate-900">{entry.name}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              Monthly Performance Drag
            </p>
            <p className="text-lg font-bold text-slate-900">
              {formatFullDollars(entry.value)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              Estimated Annual Drag
            </p>
            <p className="text-base font-semibold text-slate-900">
              {formatFullDollars(entry.value * 12)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-slate-100">
        <table className="min-w-full table-fixed divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Day</th>
              {scenarioOrder.map((id) => {
                const scenario = SCENARIOS.find((scn) => scn.id === id)!;
                return (
                  <th key={`summary-${id}`} className="px-3 py-2 text-left">
                    {scenario.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rowData.map((row) => (
              <tr
                key={`summary-row-${row.day}`}
                className="transition hover:bg-amber-50"
              >
                <td className="cell-highlight px-3 py-2 font-semibold text-slate-900">
                  Day {row.day}
                </td>
                {scenarioOrder.map((id) => (
                  <td
                    key={`summary-${row.day}-${id}`}
                    className="cell-highlight px-3 py-2"
                  >
                    <span
                      className="tooltip-wrapper text-[13px] font-semibold text-slate-900"
                      data-tooltip={
                        row.cumulative[id] === 0
                          ? "No drag"
                          : formatFullDollars(row.cumulative[id])
                      }
                    >
                      {row.cumulative[id] === 0
                        ? "—"
                        : formatFullDollars(row.cumulative[id])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTable({
  records,
  scenarioId,
  viewMode,
}: {
  records: DailyRecord[];
  scenarioId: ScenarioId;
  viewMode: ViewMode;
}) {
  const cashPoolDormant = scenarioId === "prefunded";
  const cashPoolHeaderClass = cashPoolDormant ? "opacity-50" : "";
  const cashPoolCellClass = cashPoolDormant ? "opacity-60" : "";
  const poolHeaders =
    viewMode === "drag" ? POOL_DRAG_HEADERS : POOL_CASH_HEADERS;
  const cashPoolHeaders =
    viewMode === "drag"
      ? ["Cash Drag", "Borrow Drag", "Total Drag"]
      : ["Cash", "Activity", "Int Earn", "Int Recv"];

  return (
    <div className="rounded-2xl border border-slate-100">
      <table className="min-w-full table-fixed divide-y divide-slate-100 text-sm leading-snug">
        <thead className="text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th rowSpan={2} className="bg-slate-50 px-2 py-2 text-center">
              Day
            </th>
            <th
              colSpan={cashPoolHeaders.length}
              className={`px-2 py-2 text-center font-semibold text-slate-900 ${cashPoolHeaderClass}`}
              style={{ backgroundColor: withAlpha("#111827", 0.05) }}
            >
              Cash Pool
            </th>
            {POOL_CONFIGS.map((pool) => (
              <th
                key={`${pool.key}-group`}
                colSpan={poolHeaders.length}
                className="px-2 py-2 text-center font-semibold"
                style={{
                  backgroundColor: withAlpha(pool.color, 0.12),
                  color: pool.color,
                }}
              >
                <span className="flex flex-col text-xs font-semibold uppercase tracking-wide">
                  <span className="text-sm normal-case">
                    {POOL_HEADER_LABELS[pool.key]}
                  </span>
                  <span className="italic text-[11px] text-slate-600">
                    Exp. Ret. {EXPECTED_RETURNS[pool.key].toFixed(1)}%
                  </span>
                </span>
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50">
            <Fragment>
              {cashPoolHeaders.map((label) => (
                <th
                  key={`cash-pool-${label}`}
                  className={`px-2 py-2 text-center font-medium text-slate-800 ${cashPoolHeaderClass}`}
                >
                  {label}
                </th>
              ))}
            </Fragment>
            {POOL_CONFIGS.map((pool) => (
              <Fragment key={`${pool.key}-subheaders`}>
                {poolHeaders.map((label) => (
                  <th
                    key={`${pool.key}-${label}`}
                    className="px-2 py-2 text-center font-medium"
                    style={{
                      backgroundColor: withAlpha(pool.color, 0.06),
                      color: pool.color,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((record) => (
            <tr key={record.day} className="transition hover:bg-amber-50">
              <td className="cell-highlight px-2 py-2 text-center font-semibold text-slate-900">
                <span
                  className="tooltip-wrapper"
                  data-tooltip={`Day ${record.day}`}
                >
                  {record.day}
                </span>
              </td>
              {viewMode === "cash" ? (
                <>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-900 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={formatFullDollars(record.cashPool.cash)}
                    >
                      {formatMillions(record.cashPool.cash, 1)}
                    </span>
                  </td>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={
                        record.activity.CP === 0
                          ? "No activity"
                          : formatFullDollars(record.activity.CP)
                      }
                    >
                      {record.activity.CP === 0
                        ? "—"
                        : formatMillions(record.activity.CP, 1)}
                    </span>
                  </td>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={formatFullDollars(
                        record.cashPool.interestEarned
                      )}
                    >
                      {formatThousands(record.cashPool.interestEarned, 1)}
                    </span>
                  </td>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={formatFullDollars(
                        record.cashPool.interestReceivable
                      )}
                    >
                      {formatThousands(record.cashPool.interestReceivable, 1)}
                    </span>
                  </td>
                </>
              ) : (
                <>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={
                        record.cashPool.cashDrag === 0
                          ? "No cash drag"
                          : formatFullDollars(record.cashPool.cashDrag)
                      }
                    >
                      {record.cashPool.cashDrag === 0
                        ? "—"
                        : formatFullDollars(record.cashPool.cashDrag)}
                    </span>
                  </td>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={
                        record.cashPool.borrowDrag === 0
                          ? "No borrow drag"
                          : formatFullDollars(record.cashPool.borrowDrag)
                      }
                    >
                      {record.cashPool.borrowDrag === 0
                        ? "—"
                        : formatFullDollars(record.cashPool.borrowDrag)}
                    </span>
                  </td>
                  <td
                    className={`cell-highlight px-2 py-2 text-center font-semibold text-slate-800 ${cashPoolCellClass}`}
                  >
                    <span
                      className="tooltip-wrapper"
                      data-tooltip={
                        record.cashPool.cashDrag +
                          record.cashPool.borrowDrag ===
                        0
                          ? "No drag"
                          : formatFullDollars(
                              record.cashPool.cashDrag +
                                record.cashPool.borrowDrag
                            )
                      }
                    >
                      {record.cashPool.cashDrag + record.cashPool.borrowDrag ===
                      0
                        ? "—"
                        : formatFullDollars(
                            record.cashPool.cashDrag +
                              record.cashPool.borrowDrag
                          )}
                    </span>
                  </td>
                </>
              )}
              {POOL_CONFIGS.map((pool) => {
                const poolState = record.pools.find((p) => p.key === pool.key)!;
                return (
                  <Fragment key={`${record.day}-${pool.key}`}>
                    {viewMode === "cash" ? (
                      <>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-medium"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={formatFullDollars(poolState.cash)}
                          >
                            {formatMillions(poolState.cash, 1)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={
                              record.activity[pool.key] === 0
                                ? "No activity"
                                : formatFullDollars(record.activity[pool.key])
                            }
                          >
                            {record.activity[pool.key] === 0
                              ? "—"
                              : formatMillions(record.activity[pool.key], 1)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={formatFullDollars(poolState.borrow)}
                          >
                            {formatMillions(poolState.borrow, 1)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={formatFullDollars(
                              poolState.interestOwed
                            )}
                          >
                            {formatThousands(poolState.interestOwed, 1)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={
                              poolState.interestEarned === 0
                                ? "No interest earned"
                                : formatFullDollars(poolState.interestEarned)
                            }
                          >
                            {poolState.interestEarned === 0
                              ? "—"
                              : formatThousands(poolState.interestEarned, 1)}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={
                              poolState.cashDrag === 0
                                ? "No cash drag"
                                : formatFullDollars(poolState.cashDrag)
                            }
                          >
                            {poolState.cashDrag === 0
                              ? "—"
                              : formatFullDollars(poolState.cashDrag)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={
                              poolState.borrowDrag === 0
                                ? "No borrow drag"
                                : formatFullDollars(poolState.borrowDrag)
                            }
                          >
                            {poolState.borrowDrag === 0
                              ? "—"
                              : formatFullDollars(poolState.borrowDrag)}
                          </span>
                        </td>
                        <td
                          className="cell-highlight px-2 py-2 text-center font-semibold"
                          style={{ color: pool.color }}
                        >
                          <span
                            className="tooltip-wrapper"
                            data-tooltip={
                              poolState.cashDrag + poolState.borrowDrag === 0
                                ? "No drag"
                                : formatFullDollars(
                                    poolState.cashDrag + poolState.borrowDrag
                                  )
                            }
                          >
                            {poolState.cashDrag + poolState.borrowDrag === 0
                              ? "—"
                              : formatFullDollars(
                                  poolState.cashDrag + poolState.borrowDrag
                                )}
                          </span>
                        </td>
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function runSimulation(
  params: SimulationParams,
  dayEvents: DayEvent[],
  scenarioId: ScenarioId
): SimulationResult {
  const pools: PoolState[] = [
    {
      key: "PE",
      name: "Private Equity",
      cash: params.peCash,
      borrow: 0,
      interestOwed: 0,
      interestPaid: 0,
      interestEarned: 0,
      cashDrag: 0,
      borrowDrag: 0,
    },
    {
      key: "PC",
      name: "Private Credit",
      cash: params.pcCash,
      borrow: 0,
      interestOwed: 0,
      interestPaid: 0,
      interestEarned: 0,
      cashDrag: 0,
      borrowDrag: 0,
    },
    {
      key: "PRE",
      name: "Private Real Estate",
      cash: params.preCash,
      borrow: 0,
      interestOwed: 0,
      interestPaid: 0,
      interestEarned: 0,
      cashDrag: 0,
      borrowDrag: 0,
    },
  ];

  const cashPool: CashPoolState = {
    cash: params.cashPool,
    interestEarned: 0,
    interestReceivable: 0,
    activity: 0,
    cashDrag: 0,
    borrowDrag: 0,
  };

  const dailyBorrowRate = params.borrowRate / 100 / 365;
  const dailyIdleRate = params.idleRate / 100 / 365;

  const records: DailyRecord[] = [];
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let pendingCashInterest = 0;
  let totalInterestEarned = 0;
  const pendingPoolInterest: Record<PoolKey, number> = { PE: 0, PC: 0, PRE: 0 };

  for (let day = 1; day <= params.days; day++) {
    const events = dayEvents[day - 1] ?? { PE: 0, PC: 0, PRE: 0 };
    if (pendingCashInterest !== 0) {
      cashPool.cash += pendingCashInterest;
    }
    cashPool.interestEarned = 0;
    for (const pool of pools) {
      if (pendingPoolInterest[pool.key] !== 0) {
        pool.cash += pendingPoolInterest[pool.key];
        pendingPoolInterest[pool.key] = 0;
      }
      pool.interestEarned = 0;
    }

    const dailyActivity: Record<PoolKey | "CP", number> = {
      PE: 0,
      PC: 0,
      PRE: 0,
      CP: 0,
    };
    let borrowedToday = 0;
    let repaidToday = 0;
    const dayInterest: Record<PoolKey | "CP", number> = {
      PE: 0,
      PC: 0,
      PRE: 0,
      CP: 0,
    };
    let dragToday = 0;

    for (const pool of pools) {
      const eventAmount = events[pool.key] ?? 0;
      pool.cash += eventAmount;
      dailyActivity[pool.key] += eventAmount;

      if (pool.cash < 0) {
        const deficit = Math.abs(pool.cash);
        pool.borrow += deficit;
        borrowedToday += deficit;
        cashPool.cash -= deficit;
        dailyActivity.CP -= deficit;
        pool.cash = 0;
      }

      if (pool.borrow > 0) {
        const interest = pool.borrow * dailyBorrowRate;
        pool.interestOwed += interest;
        pool.borrowDrag += interest;
        dragToday += interest;
        dayInterest[pool.key] += interest;
      }
    }

    for (const pool of pools) {
      if (pool.cash <= 0 || (pool.borrow === 0 && pool.interestOwed === 0))
        continue;
      let available = pool.cash;
      let payment = 0;

      if (pool.interestOwed > 0) {
        const interestPayment = Math.min(pool.interestOwed, available);
        pool.interestOwed -= interestPayment;
        available -= interestPayment;
        payment += interestPayment;
        pool.interestPaid += interestPayment;
      }

      if (available > 0 && pool.borrow > 0) {
        const principalPayment = Math.min(pool.borrow, available);
        pool.borrow -= principalPayment;
        available -= principalPayment;
        payment += principalPayment;
      }

      pool.cash = available;

      if (payment > 0) {
        cashPool.cash += payment;
        dailyActivity.CP += payment;
        repaidToday += payment;
      }
    }

    for (const pool of pools) {
      if (pool.cash > 0) {
        const idleInterest = pool.cash * dailyIdleRate;
        pool.interestEarned = idleInterest;
        pendingPoolInterest[pool.key] = idleInterest;
        dayInterest[pool.key] -= idleInterest;
      } else {
        pool.interestEarned = 0;
        pendingPoolInterest[pool.key] = 0;
      }
    }

    for (const pool of pools) {
      const expectedRate = EXPECTED_RETURNS[pool.key] / 100 / 365;
      const cashRate = params.idleRate / 100 / 365;
      if (pool.cash > 0 && expectedRate > cashRate) {
        const drag = pool.cash * (expectedRate - cashRate);
        pool.cashDrag += drag;
        dragToday += drag;
      }
    }

    const totalOutstandingBorrow = pools.reduce(
      (sum, pool) => sum + pool.borrow,
      0
    );
    if (totalOutstandingBorrow > 0) {
      const receivableInterest = totalOutstandingBorrow * dailyBorrowRate;
      cashPool.interestReceivable += receivableInterest;
      dayInterest.CP += receivableInterest;
    }

    if (cashPool.cash > 0) {
      const idleInterest = cashPool.cash * dailyIdleRate;
      cashPool.interestEarned = idleInterest;
      pendingCashInterest = idleInterest;
      totalInterestEarned += idleInterest;
      dayInterest.CP += idleInterest;
    } else {
      pendingCashInterest = 0;
    }

    if (scenarioId === "internal") {
      const spread = (AVERAGE_EXPECTED_RETURN - params.idleRate) / 100 / 365;
      if (spread > 0) {
        const drag = DEFAULT_PARAMS.cashPool * spread;
        cashPool.cashDrag += drag;
        dragToday += drag;
      }
    }

    totalBorrowed += borrowedToday;
    totalRepaid += repaidToday;

    records.push({
      day,
      pools: pools.map((pool) => ({ ...pool })),
      cashPool: { ...cashPool },
      activity: { ...dailyActivity },
      totals: {
        borrowed: borrowedToday,
        repaid: repaidToday,
        interestByPool: { ...dayInterest },
        drag: dragToday,
      },
    });
  }

  const summary: SimulationSummary = {
    privatePools: pools.map((pool) => ({
      key: pool.key,
      name: pool.name,
      interestPaid: pool.interestPaid,
      endingCash: pool.cash,
      endingBorrow: pool.borrow,
    })),
    cashPool: {
      interestEarned: totalInterestEarned,
      endingCash: cashPool.cash,
    },
    totals: {
      borrowed: totalBorrowed,
      repaid: totalRepaid,
      days: params.days,
    },
  };

  return { records, summary };
}

function formatMillions(value: number, digits = 1) {
  return formatCurrency(value, digits, "M");
}

function formatThousands(value: number, digits = 1) {
  return formatCurrency(value * 1000, digits, "K");
}

function formatFullDollars(value: number) {
  const dollars = Math.abs(value * 1_000_000);
  const formatted = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

function sampleNormalRange(min: number, max: number) {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const value = mean + z * stdDev;
  return Math.min(Math.max(value, min), max);
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized.padEnd(6, "0").slice(0, 6), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatCurrency(value: number, digits: number, suffix: string) {
  const abs = Math.abs(value);
  const formatted = `$${abs.toFixed(digits)}${suffix}`;
  return value < 0 ? `(${formatted})` : formatted;
}

function generateDayEvents(days: number): DayEvent[] {
  return Array.from({ length: days }, () => {
    const entry: DayEvent = { PE: 0, PC: 0, PRE: 0 };
    POOL_CONFIGS.forEach((pool) => {
      const roll = Math.random();
      if (roll < 0.1) {
        entry[pool.key] = -sampleNormalRange(0.5, 7);
      } else if (roll < 0.17) {
        entry[pool.key] = sampleNormalRange(0.5, 7);
      } else {
        entry[pool.key] = 0;
      }
    });
    return entry;
  });
}
