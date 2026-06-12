import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListTrades, getListTradesQueryKey, useDeleteTrade, getGetTradeStatsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Plus, Search, Trash2, Edit2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TradeFormModal } from "@/components/trade-form-modal";
import { Trade } from "@workspace/api-client-react";

export default function TradeLog() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<string>("all");
  const [result, setResult] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [tradeToDelete, setTradeToDelete] = useState<number | null>(null);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Queries
  const { data: trades, isLoading } = useListTrades({
    ...(search ? { search } : {}),
    ...(side !== "all" ? { side: side as any } : {}),
    ...(result !== "all" ? { result: result as any } : {}),
    sortOrder
  });

  const deleteMutation = useDeleteTrade();

  const handleDelete = () => {
    if (tradeToDelete) {
      deleteMutation.mutate({ id: tradeToDelete }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTradeStatsQueryKey() });
          setTradeToDelete(null);
        }
      });
    }
  };

  const openAddModal = () => {
    setTradeToEdit(null);
    setIsFormOpen(true);
  };

  const openEditModal = (trade: Trade) => {
    setTradeToEdit(trade);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Trade Log</h2>
          <p className="text-white/70 mt-1">Review and manage your trading history.</p>
        </div>
        <Button
          onClick={openAddModal}
          className="bg-[#CCF33C] hover:bg-[#BEE52F] text-[#111111] font-semibold rounded-[10px] shadow-lg transition-all hover:-translate-y-[1px]"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Trade
        </Button>
      </div>

      <Card className="bg-card border-none shadow-md">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticker..."
                className="pl-9 bg-muted/10 border-muted-foreground/20 text-card-foreground"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-4">
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="w-[130px] bg-muted/10 border-muted-foreground/20">
                  <SelectValue placeholder="Side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sides</SelectItem>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger className="w-[130px] bg-muted/10 border-muted-foreground/20">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="bg-muted/10 border-muted-foreground/20 text-card-foreground hover:bg-muted/20"
                onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {sortOrder === "desc" ? "Newest" : "Oldest"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-muted-foreground/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/5 hover:bg-muted/5">
                <TableRow className="border-muted-foreground/10 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Ticker</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Side</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Strategy</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Entry</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Exit</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Stop</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Shares</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Net P&L</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">R:R</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-center">Result</TableHead>
                  <TableHead className="font-semibold text-muted-foreground w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                      Loading trades...
                    </TableCell>
                  </TableRow>
                ) : trades?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                      No trades found.
                    </TableCell>
                  </TableRow>
                ) : (
                  trades?.map((trade) => (
                    <TableRow key={trade.id} className="border-muted-foreground/5 hover:bg-muted/5 transition-colors group">
                      <TableCell className="font-medium">{format(new Date(trade.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-bold text-card-foreground">{trade.ticker}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-semibold ${trade.side === "Long" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"}`}>
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{trade.strategy || "-"}</TableCell>
                      <TableCell className="text-right">${trade.entryPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${trade.exitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${trade.stopLoss.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{trade.shares}</TableCell>
                      <TableCell className={`text-right font-bold ${trade.netPnl >= 0 ? "text-[hsl(var(--chart-1))]" : "text-[hsl(var(--chart-2))]"}`}>
                        {trade.netPnl >= 0 ? "+" : ""}${trade.netPnl.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{trade.rr.toFixed(2)}R</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${trade.result === "Win" ? "bg-[hsl(var(--chart-1))]/20 text-[hsl(var(--chart-1))] hover:bg-[hsl(var(--chart-1))]/20" : "bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/20"} border-none`}>
                          {trade.result}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEditModal(trade)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setTradeToDelete(trade.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!tradeToDelete} onOpenChange={(open) => !open && setTradeToDelete(null)}>
        <AlertDialogContent className="bg-card text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trade record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted/10 border-none hover:bg-muted/20">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TradeFormModal 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        trade={tradeToEdit} 
      />
    </div>
  );
}
