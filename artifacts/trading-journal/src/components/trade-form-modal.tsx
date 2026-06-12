import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTrade, useUpdateTrade, getListTradesQueryKey, getGetTradeStatsQueryKey } from "@workspace/api-client-react";
import { Trade } from "@workspace/api-client-react/src/generated/api.schemas";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const tradeSchema = z.object({
  date: z.string().min(1, "Date is required"),
  ticker: z.string().min(1, "Ticker is required").max(10, "Ticker is too long").toUpperCase(),
  side: z.enum(["Long", "Short"]),
  strategy: z.string().optional(),
  entryPrice: z.coerce.number().positive("Must be positive"),
  exitPrice: z.coerce.number().positive("Must be positive"),
  stopLoss: z.coerce.number().positive("Must be positive"),
  shares: z.coerce.number().int().positive("Must be positive"),
  notes: z.string().optional(),
});

type TradeFormValues = z.infer<typeof tradeSchema>;

interface TradeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
}

export function TradeFormModal({ open, onOpenChange, trade }: TradeFormModalProps) {
  const queryClient = useQueryClient();
  const createMutation = useCreateTrade();
  const updateMutation = useUpdateTrade();

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      ticker: "",
      side: "Long",
      strategy: "",
      entryPrice: 0,
      exitPrice: 0,
      stopLoss: 0,
      shares: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (trade && open) {
      form.reset({
        date: trade.date,
        ticker: trade.ticker,
        side: trade.side as "Long" | "Short",
        strategy: trade.strategy || "",
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        shares: trade.shares,
        notes: trade.notes || "",
      });
    } else if (!trade && open) {
      form.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        ticker: "",
        side: "Long",
        strategy: "",
        entryPrice: undefined as any,
        exitPrice: undefined as any,
        stopLoss: undefined as any,
        shares: undefined as any,
        notes: "",
      });
    }
  }, [trade, open, form]);

  const watchedValues = form.watch();

  // Calculate live preview
  let netPnl = 0;
  let rr = 0;
  let result = "Win";

  const { entryPrice, exitPrice, stopLoss, shares, side } = watchedValues;
  
  if (entryPrice && exitPrice && shares) {
    netPnl = side === "Long" 
      ? (exitPrice - entryPrice) * shares 
      : (entryPrice - exitPrice) * shares;
    result = netPnl >= 0 ? "Win" : "Loss";
  }

  if (entryPrice && exitPrice && stopLoss && Math.abs(entryPrice - stopLoss) > 0) {
    rr = Math.abs(exitPrice - entryPrice) / Math.abs(entryPrice - stopLoss);
  }

  const onSubmit = (data: TradeFormValues) => {
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTradeStatsQueryKey() });
      onOpenChange(false);
    };

    if (trade) {
      updateMutation.mutate({ id: trade.id, data }, { onSuccess });
    } else {
      createMutation.mutate({ data }, { onSuccess });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground border-none shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {trade ? "Edit Trade" : "New Trade"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticker</FormLabel>
                    <FormControl>
                      <Input placeholder="AAPL" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="side"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Side</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/10 border-muted/20">
                          <SelectValue placeholder="Select side" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Long">Long</SelectItem>
                        <SelectItem value="Short">Short</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Breakout" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exit Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stopLoss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Loss</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shares / Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" className="bg-muted/10 border-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What went well? What could be improved?" 
                      className="resize-none bg-muted/10 border-muted/20" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview Section */}
            <div className="bg-muted/5 p-4 rounded-lg border border-muted/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net P&L</p>
                <p className={`text-2xl font-bold ${netPnl >= 0 ? "text-[hsl(var(--chart-1))]" : "text-[hsl(var(--chart-2))]"}`}>
                  {netPnl >= 0 ? "+" : ""}${netPnl.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Risk/Reward</p>
                <p className="text-2xl font-bold font-mono text-card-foreground">
                  {rr.toFixed(2)}R
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Result</p>
                <div className={`mt-1 px-3 py-1 rounded-full text-sm font-bold ${
                  result === "Win" 
                    ? "bg-[hsl(var(--chart-1))]/20 text-[hsl(var(--chart-1))]" 
                    : "bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))]"
                }`}>
                  {result}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-[#CCF33C] hover:bg-[#BEE52F] text-[#111111] font-semibold rounded-[10px] transition-all hover:-translate-y-[1px]">
                {isPending ? "Saving..." : trade ? "Save Changes" : "Create Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
