/* eslint-disable react-hooks/refs --
 * Gesture and animation callbacks read/write refs only while a gesture or animation runs, never during
 * render. The React Compiler lint can't see that, so this rule is disabled for this gesture hook only.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  type GestureResponderEvent,
  type HostInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { REBASE_MIN, angleOf, dialGeometry, dayShiftFor, isOnDial, rotateWindow, rotationFor } from '@/lib/radial';

const TAP_SLOP = 8;
const HEADER_MS = 90;

/**
 * Rigid, rotatable dial inside a ScrollView.
 *
 * - The drawing (around `baseMin`) is rotated with an Animated value, so spinning never re-renders it.
 *   When the window drifts more than REBASE_MIN from the base, the base moves (drawing rebuilt) and the
 *   rotation is corrected in a layout effect before paint.
 * - Touches landing on the rings are claimed at touch start, so the ScrollView can't turn them into a
 *   page scroll (Android). Elsewhere the page scrolls normally.
 * - A touch that doesn't move is a tap: `onTap(x, y, rotationDeg, baseMin)` in dial-box coordinates.
 * - When the window's middle crosses midnight, `onDayShift(±1)` fires and the window and base move by a
 *   day together, so the drawing doesn't jump: the dial turns continuously from one day into the next.
 */
export function useRotatingDial(opts: {
  initialStart: number;
  size: { width: number; height: number };
  onTap: (x: number, y: number, rotationDeg: number, baseMin: number) => void;
  onDayShift?: (delta: number) => void;
}) {
  const [startMin, setStartMin] = useState(opts.initialStart); // window shown in the header/lists
  const [baseMin, setBaseMin] = useState(opts.initialStart); // what the drawing is built around
  const [rotation] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);

  const live = useRef(opts.initialStart);
  const base = useRef(opts.initialStart);
  const dims = useRef(opts.size);
  const tapRef = useRef(opts.onTap);
  const shiftRef = useRef(opts.onDayShift);
  /** Minutes the coordinates have moved by day shifts (so an animation started before a shift stays on course). */
  const shifted = useRef(0);
  const measured = useRef({ x: 0, y: 0, scrollY: 0 });
  const scrollY = useRef(0);
  const lastAngle = useRef(0);
  const down = useRef({ x: 0, y: 0, moved: false });
  const anim = useRef<number | null>(null);
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dims.current = opts.size;
  }, [opts.size]);
  useEffect(() => {
    tapRef.current = opts.onTap;
  }, [opts.onTap]);
  useEffect(() => {
    shiftRef.current = opts.onDayShift;
  }, [opts.onDayShift]);
  // After the drawing is rebuilt around a new base, re-point the rotation before the frame paints.
  useLayoutEffect(() => {
    base.current = baseMin;
    rotation.setValue(rotationFor(baseMin, live.current));
  }, [baseMin, rotation]);

  const ref = useRef<HostInstance>(null);

  const [api] = useState(() => {
    const show = (raw: number) => {
      let next = raw;
      const delta = shiftRef.current ? dayShiftFor(next) : 0;
      if (delta) {
        // Same moment, expressed from the neighbouring day's midnight: rotation is unchanged.
        next -= delta * 1440;
        base.current -= delta * 1440;
        shifted.current += delta * 1440;
        setBaseMin(base.current);
        shiftRef.current?.(delta);
      }
      live.current = next;
      rotation.setValue(rotationFor(base.current, next));
      if (Math.abs(next - base.current) > REBASE_MIN) setBaseMin(Math.round(next / 15) * 15);
      if (!headerTimer.current) {
        headerTimer.current = setTimeout(() => {
          headerTimer.current = null;
          setStartMin(live.current);
        }, HEADER_MS);
      }
    };
    const commit = (final: number) => {
      show(final);
      setStartMin(live.current);
      setBaseMin(live.current);
    };
    const cancel = () => {
      if (anim.current !== null) cancelAnimationFrame(anim.current);
      anim.current = null;
    };
    const animateTo = (target: number, ms = 300) => {
      cancel();
      const from = live.current;
      const to = target;
      const shift0 = shifted.current;
      const t0 = Date.now();
      const step = () => {
        const k = Math.min(1, (Date.now() - t0) / ms);
        // Interpolate in the coordinates the animation started in, then convert for any day shift since.
        const v = from + (to - from) * (1 - Math.pow(1 - k, 3)) - (shifted.current - shift0);
        if (k < 1) {
          show(v);
          anim.current = requestAnimationFrame(step);
        } else {
          anim.current = null;
          commit(to - (shifted.current - shift0));
        }
      };
      anim.current = requestAnimationFrame(step);
    };
    const measure = () =>
      ref.current?.measureInWindow((x, y) => {
        measured.current = { x, y, scrollY: scrollY.current };
      });
    const local = (e: GestureResponderEvent) => ({
      x: e.nativeEvent.pageX - measured.current.x,
      y: e.nativeEvent.pageY - (measured.current.y - (scrollY.current - measured.current.scrollY)),
    });
    const angleAt = (e: GestureResponderEvent) => {
      const { x, y } = local(e);
      const { cx, cy } = dialGeometry(dims.current.width, dims.current.height);
      return angleOf(cx, cy, x, y);
    };
    const claim = (e: GestureResponderEvent) => {
      const { x, y } = local(e);
      return isOnDial(dims.current.width, dims.current.height, x, y);
    };
    const end = (e: GestureResponderEvent | null) => {
      setDragging(false);
      if (e && !down.current.moved) {
        const { x, y } = local(e);
        tapRef.current(x, y, rotationFor(base.current, live.current), base.current);
        return;
      }
      animateTo(Math.round(live.current / 15) * 15, 160);
    };
    const pan = PanResponder.create({
      onStartShouldSetPanResponderCapture: claim,
      onStartShouldSetPanResponder: claim,
      onMoveShouldSetPanResponderCapture: claim,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        cancel();
        down.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, moved: false };
        lastAngle.current = angleAt(e);
        setDragging(true); // freeze page scrolling as soon as a finger is on the dial
      },
      onPanResponderMove: (e) => {
        if (!down.current.moved) {
          if (Math.hypot(e.nativeEvent.pageX - down.current.x, e.nativeEvent.pageY - down.current.y) < TAP_SLOP) return;
          down.current.moved = true;
        }
        const a = angleAt(e);
        const next = rotateWindow(live.current, lastAngle.current, a);
        lastAngle.current = a;
        show(next);
      },
      onPanResponderRelease: (e) => end(e),
      onPanResponderTerminate: () => end(null),
    });
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
    };
    return { pan, animateTo, measure, cancel, onScroll };
  });

  useEffect(
    () => () => {
      api.cancel();
      if (headerTimer.current) clearTimeout(headerTimer.current);
    },
    [api],
  );

  return {
    startMin,
    baseMin,
    rotation,
    dragging,
    animateTo: api.animateTo,
    onScroll: api.onScroll,
    /** Spread onto the dial's wrapping View. */
    dialProps: { ref, onLayout: api.measure, ...api.pan.panHandlers },
  };
}
