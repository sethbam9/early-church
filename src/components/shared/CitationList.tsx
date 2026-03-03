interface CitationListProps {
  urls: string[];
}

export function CitationList({ urls }: CitationListProps) {
  if (urls.length === 0) return <p className="muted small">No citations available.</p>;
  return (
    <ul className="citation-list">
      {urls.map((url) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}
