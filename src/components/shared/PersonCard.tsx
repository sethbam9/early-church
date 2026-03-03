import type { Person } from "../../domain/types";
import { Badge } from "./Badge";

interface PersonCardProps {
  person: Person;
  onClick?: () => void;
  compact?: boolean;
}

export function PersonCard({ person, onClick, compact }: PersonCardProps) {
  const years =
    person.birth_year !== null || person.death_year !== null
      ? `${person.birth_year ?? "?"} – ${person.death_year ?? "?"}`
      : null;

  if (compact) {
    return (
      <button type="button" className="entity-chip" onClick={onClick}>
        {person.name_display}
        {years && <span className="muted small"> ({years})</span>}
      </button>
    );
  }

  return (
    <div className="person-card">
      <h3>
        {onClick ? (
          <button type="button" className="link-button" onClick={onClick}>
            {person.name_display}
          </button>
        ) : (
          person.name_display
        )}
      </h3>
      <div className="badge-row">
        {years && <Badge>{years}</Badge>}
        {person.roles.map((role) => (
          <Badge key={role}>{role}</Badge>
        ))}
        {person.death_type === "martyr" && <Badge>Martyr</Badge>}
      </div>
      <p>{person.description}</p>
      {person.apostolic_connection && (
        <p className="muted small"><strong>Apostolic connection:</strong> {person.apostolic_connection}</p>
      )}
      {person.wikipedia_url && (
        <p>
          <a href={person.wikipedia_url} target="_blank" rel="noreferrer">
            Wikipedia →
          </a>
        </p>
      )}
    </div>
  );
}
