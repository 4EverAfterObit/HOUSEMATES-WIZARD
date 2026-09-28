// The Housemates Wizard logo. size="large" for the home page, "small" elsewhere.
export default function Brand({ size = "small" }) {
  const w = size === "large" ? 190 : 96;
  return (
    <a href="/" className={"brandlogo " + size} aria-label="Housemates Wizard home">
      <img src="/logo.png" alt="Housemates Wizard" width={w} style={{ width: w, height: "auto" }} />
    </a>
  );
}
