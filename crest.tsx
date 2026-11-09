/** Original heraldic artwork; no game images or remote assets are required. */
export function faction(id: string): string {
  return id === 'peasant' ? 'The Alliance' : id === 'murloc' ? 'The wilds' : 'The Horde';
}

export function Crest({ id = 'peon', small = false }: { id?: string; small?: boolean }) {
  return <span className={`wv-crest wv-crest--${id}${small ? ' wv-crest--small' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      {id === 'peasant' ? <><path d="M12 38h24M16 38V21h16v17M12 11h6v5h4v-5h4v5h4v-5h6v10H12z"/><path d="M21 38V28a3 3 0 016 0v10M24 5v6"/></>
        : id === 'murloc' ? <><path d="M11 28l-5-4 6-3 2-9 10-6 10 6 2 9 6 3-5 4-4 9-9 6-9-6zM18 31l6 4 6-4M18 36l-3 5M30 36l3 5"/><circle cx="17" cy="22" r="5"/><circle cx="31" cy="22" r="5"/><path d="M17 21v2M31 21v2M18 8l-3-4M30 8l3-4"/></>
        : id === 'wc3_grunt' ? <><path d="M11 19l4-9 9-4 9 4 4 9-4 18-9 6-9-6zM12 21l9 3M36 21l-9 3M19 31l5 3 5-3M16 29l-2 8 7-2M32 29l2 8-7-2M24 8v9"/></>
        : <><path d="M11 8l28 32M37 8L9 40M6 9l10-4 6 12-10 3zM42 9L32 5l-6 12 10 3zM11 8l3 6M37 8l-3 6"/></>}
    </svg>
  </span>;
}
