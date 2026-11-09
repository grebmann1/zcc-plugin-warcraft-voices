import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CATALOG } from './model.js';
import { Crest, faction } from './crest.js';

/** Select-only combobox with a viewport-confined, themed portal menu. */
export function VoicePicker({ label, value, installed, disabled, onChange }: {
  label: string; value: string; installed: readonly string[]; disabled: boolean; onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number }>();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', at: 0 }), id = useId();
  const selected = CATALOG.find(c => c.id === value)!;
  const enabled = CATALOG.map((c, index) => installed.includes(c.id) ? index : -1).filter(index => index >= 0);
  function close(restore = false) { setOpen(false); if (restore) trigger.current?.focus({ preventScroll: true }); }
  function choose(index: number) {
    const character = CATALOG[index];
    if (!character || !installed.includes(character.id)) return;
    close(true); onChange(character.id);
  }
  function show(last = false) {
    if (disabled || !enabled.length) return;
    const current = CATALOG.findIndex(c => c.id === value && installed.includes(c.id));
    setActive(last ? enabled[enabled.length - 1]! : current >= 0 ? current : enabled[0]!);
    search.current = { text: '', at: 0 }; setOpen(true);
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') { trigger.current?.focus({ preventScroll: true }); close(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActive(enabled[(enabled.indexOf(active) + offset + enabled.length) % enabled.length]!);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setActive(event.key === 'Home' ? enabled[0]! : enabled[enabled.length - 1]!);
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const at = Date.now(); search.current = { text: (at - search.current.at < 700 ? search.current.text : '') + event.key.toLowerCase(), at };
      const match = enabled.find(index => CATALOG[index]!.name.toLowerCase().startsWith(search.current.text));
      if (match !== undefined) setActive(match);
    }
  }
  function positionMenu() {
    const rect = trigger.current!.getBoundingClientRect(), width = Math.min(rect.width, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 14, above = rect.top - 14;
    setPlacement({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width,
      ...(below >= 260 || below >= above ? { top: rect.bottom + 6, maxHeight: Math.max(40, Math.min(280, below)) }
        : { bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(40, Math.min(280, above)) }) });
  }
  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    menu.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) positionMenu(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    window.addEventListener('resize', positionMenu);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('resize', positionMenu);
      document.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      className="wv-picker-trigger" disabled={disabled} onClick={() => open ? close() : show()}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); } }}>
      <Crest id={value} small/><span className="wv-picker-label"><strong>{selected.name}</strong><small>{installed.includes(value) ? faction(value) : 'Download below'}</small></span><span className="wv-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && createPortal(<div ref={menu} id={id} className="wv-picker-popup" role="listbox" aria-label={label} tabIndex={-1}
      aria-activedescendant={`${id}-${active}`} onKeyDown={keyDown} style={placement}>
      {CATALOG.map((character, index) => <div key={character.id} id={`${id}-${index}`} role="option" aria-selected={value === character.id} aria-disabled={!installed.includes(character.id)}
        className={active === index ? 'is-active' : ''} onMouseEnter={() => { if (installed.includes(character.id)) setActive(index); }} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <Crest id={character.id} small/><span className="wv-picker-label"><strong>{character.name}</strong><small>{installed.includes(character.id) ? faction(character.id) : 'Download in character library'}</small></span>
        {value === character.id && <span className="wv-picker-check" aria-hidden="true">✓</span>}
      </div>)}
    </div>, document.body)}
  </>;
}
