// tz-lookup ships no types. One function: coordinates in, IANA zone name out.
declare module 'tz-lookup' {
  export default function tzLookup(latitude: number, longitude: number): string
}
