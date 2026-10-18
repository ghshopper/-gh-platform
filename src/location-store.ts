// Hands the pin chosen on the map screen back to checkout / address forms.
let picked: { lat: number; lng: number } | null = null;

export function setPickedLocation(p: { lat: number; lng: number }): void {
  picked = p;
}
export function pickedLocation(): { lat: number; lng: number } | null {
  return picked;
}
export function clearPickedLocation(): void {
  picked = null;
}
