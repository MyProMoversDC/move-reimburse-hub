import { useMoverRating, useMoverRatingEvents } from "@/hooks/useRatings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingStatusBadge, StarRating, getRatingStatus, EVENT_LABELS } from "./ratingUtils";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MoverPerformanceCard({ moverId }: { moverId: string }) {
  const { data: rating } = useMoverRating(moverId);
  const { data: events = [] } = useMoverRatingEvents(moverId);
  const score = rating?.score ?? 40;
  const status = getRatingStatus(score);

  return (
    <Card className="overflow-hidden">
      <div className={`h-2 ${status.bgClass}`} />
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Performance Score</span>
          <RatingStatusBadge score={score} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-4xl font-bold tabular-nums">{score}<span className="text-base text-muted-foreground"> / 50</span></div>
            <StarRating score={score} size={18} />
            <div className={`text-sm font-medium mt-1 ${status.textClass}`}>{status.label} Standing</div>
          </div>
        </div>
        {events.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent Activity</h4>
            <ScrollArea className="h-44 rounded border">
              <div className="divide-y">
                {[...events].reverse().slice(0, 20).map((e) => (
                  <div key={e.id} className="flex items-start justify-between px-3 py-2 text-sm">
                    <div className="flex-1 pr-2">
                      <div className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
                      <div className="text-xs text-muted-foreground">{e.reason}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy")}</div>
                    </div>
                    <span className={`font-bold tabular-nums ${e.delta >= 0 ? "text-green-600" : "text-red-600"}`}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
