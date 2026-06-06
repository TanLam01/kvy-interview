import type { VerificationEvent } from '../types';

interface TimelineProps {
  events: VerificationEvent[];
  showActorId?: boolean;
}

export function Timeline({ events, showActorId = false }: TimelineProps) {
  return (
    <div className="timeline-wrapper">
      {events.map((event) => (
        <div key={event.id} className={`timeline-event event-${event.action}`}>
          <div className="timeline-node"></div>
          <div className="timeline-content">
            <div className="timeline-event-header">
              <span className="timeline-action-name">
                {event.action.replace(/_/g, ' ')}
              </span>
              <span className="timeline-time">
                {new Date(event.createdAt).toLocaleTimeString()} (
                {new Date(event.createdAt).toLocaleDateString()})
              </span>
            </div>
            <div className="timeline-actor-row">
              <span>
                Actor: <strong>{event.actorType}</strong>
                {showActorId ? ` (ID: ${event.actorId || 'N/A'})` : ''}
              </span>
              {event.fromStatus && (
                <span className="timeline-transition-row">
                  {showActorId ? 'Transition: ' : ''}
                  {event.fromStatus} to {event.toStatus}
                </span>
              )}
            </div>
            {event.reason && (
              <div className="timeline-reason-bubble">{event.reason}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
