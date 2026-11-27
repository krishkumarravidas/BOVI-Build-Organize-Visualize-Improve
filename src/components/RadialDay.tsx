import { memo } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import {
  CONTENT_BEFORE_MIN,
  CONTENT_SPAN_MIN,
  FACE_FRACTION,
  REVERSE_TEXT_BELOW_DEG,
  RING_BANDS,
  arcPath,
  arcPathReversed,
  arcsForContent,
  contentAngle,
  contentMarks,
  dialGeometry,
  fitLabel,
  pointsForContent,
  polar,
  type ArcItem,
  type Ring,
} from '@/lib/radial';
import type { TimelineItem } from '@/lib/timeline';
import { readableOn } from '@/theme/contrast';

interface Props {
  width: number;
  height: number;
  items: readonly TimelineItem[];
  /** Midnight of the shown day. */
  dayStart: Date;
  /** Content base, minutes since midnight: the drawing covers base − 3 h … base + 9 h. */
  baseMin: number;
  /** Rotation in degrees (Animated), so spinning never re-renders the drawing. */
  rotation: Animated.Value;
  hourly: number[] | null;
  /** Current time in minutes since midnight of the shown day, or null when not today. */
  nowMin: number | null;
}

const RING_LABEL: Record<Ring, string> = { life: 'LIFE', college: 'COLLEGE', events: 'EVENTS' };
const USAGE: [number, number] = [0.95, 1];
const FONT = Platform.select({ web: 'system-ui, sans-serif', default: undefined });
const hour12 = (h: number) => String(h % 12 === 0 ? 12 : h % 12);
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * A rigid clock dial anchored to the right edge. The full 12-hour circle is drawn once and rotated as a
 * whole; the screen edge hides the right half, so the visible left half shows a 6-hour window.
 * Drawing only: touches are handled by the parent (rotate + hit test).
 */
