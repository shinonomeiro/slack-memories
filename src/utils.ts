import { formatInTimeZone as _formatInTimeZone } from 'date-fns-tz';

type FormatInTimeZoneFunction = typeof _formatInTimeZone extends (_: infer D, ...args: infer A) => infer R ? (...args: A) => (date: D) => R : never;

export const formatInTimeZone: FormatInTimeZoneFunction = (...args) => date => (
    _formatInTimeZone(date, ...args)
);
