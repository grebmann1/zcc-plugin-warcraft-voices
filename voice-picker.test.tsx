// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VoicePicker } from './voice-picker.js';
afterEach(cleanup);
const options = ['peon', 'peasant', 'murloc'];
function setup(installed = options, value = 'peon') {
  const change = vi.fn();
  const view = render(<><VoicePicker label="Alert voice" value={value} installed={installed} disabled={false} onChange={change}/><button>Next control</button></>);
  return { ...view, change, trigger: screen.getByRole('combobox'), open: () => { fireEvent.click(screen.getByRole('combobox')); return screen.getByRole('listbox'); } };
}
function active(menu: HTMLElement) { return document.getElementById(menu.getAttribute('aria-activedescendant')!)!; }
it('portals its themed menu, indicates the selected voice and prevents undownloaded choices', () => {
  const { open, trigger, change, container } = setup(); const menu = open();
  expect(container.contains(menu)).toBe(false); expect(document.activeElement).toBe(menu);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('option', { name: /Orc Peon/ }).getAttribute('aria-selected')).toBe('true');
  const missing = screen.getByRole('option', { name: /Orc Grunt/ });
  expect(missing.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(missing); expect(change).not.toHaveBeenCalled();
  fireEvent.mouseEnter(missing); expect(active(menu).textContent).toContain('Orc Peon');
  const human = screen.getByRole('option', { name: /Human Peasant/ }); fireEvent.mouseEnter(human); expect(active(menu)).toBe(human);
  fireEvent.mouseDown(human); fireEvent.click(human);
  expect(change).toHaveBeenCalledWith('peasant'); expect(screen.queryByRole('listbox')).toBeNull(); expect(document.activeElement).toBe(trigger);
});
it('supports arrows, wrapping, Home/End, typeahead, Enter/Space and Escape', () => {
  const { trigger, change } = setup();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' }); let menu = screen.getByRole('listbox');
  fireEvent.keyDown(menu, { key: 'ArrowUp' }); expect(active(menu).textContent).toContain('Murloc');
  fireEvent.keyDown(menu, { key: 'ArrowDown' }); expect(active(menu).textContent).toContain('Orc Peon');
  fireEvent.keyDown(menu, { key: 'ArrowDown' }); expect(active(menu).textContent).toContain('Human Peasant');
  fireEvent.keyDown(menu, { key: 'End' }); expect(active(menu).textContent).toContain('Murloc');
  fireEvent.keyDown(menu, { key: 'Home' }); expect(active(menu).textContent).toContain('Orc Peon');
  fireEvent.keyDown(menu, { key: 'h' }); fireEvent.keyDown(menu, { key: 'u' }); expect(active(menu).textContent).toContain('Human Peasant');
  fireEvent.keyDown(menu, { key: 'Enter' }); expect(change).toHaveBeenLastCalledWith('peasant');
  fireEvent.keyDown(trigger, { key: 'ArrowUp' }); menu = screen.getByRole('listbox'); expect(active(menu).textContent).toContain('Murloc');
  fireEvent.keyDown(menu, { key: ' ' }); expect(change).toHaveBeenLastCalledWith('murloc');
  fireEvent.click(trigger); menu = screen.getByRole('listbox');
  fireEvent.keyDown(menu, { key: 'z' }); fireEvent.keyDown(menu, { key: 'Control' }); fireEvent.keyDown(menu, { key: 'm', ctrlKey: true });
  fireEvent.keyDown(menu, { key: 'm', metaKey: true }); fireEvent.keyDown(menu, { key: 'm', altKey: true });
  fireEvent.keyDown(menu, { key: 'Escape' }); expect(screen.queryByRole('listbox')).toBeNull(); expect(document.activeElement).toBe(trigger);
});
it('closes on outside pointer, focus and Tab while tracking resize and ancestor scroll', () => {
  const { open, trigger } = setup(); let menu = open(); fireEvent.scroll(menu); expect(screen.getByRole('listbox')).toBe(menu);
  fireEvent.pointerDown(menu); expect(screen.getByRole('listbox')).toBe(menu);
  fireEvent.pointerDown(trigger); expect(screen.getByRole('listbox')).toBe(menu);
  fireEvent.pointerDown(document.body); expect(screen.queryByRole('listbox')).toBeNull();
  open(); fireEvent.focusIn(screen.getByRole('button', { name: 'Next control' })); expect(screen.queryByRole('listbox')).toBeNull();
  menu = open(); fireEvent(window, new Event('resize')); expect(screen.getByRole('listbox')).toBe(menu);
  const rect = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ left: 25, right: 225, top: 10, bottom: 50, width: 200, height: 40, x: 25, y: 10, toJSON: () => ({}) });
  fireEvent.scroll(document); expect(screen.getByRole('listbox')).toBe(menu); expect(menu.style.left).toBe('25px'); rect.mockRestore();
  fireEvent.keyDown(menu, { key: 'Tab' }); expect(screen.queryByRole('listbox')).toBeNull(); expect(document.activeElement).toBe(trigger);
  open(); fireEvent.click(trigger); expect(screen.queryByRole('listbox')).toBeNull();
});
it('confines the portal above a low trigger and falls back to the first downloaded voice for a missing assignment', () => {
  const { trigger, open } = setup(['peasant'], 'peon');
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ left: -30, right: 2000, top: 700, bottom: 740, width: 2000, height: 40, x: -30, y: 700, toJSON: () => ({}) });
  const menu = open(); expect(active(menu).textContent).toContain('Human Peasant');
  expect(menu.style.left).toBe('8px'); expect(menu.style.bottom).not.toBe(''); expect(Number.parseFloat(menu.style.width)).toBeLessThan(window.innerWidth);
  fireEvent.keyDown(menu, { key: 'Escape' });
});
it('does not open without downloaded choices, closes when disabled, and releases listeners on unmount', () => {
  const { trigger, rerender, unmount } = setup([]);
  fireEvent.click(trigger); expect(screen.queryByRole('listbox')).toBeNull();
  const change = vi.fn();
  rerender(<VoicePicker label="Alert voice" value="peon" installed={options} disabled={false} onChange={change}/>);
  fireEvent.click(trigger); expect(screen.getByRole('listbox')).toBeTruthy();
  rerender(<VoicePicker label="Alert voice" value="peon" installed={options} disabled onChange={change}/>);
  expect(screen.queryByRole('listbox')).toBeNull(); fireEvent.click(trigger); expect(screen.queryByRole('listbox')).toBeNull();
  rerender(<VoicePicker label="Alert voice" value="peon" installed={options} disabled={false} onChange={change}/>);
  fireEvent.click(trigger); unmount(); expect(screen.queryByRole('listbox')).toBeNull(); fireEvent.pointerDown(document.body); fireEvent(window, new Event('resize')); expect(change).not.toHaveBeenCalled();
});
