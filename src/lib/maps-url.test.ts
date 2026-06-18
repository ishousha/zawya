import { describe, it, expect } from "vitest";
import { parseGoogleMapsCoords } from "./maps-url";

describe("parseGoogleMapsCoords", () => {
  it("returns null for empty/undefined", () => {
    expect(parseGoogleMapsCoords("")).toBeNull();
    expect(parseGoogleMapsCoords(null)).toBeNull();
    expect(parseGoogleMapsCoords(undefined)).toBeNull();
    expect(parseGoogleMapsCoords("   ")).toBeNull();
  });

  it("parses /@lat,lng,zoom format", () => {
    expect(
      parseGoogleMapsCoords("https://www.google.com/maps/place/Foo/@40.7128,-74.006,15z"),
    ).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it("parses !3d!4d embed format", () => {
    expect(
      parseGoogleMapsCoords(
        "https://www.google.com/maps/place/Foo/data=!3m1!4b1!4m5!3d37.4221!4d-122.0841",
      ),
    ).toEqual({ lat: 37.4221, lng: -122.0841 });
  });

  it("parses ?q=lat,lng format", () => {
    expect(parseGoogleMapsCoords("https://maps.google.com/?q=51.5074,-0.1278")).toEqual({
      lat: 51.5074,
      lng: -0.1278,
    });
  });

  it("parses &ll= format", () => {
    expect(
      parseGoogleMapsCoords("https://maps.google.com/maps?foo=bar&ll=-33.8688,151.2093"),
    ).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("parses &destination= format", () => {
    expect(
      parseGoogleMapsCoords(
        "https://www.google.com/maps/dir/?api=1&destination=48.8566,2.3522",
      ),
    ).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  it("returns null for short links it cannot resolve", () => {
    expect(parseGoogleMapsCoords("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(parseGoogleMapsCoords("https://goo.gl/maps/xyz")).toBeNull();
  });

  it("returns null for out-of-bounds values", () => {
    expect(parseGoogleMapsCoords("https://maps.google.com/?q=999,-74")).toBeNull();
    expect(parseGoogleMapsCoords("https://maps.google.com/?q=10,500")).toBeNull();
  });

  it("returns null for non-maps URLs", () => {
    expect(parseGoogleMapsCoords("https://example.com")).toBeNull();
    expect(parseGoogleMapsCoords("not a url")).toBeNull();
  });
});
