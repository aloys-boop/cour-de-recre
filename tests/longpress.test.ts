// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchInput } from '../src/input/touch';

function pointer(el: HTMLElement, type: string, x: number, y: number): void {
  const Ctor = (globalThis as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  if (!('pointerId' in e) || (e as PointerEvent).pointerId === undefined) Object.defineProperty(e, 'pointerId', { value: 1 });
  el.dispatchEvent(e);
}

function setup() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const calls = { long: [] as number[][], boxEnd: 0, boxStart: 0, tap: 0 };
  const input = new TouchInput(el, {
    onTap: () => calls.tap++,
    onBoxStart: () => calls.boxStart++,
    onBoxMove: () => undefined,
    onBoxEnd: () => calls.boxEnd++,
    onPan: () => undefined,
    onPinch: () => undefined,
    onLongPress: (x, y) => calls.long.push([x, y]),
  });
  return { el, calls, input };
}

describe('appui long', () => {
  afterEach(() => vi.useRealTimers());

  it('appui long sans bouger puis relâcher : ralliement, pas de rectangle', () => {
    vi.useFakeTimers();
    const { el, calls, input } = setup();
    pointer(el, 'pointerdown', 100, 80);
    vi.advanceTimersByTime(400);
    expect(calls.boxStart).toBe(1);
    pointer(el, 'pointerup', 103, 82);
    expect(calls.long).toEqual([[103, 82]]);
    expect(calls.boxEnd).toBe(0);
    expect(calls.tap).toBe(0);
    input.destroy();
  });

  it('appui long puis glisser : rectangle de sélection', () => {
    vi.useFakeTimers();
    const { el, calls, input } = setup();
    pointer(el, 'pointerdown', 100, 80);
    vi.advanceTimersByTime(400);
    pointer(el, 'pointermove', 160, 130);
    pointer(el, 'pointerup', 160, 130);
    expect(calls.long.length).toBe(0);
    expect(calls.boxEnd).toBe(1);
    input.destroy();
  });
});