export const RadialDay = memo(function RadialDay({ width, height, items, dayStart, baseMin, rotation, hourly, nowMin }: Props) {
  const theme = useTheme();
  const { cx, cy, R } = dialGeometry(width, height);
  const C = R; // centre inside the square content view
  const baseDate = new Date(dayStart.getTime() + baseMin * 60_000);
  const arcs = arcsForContent(items, baseDate);
  const points = pointsForContent(items, baseDate);
  const marks = contentMarks(baseMin);
  const faceR = FACE_FRACTION * R;

  const colorOf = (a: ArcItem): string => {
    const i = a.item;
    if (i.kind === 'class') return i.color || theme.primary;
    if (i.kind === 'exam') return theme.danger;
    if (i.kind === 'event') return theme.primary;
    if (i.kind === 'course') return i.color;
    return theme.accent;
  };

  const arc = (a: ArcItem) => {
    const [fi, fo] = RING_BANDS[a.ring];
    const laneW = ((fo - fi) * R) / a.lanes;
    const r = fi * R + laneW * (a.lane + 0.5);
    const spanLen = (r * (a.a1 - a.a0) * Math.PI) / 180;
    const sw = Math.max(6, laneW - 4);
    const rounded = spanLen >= sw * 1.6;
    const inset = rounded
      ? Math.min((((sw / 2 + 1) / r) * 180) / Math.PI, (a.a1 - a.a0) / 2 - 0.01)
      : Math.min(((1 / r) * 180) / Math.PI, (a.a1 - a.a0) / 4);
    const a0 = a.a0 + inset;
    const a1 = Math.max(a0 + 0.01, a.a1 - inset);
    const color = colorOf(a);
    const done = (a.item.kind === 'study' || a.item.kind === 'task' || a.item.kind === 'course') && a.item.done;
    const fontSize = Math.max(9, Math.min(12, sw * 0.55));
    // Text needs room beyond the rounded caps; measure along the visible stroke.
    const label = fitLabel(a.item.title, (r * (a1 - a0) * Math.PI) / 180, fontSize, a.item.kind === 'class' ? a.item.short : undefined);
    const reversed = (a.a0 + a.a1) / 2 < REVERSE_TEXT_BELOW_DEG && (a.a0 + a.a1) / 2 > 0;
    const textR = reversed ? r + fontSize * 0.35 : r - fontSize * 0.35;
    const id = `arc-${safeId(a.item.key)}-${baseMin}`;
    return (
      <G key={a.item.key}>
        {label ? (
          <Defs>
            <Path id={id} d={reversed ? arcPathReversed(C, C, textR, a0, a1) : arcPath(C, C, textR, a0, a1)} />
          </Defs>
        ) : null}
        <Path d={arcPath(C, C, r, a0, a1 + 0.001)} stroke={color} strokeOpacity={done ? 0.45 : 1} strokeWidth={sw} strokeLinecap={rounded ? 'round' : 'butt'} fill="none" />
        {a.item.conflict ? <Path d={arcPath(C, C, r + sw / 2 + 2, a0, a1 + 0.001)} stroke={theme.danger} strokeWidth={2} fill="none" /> : null}
        {label ? (
          <SvgText fill={readableOn(color)} fontSize={fontSize} fontWeight="600" fontFamily={FONT}>
            <TextPath href={`#${id}`} startOffset={5}>
              {label}
            </TextPath>
          </SvgText>
        ) : null}
      </G>
    );
  };

  const nowOffset = nowMin === null ? null : nowMin - baseMin;
  const showNow = nowOffset !== null && nowOffset >= -CONTENT_BEFORE_MIN && nowOffset < CONTENT_SPAN_MIN - CONTENT_BEFORE_MIN;
  const rotate = rotation.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

  return (
    <View style={{ width, height, overflow: 'hidden' }} pointerEvents="none">
      {/* Rotating content: square centred on the dial centre (right half falls off-screen). */}
      <Animated.View style={{ position: 'absolute', left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, transform: [{ rotate }] }}>
        <Svg width={2 * R} height={2 * R}>
          {(['life', 'college', 'events'] as Ring[]).map((ring) => {
            const [fi, fo] = RING_BANDS[ring];
            return <Circle key={ring} cx={C} cy={C} r={((fi + fo) / 2) * R} stroke={theme.surface} strokeWidth={(fo - fi) * R} fill="none" />;
          })}

          {/* Phone use per hour on the outer edge (explained by the phone-use card under the dial) */}
          {hourly
            ? Array.from({ length: 12 }, (_, i) => {
                const hour = Math.floor((baseMin - CONTENT_BEFORE_MIN) / 60) + i;
                if (hour < 0 || hour > 23) return null;
                const minutes = hourly[hour] ?? 0;
                if (!minutes) return null;
                const w = 2 + (minutes / 60) * (USAGE[1] - USAGE[0]) * R * 1.6;
                const a0 = contentAngle(hour * 60 - baseMin) + 1;
                const a1 = contentAngle((hour + 1) * 60 - baseMin) - 1;
                if (a1 <= 0 || a0 >= 360) return null;
                return (
                  <Path key={`u${hour}`} d={arcPath(C, C, ((USAGE[0] + USAGE[1]) / 2) * R, Math.max(0, a0), Math.min(360, a1))} stroke={minutes >= 30 ? theme.danger : minutes >= 15 ? theme.warn : theme.muted} strokeWidth={w} fill="none" />
                );
              })
            : null}

          {/* Face */}
          <Circle cx={C} cy={C} r={faceR + 6} fill="none" stroke={theme.border} strokeDasharray="3 4" />
          <Circle cx={C} cy={C} r={faceR} fill={theme.background} />
          {marks.quarters.map(({ angle, isHour, inDay }, i) => {
            const p0 = polar(C, C, faceR - 2, angle);
            const p1 = polar(C, C, faceR - (isHour ? 12 : 6), angle);
            return <Line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={isHour ? theme.text : theme.muted} strokeWidth={isHour ? 2 : 1} opacity={inDay ? 1 : 0.55} />;
          })}
          {marks.hours.map(({ hour, angle, inDay, dayOffset }) => {
            const p = polar(C, C, faceR - 28, angle);
            // Midnight shows the day it starts, so turning into the next day is obvious.
            const midnight = hour === 0;
            const label = midnight ? new Date(dayStart.getTime() + dayOffset * 86_400_000 + 3_600_000).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase() : hour12(hour);
            return (
              <SvgText
                key={`h${angle}`}
                x={p.x}
                y={p.y + (midnight ? 5 : 7)}
                fill={midnight ? theme.danger : theme.text}
                opacity={inDay || midnight ? 1 : 0.55}
                fontSize={midnight ? 14 : 20}
                fontWeight="800"
                textAnchor="middle"
                fontFamily={FONT}
              >
                {label}
              </SvgText>
            );
          })}

          {arcs.map(arc)}

          {points.map(({ item, angle }) => {
            const p = polar(C, C, ((RING_BANDS.life[0] + RING_BANDS.life[1]) / 2) * R, angle);
            return (
              <G key={item.key}>
                <Circle cx={p.x} cy={p.y} r={9} fill={item.done ? theme.accent : theme.background} stroke={theme.accent} strokeWidth={2.5} />
                {item.done ? (
                  <SvgText x={p.x} y={p.y + 4} fill={theme.background} fontSize={11} fontWeight="800" textAnchor="middle" fontFamily={FONT}>
                    ✓
                  </SvgText>
                ) : null}
              </G>
            );
          })}

          {showNow && nowOffset !== null ? (
            (() => {
              const deg = contentAngle(nowOffset);
              const tip = polar(C, C, R * 0.99, deg);
              return <Line x1={C} y1={C} x2={tip.x} y2={tip.y} stroke={theme.danger} strokeWidth={2.5} />;
            })()
          ) : null}
        </Svg>
      </Animated.View>

      {/* Static overlay: ring names near the bottom and the hub. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {(['life', 'college', 'events'] as Ring[]).map((ring) => {
          const [fi, fo] = RING_BANDS[ring];
          const r = ((fi + fo) / 2) * R;
          const id = `ringlabel-${ring}`;
          return (
            <G key={ring}>
              <Defs>
                <Path id={id} d={arcPathReversed(cx, cy, r + 3.5, 92, 120)} />
              </Defs>
              <SvgText fill={theme.muted} fontSize={9} fontWeight="700" letterSpacing={1.5} opacity={0.8} fontFamily={FONT}>
                <TextPath href={`#${id}`}>{RING_LABEL[ring]}</TextPath>
              </SvgText>
            </G>
          );
        })}
        <Circle cx={cx} cy={cy} r={5} fill={theme.muted} />
      </Svg>
    </View>
  );
});
