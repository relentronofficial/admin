import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Video } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import type { Event } from "@/types";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const isPast = new Date(event.eventDate) < new Date();

  return (
    <Link href={`/events/${event.id}`} className="group block">
      <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {event.thumbnailUrl ? (
            <Image
              src={event.thumbnailUrl}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-600/20 to-brand-600/5">
              <Calendar size={32} className="text-brand-600/40" />
            </div>
          )}
          {isPast && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs font-semibold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full">
                Ended
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
            {event.title}
          </h3>

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="shrink-0" />
              <span>{formatDate(event.eventDate, "EEE, MMM d 'at' h:mm a")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {event.isOnline ? (
                <><Video size={12} className="shrink-0 text-brand-600" /><span className="text-brand-600 font-medium">Online Event</span></>
              ) : (
                <><MapPin size={12} className="shrink-0" /><span className="truncate">{event.location || "Location TBD"}</span></>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
