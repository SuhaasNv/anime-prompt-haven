import nova from "@/assets/mascot-wave.png";
import comet from "@/assets/mascot-comet.png";

export type MascotKey = "nova" | "comet";

export const MASCOTS: Record<MascotKey, { name: string; tagline: string; image: string }> = {
  nova: { name: "Nova-chan", tagline: "Stellar energy", image: nova },
  comet: { name: "Comet-kun", tagline: "Cool & sharp", image: comet },
};
