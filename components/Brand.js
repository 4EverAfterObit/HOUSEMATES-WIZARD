// Compact header across the top: logo icon on the left, app name beside it.
export default function Brand() {
  return (
    <a href="/" className="brandbar" aria-label="Housemates Wizard home">
      <img src="/logo.png" alt="" width={48} height={41} style={{ width: 48, height: "auto" }} />
      <span className="brandname">Housemates Wizard</span>
    </a>
  );
}
