import { useGetTradeStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, PieChart, Pie, Legend } from "recharts";
import { Activity, Target, DollarSign, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetTradeStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/20" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-[400px] rounded-xl bg-muted/20" />
          <div className="h-[400px] rounded-xl bg-muted/20" />
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Wins", value: stats.wins, fill: "hsl(var(--chart-1))" },
    { name: "Losses", value: stats.losses, fill: "hsl(var(--chart-2))" }
  ];

  return (
    <div className="space-y-8 text-card-foreground">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/70 mt-2">Performance metrics and trading analytics.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md overflow-hidden bg-card relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="h-16 w-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Total Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">{stats.totalTrades}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden bg-card relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="h-16 w-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">{stats.winRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden bg-card relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="h-16 w-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Net P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.netPnl >= 0 ? "text-[hsl(var(--chart-1))]" : "text-[hsl(var(--chart-2))]"}`}>
              {stats.netPnl >= 0 ? "+" : ""}${stats.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden bg-card relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="h-16 w-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Profit Factor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="border-none shadow-md bg-card lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-card-foreground">P&L Per Trade</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pnlByTrade}>
                  <XAxis 
                    dataKey="tradeNumber" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    cursor={{fill: 'transparent'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-popover p-3 shadow-lg">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-popover-foreground">{data.ticker}</span>
                              <span className="text-xs text-muted-foreground">{data.date}</span>
                              <span className={`font-bold ${data.pnl >= 0 ? "text-[hsl(var(--chart-1))]" : "text-[hsl(var(--chart-2))]"}`}>
                                {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.pnlByTrade.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-card-foreground">Win/Loss Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full flex flex-col items-center justify-center">
              {stats.totalTrades === 0 ? (
                <div className="text-muted-foreground">No trades yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-popover p-2 shadow-sm">
                              <span className="font-medium text-popover-foreground">{data.name}: {data.value}</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: any) => <span className="text-card-foreground font-medium ml-1">{value}: {entry.payload.value}</span>}
                    />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-card-foreground text-3xl font-bold"
                    >
                      {stats.winRate.toFixed(0)}%
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
